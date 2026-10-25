"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Check, MessageCircle, RefreshCw, Send, Copy } from "lucide-react";
import { useT, rich } from "@/components/I18n";
import { PhoneField } from "@/components/ui";
import PickupMap, { MapMarker } from "@/components/pickup/Map";
import { DELIVERY_STATUS, DeliveryStatus, pickupUrl } from "@/lib/pickup/config";
import { fmtDateTime, money } from "@/lib/zola";
import { intlDigits, prettyPhone } from "@/lib/support";

const NETWORKS = [{ id: "mtn", label: "MTN MoMo" }, { id: "orange", label: "Orange Money" }];

/** The sender's private page for a delivery booked on Pickup: pay, follow, share the code. */
export default function DirectDelivery() {
  const { t, lang } = useT();
  const { id } = useParams() as { id: string };
  const k = useSearchParams().get("k") || "";
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [pay, setPay] = useState({ phone: "", network: "" });
  const [waiting, setWaiting] = useState(false);
  const [msg, setMsg] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pickup/deliveries/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || "Delivery not found"); return; }
    setD(j.delivery);
  }, [id, k]);
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);

  async function post(path: string, body: any) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/pickup/deliveries/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k, ...body }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(j.error || "Something went wrong. Please try again."); return null; }
      await load();
      return j;
    } finally { setBusy(false); }
  }

  async function startPay() {
    const r = await post("pay", pay);
    if (!r) return;
    setWaiting(true);
    let n = 0;
    const timer = setInterval(async () => {
      n++;
      const c = await fetch(`/api/pickup/deliveries/${id}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k }) }).then((x) => x.json()).catch(() => ({}));
      if (c.result === "paid" || c.result === "already_paid") { clearInterval(timer); setWaiting(false); load(); }
      if (c.result === "failed") { clearInterval(timer); setWaiting(false); setMsg("The payment didn't go through. No money was taken. You can try again."); }
      if (n >= 36) clearInterval(timer);
    }, 5000);
  }

  async function checkNow() {
    const c = await fetch(`/api/pickup/deliveries/${id}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k }) }).then((x) => x.json()).catch(() => ({}));
    if (c.result === "paid" || c.result === "already_paid") { setWaiting(false); load(); }
    else if (c.result === "failed") { setWaiting(false); setMsg("The payment didn't go through. No money was taken. You can try again."); }
    else setMsg("Still waiting for the payment. Approve the prompt on your phone.");
  }

  if (error) return <section className="pk-card pk-narrow"><h1 className="pk-h1">{t("Delivery")}</h1><p className="notice notice-danger">{t(error)}</p></section>;
  if (!d) return <div className="pk-card" style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>;

  const meta = DELIVERY_STATUS[d.status as DeliveryStatus] || DELIVERY_STATUS.waiting_rider;
  const sameCity = d.mode === "same_city";
  const paid = d.status !== "awaiting_payment";
  const track = `${pickupUrl()}/track/${d.track_code}`;
  const markers: MapMarker[] = [
    { id: "from", lat: d.origin.lat, lng: d.origin.lng, kind: "branch", label: d.origin.label },
    { id: "to", lat: d.dest.lat, lng: d.dest.lng, kind: "dest", label: d.recipient.name },
    ...(d.rider_loc ? [{ id: "rider", lat: d.rider_loc.lat, lng: d.rider_loc.lng, kind: "rider" as const, label: d.rider_name }] : []),
  ];
  const share = t("Hello {name}, a Pickup rider is bringing you “{title}”. When it arrives and you have checked it, give the rider this code: {code}. Follow it here: {link}", { name: d.recipient.name.split(" ")[0], title: d.title, code: d.handover_code, link: track });

  return (
    <div className="pk-app">
      <section className="pk-card">
        <p className="pk-tag">{t(meta.label)}</p>
        <h1 className="pk-h1" style={{ marginBottom: 6 }}>{d.title}</h1>
        <div className="kv"><span>{t("To")}</span><span style={{ textAlign: "right" }}>{d.recipient.name}, {prettyPhone(d.recipient.phone)}<br /><span className="hint">{d.dest.landmark}</span></span></div>
        <div className="kv"><span>{t("From")}</span><span style={{ textAlign: "right" }}>{d.origin.label}{d.branch ? ` (${d.branch.city})` : ` (${d.origin.city})`}</span></div>
        <div className="kv"><span>{t("Delivery price")}</span><strong>{money(d.fee)} <span className="hint">({d.km} km)</span></strong></div>
        <PickupMap markers={markers} height={240} follow="rider" />
      </section>

      {msg && <div className="notice notice-danger" role="alert" style={{ marginBottom: 14 }}>{t(msg)}</div>}

      {/* Pay */}
      {!paid && (
        <section className="pk-card">
          <h2 className="pk-h2">{t("Pay {fee} to send it", { fee: money(d.fee) })}</h2>
          <p className="hint" style={{ marginBottom: 10 }}>{t("A rider is sent as soon as the payment is received.")}</p>
          <div className="stack" style={{ gap: 10 }}>
            <div className="choice-row">
              {NETWORKS.map((n) => <button key={n.id} type="button" className="choice" aria-pressed={pay.network === n.id} onClick={() => setPay((p) => ({ ...p, network: n.id }))}>{n.label}</button>)}
            </div>
            <PhoneField id="pay-phone" value={pay.phone} onChange={(v) => setPay((p) => ({ ...p, phone: v }))} />
            {!waiting
              ? <button className="btn btn-primary btn-lg" disabled={busy || !pay.network || pay.phone.length < 9} onClick={startPay}>{t("Pay {fee}", { fee: money(d.fee) })}</button>
              : <>
                  <p className="notice notice-wait">{t("Approve the payment prompt on your phone. This page updates by itself.")}</p>
                  <button className="btn btn-secondary" onClick={checkNow}><RefreshCw size={15} /> {t("Check payment")}</button>
                </>}
          </div>
        </section>
      )}

      {/* Who's coming, or who to send it to */}
      {paid && d.status === "waiting_rider" && (
        <section className="pk-card"><p className="hint">{sameCity ? t("Paid. We're finding a free rider near you. Their name and number will appear here.") : t("Paid. We're finding a free rider near {branch}. Don't send the parcel until their name appears here.", { branch: d.origin.label })}</p></section>
      )}
      {d.status === "assigned" && sameCity && (
        <section className="pk-card card-mint">
          <h2 className="pk-h2">{t("Your rider is coming")}</h2>
          <div className="pk-recipient">
            <div><p className="label">{t("Rider")}</p><p className="pk-big">{d.rider_name}</p></div>
            <div><p className="label">{t("Rider's phone")}</p><p className="pk-big num">{prettyPhone(d.rider_phone)}</p></div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>{t("Have it packed and ready. Hand it over only to this rider.")}</p>
        </section>
      )}
      {d.status === "assigned" && !sameCity && (
        <section className="pk-card card-mint">
          <h2 className="pk-h2">{t("Send the parcel to your Pickup rider")}</h2>
          <p className="hint" style={{ marginBottom: 10 }}>{rich(t("Send it through <b>{agency}</b> to the <b>{branch}</b> branch in {city}, with this recipient:", { agency: d.branch.agency, branch: d.branch.name, city: d.branch.city }), { b: (c) => <strong>{c}</strong> })}</p>
          <div className="pk-recipient">
            <div><p className="label">{t("Recipient's name")}</p><p className="pk-big">{d.rider_name}</p></div>
            <div><p className="label">{t("Recipient's phone")}</p><p className="pk-big num">{prettyPhone(d.rider_phone)}</p></div>
          </div>
          <div className="field" style={{ margin: "12px 0" }}>
            <label className="label" htmlFor="receipt">{t("Agency receipt number")}</label>
            <input id="receipt" className="input num" maxLength={60} value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder={t("On the receipt the agency gives you")} />
          </div>
          <button className="btn btn-primary" disabled={busy || receipt.trim().length < 3} onClick={() => post("sent", { receipt: receipt.trim() })}><Send size={16} /> {t("I've sent it")}</button>
        </section>
      )}
      {["sent", "collected"].includes(d.status) && d.rider_name && (
        <section className="pk-card"><div className="kv"><span>{t("Rider")}</span><span>{d.rider_name}, {prettyPhone(d.rider_phone)}</span></div>{d.receipt_no && <div className="kv"><span>{t("Agency receipt")}</span><span className="num">{d.receipt_no}</span></div>}</section>
      )}

      {/* The code for the receiver */}
      {paid && d.status !== "delivered" && (
        <section className="pk-card">
          <p className="label">{t("Delivery code")}</p>
          <p className="pk-code-num num">{d.handover_code}</p>
          <p className="hint" style={{ marginBottom: 12 }}>{t("Send this code to {name}. They give it to the rider only once they have the parcel and have checked it.", { name: d.recipient.name })}</p>
          <div className="btn-row">
            <a className="btn btn-primary" href={`https://wa.me/${intlDigits(d.recipient.phone)}?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> {t("Send it on WhatsApp")}</a>
            <button className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(track); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}><Copy size={15} /> {copied ? t("Link copied") : t("Copy tracking link")}</button>
          </div>
        </section>
      )}

      <section className="pk-card">
        <ol className="pk-track">
          {[["Paid", "paid"], ["Rider assigned", "assigned"], ...(sameCity ? [] : [["With the agency", "sent"]]), ["With the rider", "collected"], ["Delivered", "delivered"]].map(([label, st]) => {
            const at = d.history.filter((h: any) => h.status === st).slice(-1)[0]?.at;
            return (
              <li key={st} className={at ? "is-done" : ""}>
                <span className="pk-dot">{at && <Check size={12} strokeWidth={3} />}</span>
                <div><p>{t(label)}</p>{at && <p className="hint" suppressHydrationWarning>{fmtDateTime(at, lang)}</p>}</div>
              </li>
            );
          })}
        </ol>
        <p className="hint" style={{ marginTop: 12 }}>{t("Keep this page: it's your private link for this delivery.")}</p>
      </section>
    </div>
  );
}
