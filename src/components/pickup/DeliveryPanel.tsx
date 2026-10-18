"use client";
import { useEffect, useState } from "react";
import { Bike, Copy, MapPinned, Send, RefreshCw, UserCheck, UserX } from "lucide-react";
import { useT, rich } from "@/components/I18n";
import DeliverySpot from "@/components/pickup/DeliverySpot";
import { DELIVERY_STATUS, DeliveryStatus, pickupUrl } from "@/lib/pickup/config";
import { prettyPhone } from "@/lib/support";
import { fmtDateTime } from "@/lib/zola";

/**
 * Everything about a Pickup delivery on a Zola transaction page.
 *   seller  who to send the parcel to, then the receipt number
 *   buyer   status, the 4-digit code, where to deliver, the map link
 *   admin   status and moving it to another rider
 */
export default function DeliveryPanel({ trade, delivery, viewer, onChange, act, acting }: {
  trade: any; delivery: any; viewer: "buyer" | "seller" | "admin";
  onChange: () => void;
  act?: (action: string, extra?: Record<string, any>) => Promise<boolean>;
  acting?: boolean;
}) {
  const { t, lang } = useT();
  const [receipt, setReceipt] = useState("");
  const [copied, setCopied] = useState(false);
  const [editSpot, setEditSpot] = useState(false);
  const [cands, setCands] = useState<any[] | null>(null);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState("");
  const branch = delivery?.branch || trade.dest_branch;
  const status: DeliveryStatus = delivery?.status || "waiting_rider";
  const label = t((DELIVERY_STATUS[status] || DELIVERY_STATUS.waiting_rider).label);
  const track = delivery?.track_code ? `${pickupUrl()}/track/${delivery.track_code}` : "";

  useEffect(() => {
    if (viewer !== "admin" || !["waiting_rider", "assigned"].includes(status)) return;
    fetch(`/api/admin/deliveries/${trade.id}`).then((r) => r.json()).then((d) => setCands(d.candidates || [])).catch(() => setCands([]));
  }, [viewer, status, trade.id]);

  async function admin(action: string, riderId?: string) {
    setMsg("");
    const res = await fetch(`/api/admin/deliveries/${trade.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, riderId }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "That didn't go through. Please try again."); return; }
    if (action === "auto" && !d.rider) setMsg("No free rider can take it yet.");
    onChange();
  }

  /* ── Seller: who to send it to ─────────────────────────────────────────── */
  if (viewer === "seller") {
    if (trade.status !== "funds_held") return null;
    if (status === "waiting_rider" || !delivery) {
      return (
        <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="send-title">
          <h2 id="send-title" className="section-title">{t("Payment has been secured")}</h2>
          <p style={{ fontSize: 14.5, margin: "2px 0 0", color: "var(--emerald-press)" }}>
            {t("We're finding a free Zola rider near {branch}. Their name and number will appear here, and we'll notify you. Don't send the parcel until then.", { branch: `${branch.agency}, ${branch.name}` })}
          </p>
        </section>
      );
    }
    return (
      <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="send-title">
        <h2 id="send-title" className="section-title">{t("Send the parcel to your Zola rider")}</h2>
        <p style={{ fontSize: 14.5, margin: "2px 0 14px", color: "var(--emerald-press)" }}>
          {rich(t("The buyer has paid. Send it through <b>{agency}</b> to the <b>{branch}</b> branch in {city}, with this recipient:", { agency: branch.agency, branch: branch.name, city: branch.city }), { b: (c) => <strong>{c}</strong> })}
        </p>
        <div className="pk-recipient">
          <div><p className="label">{t("Recipient's name")}</p><p className="pk-big">{delivery.rider_name}</p></div>
          <div><p className="label">{t("Recipient's phone")}</p><p className="pk-big num">{prettyPhone(delivery.rider_phone)}</p></div>
        </div>
        <p className="hint" style={{ margin: "10px 0 14px" }}>{t("Don't write the buyer's name. Zola's rider collects it at the agency, checks it and brings it to the buyer.")}</p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="label" htmlFor="receipt">{t("Agency receipt number")}</label>
          <input id="receipt" className="input num" maxLength={60} value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder={t("On the receipt the agency gives you")} />
        </div>
        <button className="btn btn-primary" disabled={acting || receipt.trim().length < 3} onClick={() => act?.("ship", { trackingNumber: receipt.trim() })}>
          <Send size={16} /> {acting ? t("Marking...") : t("I've sent it")}
        </button>
      </section>
    );
  }

  /* ── Buyer and admin: where the parcel is ──────────────────────────────── */
  const hasPaid = !["awaiting_seller", "pending_payment", "cancelled"].includes(trade.status);
  if (!hasPaid) return null;
  return (
    <section className="card card-pad fade-up" aria-labelledby="delivery-title">
      <div className="card-head" style={{ marginBottom: 6 }}>
        <h2 id="delivery-title" className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Bike size={17} /> {t("Delivery by Pickup")}</h2>
        <span className="pk-tag" style={{ marginBottom: 0 }}>{label}</span>
      </div>
      <div className="kv"><span>{t("Agency branch")}</span><span style={{ textAlign: "right" }}>{branch.agency}, {branch.name} ({branch.city})</span></div>
      {delivery?.rider_name && <div className="kv"><span>{t("Rider")}</span><span>{delivery.rider_name}{delivery.rider_phone ? `, ${prettyPhone(delivery.rider_phone)}` : ""}</span></div>}
      {delivery?.receipt_no && <div className="kv"><span>{t("Agency receipt")}</span><span className="num">{delivery.receipt_no}</span></div>}
      {delivery?.delivered_at && <div className="kv"><span>{t("Delivered")}</span><span suppressHydrationWarning>{fmtDateTime(delivery.delivered_at, lang)}</span></div>}

      {viewer === "buyer" && delivery && status !== "delivered" && (
        <>
          <div className="pk-code">
            <p className="label">{t("Your delivery code")}</p>
            <p className="pk-code-num num">{delivery.handover_code}</p>
            <p className="hint">{t("Give it to the rider only once you have checked your parcel. Never share it before.")}</p>
          </div>
          {track && (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <a className="btn btn-primary" href={track} target="_blank" rel="noopener noreferrer"><MapPinned size={16} /> {t("Follow it on the map")}</a>
              <button className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(track); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}>
                <Copy size={15} /> {copied ? t("Link copied") : t("Copy link")}
              </button>
            </div>
          )}
          <hr className="divider" />
          <p className="label" style={{ marginBottom: 4 }}>{t("Where should the rider bring it?")}</p>
          {delivery.dest && !editSpot ? (
            <p className="hint">{delivery.dest.landmark} <button className="link-btn" onClick={() => setEditSpot(true)}>{t("Change")}</button></p>
          ) : (
            <DeliverySpot tradeId={trade.id} initial={delivery.dest} onSaved={() => { setEditSpot(false); onChange(); }} />
          )}
        </>
      )}

      {viewer === "admin" && delivery && (
        <>
          {delivery.track_code && <p className="hint" style={{ marginTop: 6 }}>Tracking: <a href={track} target="_blank" rel="noopener noreferrer">{delivery.track_code}</a></p>}
          {["waiting_rider", "assigned"].includes(status) && (
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <div className="btn-row">
                <button className="btn btn-secondary btn-sm" onClick={() => admin("auto")}><RefreshCw size={15} /> Find a free rider</button>
                {status === "assigned" && <button className="btn btn-danger-outline btn-sm" onClick={() => admin("unassign")}><UserX size={15} /> Take it back from {delivery.rider_name}</button>}
              </div>
              {cands && cands.length > 0 && (
                <div className="pk-row">
                  <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Choose a rider">
                    <option value="">Choose a free rider</option>
                    {cands.map((c) => <option key={c.id} value={c.id}>{c.name}{c.km !== null ? `, ${c.km} km away` : ""}</option>)}
                  </select>
                  <button className="btn btn-secondary btn-sm" disabled={!pick} onClick={() => admin("assign", pick)}><UserCheck size={15} /> Assign</button>
                </div>
              )}
              {cands && cands.length === 0 && <p className="hint">No free rider in {branch.city} can carry this right now (free, available, and with enough balance).</p>}
            </div>
          )}
          {msg && <p role="alert" className="hint-error" style={{ marginTop: 8 }}>{msg}</p>}
        </>
      )}
    </section>
  );
}
