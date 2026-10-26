"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bike, Wallet, MapPin, Phone, MessageCircle, Navigation, PackageCheck, LogOut, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { PhoneField } from "@/components/ui";
import PickupMap, { MapMarker } from "@/components/pickup/Map";
import { LOCATION_EVERY_SECONDS, MIN_TOPUP, balanceNeeded, mapsLink } from "@/lib/pickup/config";
import { money, fmtDateTime } from "@/lib/zola";
import { prettyPhone, intlDigits } from "@/lib/support";

const NETWORKS = [{ id: "mtn", label: "MTN MoMo" }, { id: "orange", label: "Orange Money" }];

/** The rider's app: availability, balance, the delivery they have now. */
export default function RiderApp() {
  const { t, lang } = useT();
  const pk = usePk();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<"off" | "on" | "blocked">("off");

  // Top-up
  const [top, setTop] = useState({ amount: "5000", phone: "", network: "" });
  const [topId, setTopId] = useState("");
  const [topMsg, setTopMsg] = useState("");
  // Withdraw
  const [wOpen, setWOpen] = useState(false);
  const [wForm, setWForm] = useState({ amount: "", phone: "", network: "" });
  const [wMsg, setWMsg] = useState("");
  // Delivery code
  const [code, setCode] = useState("");
  const [confirmCollect, setConfirmCollect] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/pickup/me", { cache: "no-store" });
    if (res.status === 401) { window.location.href = pk("/login"); return; }
    const d = await res.json().catch(() => null);
    if (d) setData(d);
  }, [pk]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const rider = data?.rider;
  const job = data?.job;
  // Share location while available or carrying a parcel
  const sharing = !!rider && rider.status === "approved" && (rider.available || !!job);

  const last = useRef(0);
  useEffect(() => {
    if (!sharing || !navigator.geolocation) { setLocState("off"); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMe(pos); setLocState("on");
        if (Date.now() - last.current < LOCATION_EVERY_SECONDS * 1000) return;
        last.current = Date.now();
        fetch("/api/pickup/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pos, accuracy: p.coords.accuracy }) }).catch(() => {});
      },
      () => setLocState("blocked"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sharing]);

  // Keep the screen awake while carrying a parcel, so the location keeps going
  useEffect(() => {
    let lock: any = null;
    if (job?.status === "collected" && (navigator as any).wakeLock) {
      (navigator as any).wakeLock.request("screen").then((l: any) => { lock = l; }).catch(() => {});
    }
    return () => { lock?.release?.().catch?.(() => {}); };
  }, [job?.status]);

  async function post(url: string, body: any) {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return null; }
      await load();
      return d;
    } catch { setError("Something went wrong. Check your connection and try again."); return null; }
    finally { setBusy(false); }
  }

  async function setAvailable(on: boolean) {
    await post("/api/pickup/availability", { available: on, ...(me || {}) });
  }

  async function startTopup() {
    setTopMsg("");
    const d = await post("/api/pickup/topup", { amount: Number(top.amount), phone: top.phone, network: top.network });
    if (!d) return;
    setTopId(d.id);
    setTopMsg("Approve the payment prompt on your phone. Your balance updates as soon as it goes through.");
    let n = 0;
    const timer = setInterval(async () => {
      n++;
      const r = await fetch("/api/pickup/topup/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id }) }).then((x) => x.json()).catch(() => ({}));
      if (r.result === "paid" || r.result === "already_paid") { clearInterval(timer); setTopId(""); setTopMsg("Top-up received."); load(); }
      if (r.result === "failed") { clearInterval(timer); setTopId(""); setTopMsg("The payment didn't go through. No money was taken. You can try again."); }
      if (n >= 36) clearInterval(timer);
    }, 5000);
  }

  async function checkTopup() {
    const r = await fetch("/api/pickup/topup/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: topId }) }).then((x) => x.json()).catch(() => ({}));
    if (r.result === "paid" || r.result === "already_paid") { setTopId(""); setTopMsg("Top-up received."); load(); }
    else if (r.result === "failed") { setTopId(""); setTopMsg("The payment didn't go through. No money was taken. You can try again."); }
    else setTopMsg("Still waiting for the payment. Approve the prompt on your phone.");
  }

  async function withdraw() {
    setWMsg("");
    const d = await post("/api/pickup/withdraw", { amount: Number(wForm.amount), phone: wForm.phone, network: wForm.network });
    if (d) { setWOpen(false); setWForm({ amount: "", phone: "", network: "" }); setWMsg("Withdrawal requested. Zola sends it to your mobile money."); }
  }

  async function signOut() {
    await fetch("/api/pickup/logout", { method: "POST" });
    window.location.href = pk("/");
  }

  if (!data || !rider) return <div className="pk-card" style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>;

  const approved = rider.status === "approved";
  const markers: MapMarker[] = [];
  const sameCity = job?.mode === "same_city";
  if (job?.origin) markers.push({ id: "branch", lat: job.origin.lat, lng: job.origin.lng, kind: "branch", label: job.origin.label });
  if (job?.dest) markers.push({ id: "dest", lat: job.dest.lat, lng: job.dest.lng, kind: "dest", label: t("Buyer") });
  if (me) markers.push({ id: "me", lat: me.lat, lng: me.lng, kind: "rider", label: t("You") });

  return (
    <div className="pk-app">
      <div className="pk-hello">
        <div>
          <p className="pk-h1" style={{ margin: 0 }}>{t("Hello, {name}", { name: rider.name.split(" ")[0] })}</p>
          <p className="hint">{rider.city}{rider.deliveries_done ? ` · ${t("{n} deliveries", { n: rider.deliveries_done })}` : ""}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={signOut}><LogOut size={15} /> {t("Sign out")}</button>
      </div>

      {error && <div className="notice notice-danger" role="alert"><AlertTriangle size={16} /> <span>{t(error)}</span></div>}

      {rider.status === "pending" && (
        <div className="notice notice-wait">
          <span>{t("Zola is checking your account. We'll call you to see your national ID, then approve you by email. You can top up your balance in the meantime.")}</span>
        </div>
      )}
      {rider.status === "suspended" && (
        <div className="notice notice-danger"><span>{t("Your rider account is suspended. Contact Zola customer service.")}</span></div>
      )}

      {/* The delivery they have now */}
      {job && (
        <section className="pk-card pk-job" aria-labelledby="job-title">
          <p className="pk-tag">{job.status === "assigned" ? t("New delivery") : job.status === "sent" ? t("On its way with the agency") : t("With you")}</p>
          <h2 id="job-title" className="pk-h2">{job.title}</h2>
          <div className="kv"><span>{t("Value")}</span><span>{money(job.amount)}</span></div>
          <div className="kv"><span>{t("You earn")}</span><strong>{money(job.rider_pay)}</strong></div>
          <div className="kv"><span>{t("Collect at")}</span><span style={{ textAlign: "right" }}>{sameCity ? job.seller_name : job.origin?.label}<br /><span className="hint">{sameCity ? job.origin?.label : job.origin?.landmark || job.origin?.city}</span></span></div>
          {job.receipt_no && <div className="kv"><span>{t("Agency receipt")}</span><strong className="num">{job.receipt_no}</strong></div>}

          <PickupMap markers={markers} height={220} follow="me" />

          {job.status === "assigned" && sameCity && (
            <>
              <p className="hint" style={{ margin: "12px 0" }}>{t("Go to {seller} and collect the parcel. Check it matches what was ordered before you take it.", { seller: job.seller_name })}</p>
              <div className="btn-row">
                {job.seller_phone && <a className="btn btn-secondary" href={`tel:+${intlDigits(job.seller_phone)}`}><Phone size={16} /> {t("Call {name}", { name: job.seller_name.split(" ")[0] })}</a>}
                <a className="btn btn-secondary" href={mapsLink(job.origin)} target="_blank" rel="noopener noreferrer"><Navigation size={16} /> {t("Directions")}</a>
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" disabled={busy} onClick={() => post("/api/pickup/job", { action: "collected" })}><PackageCheck size={16} /> {t("I've collected it")}</button>
                <button className="btn btn-danger-outline" disabled={busy} onClick={() => { if (confirm(t("Give this delivery to another rider?"))) post("/api/pickup/job", { action: "decline" }); }}>{t("I can't take it")}</button>
              </div>
            </>
          )}

          {job.status === "assigned" && !sameCity && (
            <>
              <p className="hint" style={{ margin: "12px 0" }}>{t("{seller} is sending this parcel in your name. Wait for the agency receipt number before you go to the branch.", { seller: job.seller_name })}</p>
              <div className="btn-row">
                <a className="btn btn-secondary" href={mapsLink(job.origin)} target="_blank" rel="noopener noreferrer"><Navigation size={16} /> {t("Directions to the branch")}</a>
                <button className="btn btn-danger-outline" disabled={busy} onClick={() => { if (confirm(t("Give this delivery to another rider?"))) post("/api/pickup/job", { action: "decline" }); }}>{t("I can't take it")}</button>
              </div>
              <p className="hint" style={{ marginTop: 10 }}>{t("Already have it? You can mark it as collected.")} <button className="link-btn" onClick={() => setConfirmCollect(true)}>{t("Collected")}</button></p>
            </>
          )}

          {(job.status === "sent" || (job.status === "assigned" && !sameCity && confirmCollect)) && (
            <>
              <p className="hint" style={{ margin: "12px 0" }}>{t("Collect it at the branch with the receipt number. Open it and check it matches what was ordered before you take it.")}</p>
              <div className="btn-row">
                <a className="btn btn-secondary" href={mapsLink(job.origin)} target="_blank" rel="noopener noreferrer"><Navigation size={16} /> {t("Directions to the branch")}</a>
                <button className="btn btn-primary" disabled={busy} onClick={() => post("/api/pickup/job", { action: "collected" })}><PackageCheck size={16} /> {t("I've collected it")}</button>
              </div>
            </>
          )}

          {job.status === "collected" && (
            <>
              <div className="pk-buyer">
                <p className="label" style={{ marginBottom: 2 }}>{t("Deliver to")}</p>
                <p style={{ fontWeight: 700, color: "var(--navy)" }}>{job.buyer_name}</p>
                {job.buyer_phone && <p className="num">{prettyPhone(job.buyer_phone)}</p>}
                {job.dest?.landmark ? <p className="hint">{job.dest.landmark}</p> : <p className="hint">{t("The buyer hasn't set a delivery spot yet. Call them to agree where to meet.")}</p>}
                <div className="btn-row" style={{ marginTop: 8 }}>
                  {job.buyer_phone && <a className="btn btn-secondary btn-sm" href={`tel:+${intlDigits(job.buyer_phone)}`}><Phone size={15} /> {t("Call")}</a>}
                  {job.buyer_phone && <a className="btn btn-secondary btn-sm" href={`https://wa.me/${intlDigits(job.buyer_phone)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
                  {job.dest && <a className="btn btn-secondary btn-sm" href={mapsLink(job.dest)} target="_blank" rel="noopener noreferrer"><Navigation size={15} /> {t("Directions")}</a>}
                </div>
              </div>
              {locState !== "on" && <p className="hint-error" style={{ marginTop: 8 }}>{t("Turn on location for this site so the buyer can follow you on the map.")}</p>}
              <div className="field" style={{ marginTop: 12 }}>
                <label className="label" htmlFor="code">{t("Buyer's 4-digit code")}</label>
                <div className="pk-row">
                  <input id="code" className="input num" inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                  <button className="btn btn-primary" disabled={busy || code.length !== 4} onClick={async () => { if (await post("/api/pickup/job", { action: "delivered", code })) setCode(""); }}>{t("Delivered")}</button>
                </div>
                <p className="hint">{t("The buyer gives you this code once they have the parcel in hand.")}</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* Available or not */}
      {approved && !job && (
        <section className={`pk-card pk-avail${rider.available ? " is-on" : ""}`}>
          <div>
            <p className="pk-h2" style={{ margin: 0 }}><Bike size={18} /> {rider.available ? t("You're available") : t("You're not available")}</p>
            <p className="hint">
              {rider.available
                ? (data.noLimit || data.maxValue > 0 ? t("Pickup will give you the next parcel near you. Keep this page open.") : t("Top up your balance to start getting parcels."))
                : t("Switch on when you're ready to take a parcel.")}
            </p>
            {rider.available && locState === "blocked" && <p className="hint-error">{t("Location is blocked. Allow it for this site so we can give you parcels near you.")}</p>}
          </div>
          <button className={`btn ${rider.available ? "btn-secondary" : "btn-primary"}`} disabled={busy} onClick={() => setAvailable(!rider.available)}>
            {rider.available ? t("Stop") : t("Go available")}
          </button>
        </section>
      )}

      {/* Balance */}
      <section className="pk-card">
        <p className="stat-label"><Wallet size={15} /> {t("Balance")}</p>
        <p className="amount-xl">{money(rider.balance)}</p>
        {data.noLimit
          ? <p className="hint">{t("Zola has removed the balance limit for you: you can carry any parcel, with no top-up needed. Your earnings still go into this balance.")}</p>
          : <p className="hint">{t("You can carry parcels worth up to {max}.", { max: money(data.maxValue) })} {t("To carry a FCFA 10,000 parcel you need {need}.", { need: money(balanceNeeded(10000)) })}</p>}

        <hr className="divider" />
        <p className="label">{t("Top up")}</p>
        <div className="choice-row" style={{ margin: "6px 0 10px" }}>
          {["2000", "5000", "10000", "20000"].map((a) => (
            <button key={a} type="button" className="choice" aria-pressed={top.amount === a} onClick={() => setTop((f) => ({ ...f, amount: a }))}>{money(a)}</button>
          ))}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <input className="input num" type="number" min={MIN_TOPUP} inputMode="numeric" aria-label={t("Amount (FCFA)")} value={top.amount} onChange={(e) => setTop((f) => ({ ...f, amount: e.target.value }))} />
          <div className="choice-row">
            {NETWORKS.map((n) => <button key={n.id} type="button" className="choice" aria-pressed={top.network === n.id} onClick={() => setTop((f) => ({ ...f, network: n.id }))}>{n.label}</button>)}
          </div>
          <PhoneField id="top-phone" value={top.phone} onChange={(v) => setTop((f) => ({ ...f, phone: v }))} />
          {!topId ? (
            <button className="btn btn-primary" disabled={busy || !top.network || top.phone.length < 9 || Number(top.amount) < MIN_TOPUP} onClick={startTopup}>{t("Top up {amount}", { amount: money(top.amount) })}</button>
          ) : (
            <button className="btn btn-secondary" onClick={checkTopup}><RefreshCw size={15} /> {t("Check payment")}</button>
          )}
          {topMsg && <p role="status" className="hint">{t(topMsg)}</p>}
        </div>

        <hr className="divider" />
        <button className="link-btn" onClick={() => setWOpen((o) => !o)} aria-expanded={wOpen}>
          {t("Withdraw from my balance")} {wOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {wMsg && <p role="status" className="hint" style={{ marginTop: 6 }}>{t(wMsg)}</p>}
        {wOpen && (
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <input className="input num" type="number" inputMode="numeric" placeholder={t("Amount (FCFA)")} aria-label={t("Amount (FCFA)")} value={wForm.amount} onChange={(e) => setWForm((f) => ({ ...f, amount: e.target.value }))} />
            <div className="choice-row">
              {NETWORKS.map((n) => <button key={n.id} type="button" className="choice" aria-pressed={wForm.network === n.id} onClick={() => setWForm((f) => ({ ...f, network: n.id }))}>{n.label}</button>)}
            </div>
            <PhoneField id="w-phone" value={wForm.phone} onChange={(v) => setWForm((f) => ({ ...f, phone: v }))} />
            <button className="btn btn-secondary" disabled={busy || !wForm.amount || !wForm.network || wForm.phone.length < 9} onClick={withdraw}>{t("Request withdrawal")}</button>
            <p className="hint">{t("You can't withdraw while carrying a parcel: your balance is the guarantee for it.")}</p>
          </div>
        )}
      </section>

      {/* History */}
      {(data.ledger?.length > 0 || data.done?.length > 0) && (
        <section className="pk-card">
          <h2 className="pk-h2">{t("History")}</h2>
          <ul className="pk-ledger">
            {data.ledger.map((l: any) => (
              <li key={l.id}>
                <div><p>{t(l.type === "topup" ? "Top-up" : l.type === "earning" ? "Delivery paid" : l.type === "withdrawal" ? "Withdrawal" : l.type === "deduction" ? "Deduction by Zola" : "Credit from Zola")}</p>
                  <p className="hint" suppressHydrationWarning>{l.type === "earning" ? l.note.replace(/^Delivery: /, "") : l.type === "deduction" || l.type === "credit" ? l.note : ""} {fmtDateTime(l.created_at, lang)}</p></div>
                <strong className={`num ${l.amount < 0 ? "pk-minus" : "pk-plus"}`}>{l.amount > 0 ? "+" : ""}{money(l.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="hint" style={{ textAlign: "center" }}><MapPin size={13} /> {t("Keep Pickup open while you deliver so buyers can follow you.")}</p>
    </div>
  );
}
