"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { CheckCircle, Ban, Plus, Pencil, Banknote, LocateFixed, Copy, MessageCircle } from "lucide-react";
import OriginPicker, { OriginValue, originReady } from "@/components/pickup/OriginPicker";
import { PhoneField } from "@/components/ui";
import { DELIVERY_STATUS, DeliveryStatus, priceForKm } from "@/lib/pickup/config";
import { intlDigits } from "@/lib/support";
import { Pill } from "@/components/ui";
import PickupMap from "@/components/pickup/Map";
import PlaceSearch from "@/components/pickup/PlaceSearch";
import { fmtDateTime, money } from "@/lib/zola";
import { pickupUrl } from "@/lib/pickup/config";
import AssignRider from "@/components/pickup/AssignRider";

/** Admin tabs for Pickup: riders (approve, balance, withdrawals) and agency branches. Admin screens stay in English. */
export default function AdminPickup({ tab }: { tab: "riders" | "agencies" | "deliveries" }) {
  return tab === "riders" ? <Riders /> : tab === "deliveries" ? <Deliveries /> : <><Settings /><Agencies /></>;
}

/* ── Prices and the on/off switch ─────────────────────────────────────────── */

function Settings() {
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/admin/pickup-settings").then((r) => r.json()).then((d) => setS(d.settings)).catch(() => {}); }, []);
  if (!s) return null;
  const num = (k: string) => (e: any) => setS((x: any) => ({ ...x, [k]: e.target.value }));
  async function save() {
    setMsg("");
    const body = { enabled: !!s.enabled, base: Number(s.base), per_km: Number(s.per_km), min: Number(s.min), road_factor: Number(s.road_factor), rider_share: Number(s.rider_share), max_value: Number(s.max_value) };
    const res = await fetch("/api/admin/pickup-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Saved." : d.error || "That didn't go through.");
    if (res.ok) setS(d.settings);
  }
  const example = (km: number) => priceForKm(km * Number(s.road_factor || 1), { ...s, base: Number(s.base), per_km: Number(s.per_km), min: Number(s.min) });
  return (
    <div className="card card-pad stack fade-up" style={{ gap: 12, marginBottom: 14 }}>
      <h2 className="section-title">Pickup prices</h2>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14.5, color: "var(--navy)", fontWeight: 600 }}>
        <input type="checkbox" checked={!!s.enabled} onChange={(e) => setS((x: any) => ({ ...x, enabled: e.target.checked }))} />
        Pickup delivers Zola orders and takes bookings on {"pickup.zolahq.com"}
      </label>
      <div className="form-grid-2">
        {[["base", "Base price (FCFA)"], ["per_km", "Per km (FCFA)"], ["min", "Minimum (FCFA)"], ["road_factor", "Road factor (km by road ÷ straight line)"], ["rider_share", "Rider's share (0 to 1, e.g. 0.8 = 80%)"], ["max_value", "Highest parcel value (0 = no limit)"]].map(([k, l]) => (
          <div key={k} className="field"><label className="label" htmlFor={`ps-${k}`}>{l}</label><input id={`ps-${k}`} className="input num" inputMode="decimal" value={s[k]} onChange={num(k)} /></div>
        ))}
      </div>
      <p className="hint">Example prices: 2 km straight line {money(example(2))}, 5 km {money(example(5))}, 10 km {money(example(10))}. The rider earns {Math.round(Number(s.rider_share) * 100)}% of each delivery.</p>
      <div className="btn-row"><button className="btn btn-primary btn-sm" onClick={save}>Save prices</button>{msg && <span className="hint" role="status">{msg}</span>}</div>
    </div>
  );
}

/* ── Deliveries: all of them, and creating one for a client ───────────────── */

const BLANK = { title: "", value: "", destLandmark: "", recipientName: "", recipientPhone: "", senderName: "", senderPhone: "", senderEmail: "", riderId: "", fee: "" };

function Deliveries() {
  const [list, setList] = useState<any[] | null>(null);
  const [riders, setRiders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const [origin, setOrigin] = useState<OriginValue>({ deliveryMode: "same_city" });
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [price, setPrice] = useState<any>(null);
  const [made, setMade] = useState<any>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [assigning, setAssigning] = useState("");
  const load = useCallback(() => {
    fetch("/api/admin/pickup-deliveries").then((r) => r.json()).then((d) => setList(d.deliveries || [])).catch(() => setList([]));
    fetch("/api/admin/riders").then((r) => r.json()).then((d) => setRiders((d.riders || []).filter((r: any) => r.status === "approved"))).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    setPrice(null);
    if (!dest) return;
    const from = origin.deliveryMode === "out_of_town" ? (origin.destBranchId ? { destBranchId: origin.destBranchId } : null) : Number.isFinite(origin.originLat) ? { originLat: origin.originLat, originLng: origin.originLng } : null;
    if (!from) return;
    fetch("/api/pickup/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...from, destLat: dest.lat, destLng: dest.lng }) })
      .then((r) => r.json()).then((d) => d.fee && setPrice(d)).catch(() => {});
  }, [origin, dest]);

  async function create() {
    setErr("");
    const res = await fetch("/api/admin/pickup-deliveries", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...origin, value: Number(form.value || 0), fee: form.fee ? Number(form.fee) : 0, destLat: dest?.lat, destLng: dest?.lng }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "That didn't go through."); return; }
    setMade({ ...d, client: form.senderName, phone: form.senderPhone, title: form.title });
    setOpen(false); setForm(BLANK); setDest(null); load();
  }
  const copy = async (text: string, key: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 2000); } catch {} };
  const waMsg = (m: any) => `Hello ${String(m.client || "").split(" ")[0]}, your Pickup delivery "${m.title}" is ready. Pay ${money(m.fee)} here and the rider is sent: ${m.link}`;
  const ready = form.title.trim() && originReady(origin) && dest && form.destLandmark.trim().length >= 3 && form.recipientName.trim() && form.recipientPhone.length >= 9 && form.senderName.trim() && form.senderPhone.length >= 9;

  return (
    <div className="fade-up stack" style={{ gap: 14 }}>
      {made && (
        <div className="card card-pad card-mint">
          <h2 className="section-title">Delivery created: send the client the payment link</h2>
          <p className="hint" style={{ margin: "4px 0 10px" }}>{made.client} pays {money(made.fee)} ({made.km} km). Once paid, {made.riderName || "the rider you chose (or the closest free rider)"} is sent.</p>
          <p className="num" style={{ overflowWrap: "anywhere", fontSize: 13.5, marginBottom: 10 }}>{made.link}</p>
          <div className="btn-row">
            <a className="btn btn-primary btn-sm" href={`https://wa.me/${intlDigits(made.phone)}?text=${encodeURIComponent(waMsg(made))}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Send on WhatsApp</a>
            <button className="btn btn-secondary btn-sm" onClick={() => copy(made.link, "made")}><Copy size={15} /> {copied === "made" ? "Copied" : "Copy link"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMade(null)}>Close</button>
          </div>
        </div>
      )}

      {!open && <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => { setOpen(true); setErr(""); }}><Plus size={16} /> Create a delivery for a client</button>}
      {open && (
        <div className="card card-pad stack" style={{ gap: 12 }}>
          <h2 className="section-title">New delivery for a client</h2>
          <p className="hint">The client gets a link to pay the delivery price. Nothing happens until they pay; then the rider you choose is sent (or the closest free one if they're busy).</p>
          {err && <div className="notice notice-danger" role="alert">{err}</div>}
          <div className="form-grid-2">
            <div className="field"><label className="label" htmlFor="ad-title">What is it?</label><input id="ad-title" className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Fridge, LG 200 L" /></div>
            <div className="field"><label className="label" htmlFor="ad-value">Value (FCFA)</label><input id="ad-value" className="input num" inputMode="numeric" value={form.value} onChange={(e) => set("value", e.target.value)} /></div>
          </div>
          <div className="field"><span className="label">From</span><OriginPicker value={origin} onChange={setOrigin} who="sender" idPrefix="ad" /></div>
          <div className="field">
            <span className="label">To</span>
            <PlaceSearch city={origin.deliveryMode === "same_city" ? origin.originCity : undefined} onPick={(p) => { setDest({ lat: p.lat, lng: p.lng }); if (!form.destLandmark.trim()) set("destLandmark", p.name); }} />
            <PickupMap height={220} pick={dest} onPick={setDest} />
            <input className="input" placeholder="Landmark, for example: Bonapriso, behind Santa Lucia" aria-label="Delivery landmark" value={form.destLandmark} onChange={(e) => set("destLandmark", e.target.value)} />
          </div>
          <div className="form-grid-2">
            <div className="field"><label className="label" htmlFor="ad-rn">Receiver&apos;s name</label><input id="ad-rn" className="input" value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="ad-rp">Receiver&apos;s phone</label><PhoneField id="ad-rp" value={form.recipientPhone} onChange={(v) => set("recipientPhone", v)} /></div>
            <div className="field"><label className="label" htmlFor="ad-sn">Client (who pays)</label><input id="ad-sn" className="input" value={form.senderName} onChange={(e) => set("senderName", e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="ad-sp">Client&apos;s phone</label><PhoneField id="ad-sp" value={form.senderPhone} onChange={(v) => set("senderPhone", v)} /></div>
            <div className="field"><label className="label" htmlFor="ad-se">Client&apos;s email (optional)</label><input id="ad-se" className="input" type="email" value={form.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} /></div>
            <div className="field">
              <label className="label" htmlFor="ad-rider">Rider</label>
              <select id="ad-rider" className="select" value={form.riderId} onChange={(e) => set("riderId", e.target.value)}>
                <option value="">Closest free rider when paid</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.name}, {r.city}{r.active_trade ? " (busy now)" : r.available ? "" : " (off)"}, carries up to {money(r.max_value)}{Number(form.value || 0) > r.max_value ? " (over limit)" : ""}</option>)}
              </select>
              {(() => { const r = riders.find((x) => x.id === form.riderId); return r && Number(form.value || 0) > r.max_value
                ? <p className="hint" style={{ color: "var(--amber-ink, #8a5a00)" }}>{r.name}&apos;s balance only covers {money(r.max_value)}. They&apos;ll still get it if they&apos;re free when the client pays; if it&apos;s lost, Zola carries the difference.</p> : null; })()}
            </div>
          </div>
          <div className="form-grid-2">
            <div className="field"><span className="label">Price by distance</span><p className="num" style={{ fontWeight: 700, color: "var(--navy)", paddingTop: 8 }}>{price ? `${money(price.fee)} (${price.km} km)` : "Mark both places"}</p></div>
            <div className="field"><label className="label" htmlFor="ad-fee">Your price instead (optional)</label><input id="ad-fee" className="input num" inputMode="numeric" placeholder="For example 15000 for a fridge" value={form.fee} onChange={(e) => set("fee", e.target.value)} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={!ready} onClick={create}>Create and get the payment link</button>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{["Created", "Parcel", "From → to", "City", "Price", "Rider", "Status", ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>
              {(list || []).map((d) => (
                <Fragment key={d.id}>
                <tr>
                  <td className="hint num" suppressHydrationWarning>{fmtDateTime(d.created_at)}</td>
                  <td className="strong">{d.title}<p className="hint">{d.kind === "direct" ? (d.created_by === "admin" ? "Created by admin" : "Booked on Pickup") : "Zola order"} · {d.mode === "same_city" ? "same city" : "by agency"}</p></td>
                  <td>{d.sender} → {d.recipient}</td>
                  <td>{d.city}</td>
                  <td className="num">{d.fee ? money(d.fee) : "—"}</td>
                  <td>{d.rider_name || "—"}{d.over_limit && <p className="hint">over their limit</p>}</td>
                  <td><Pill tone={d.status === "delivered" ? "ok" : d.status === "awaiting_payment" || d.status === "waiting_rider" ? "wait" : "info"}>{DELIVERY_STATUS[d.status as DeliveryStatus]?.label || d.status}</Pill></td>
                  <td>
                    <div className="btn-row" style={{ flexWrap: "nowrap" }}>
                      {d.trade_id ? <a href={`/trade/${d.trade_id}`}>Open</a>
                        : d.link ? <button className="btn btn-secondary btn-sm" onClick={() => copy(d.link, d.id)}><Copy size={14} /> {copied === d.id ? "Copied" : d.status === "awaiting_payment" ? "Payment link" : "Link"}</button> : null}
                      {["waiting_rider", "assigned"].includes(d.status) && <button className="btn btn-secondary btn-sm" onClick={() => setAssigning(assigning === d.id ? "" : d.id)}>{d.rider_name ? "Change rider" : "Assign rider"}</button>}
                    </div>
                  </td>
                </tr>
                {assigning === d.id && (
                  <tr><td colSpan={8}><AssignRider id={d.id} status={d.status} riderName={d.rider_name} onDone={() => { setAssigning(""); load(); }} /></td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {list && list.length === 0 && <p className="empty empty-text">No deliveries yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Riders() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [adj, setAdj] = useState<{ id: string; name: string } | null>(null);
  const [adjForm, setAdjForm] = useState({ amount: "", note: "" });
  const [adding, setAdding] = useState(false);
  const [nr, setNr] = useState({ name: "", phone: "", email: "", city: "", noLimit: true });
  const [nrBase, setNrBase] = useState<{ lat: number; lng: number } | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [link, setLink] = useState<{ name: string; phone: string; link: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  useEffect(() => { fetch("/api/pickup/cities").then((r) => r.json()).then((d) => setCities(d.cities || [])).catch(() => {}); }, []);
  const load = useCallback(() => { fetch("/api/admin/riders").then((r) => r.json()).then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: any = {}) {
    setErr("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "That didn't go through. Please try again."); return false; }
    load(); return d;
  }
  async function addRider() {
    const d = await post("/api/admin/riders", { ...nr, baseLat: nrBase?.lat, baseLng: nrBase?.lng });
    if (d) { setLink(d); setAdding(false); setNr({ name: "", phone: "", email: "", city: "", noLimit: true }); setNrBase(null); }
  }
  async function newLink(id: string) { const d = await post(`/api/admin/riders/${id}`, { action: "setup_link" }); if (d) setLink(d); }
  const linkMsg = (l: any) => `Hello ${String(l.name).split(" ")[0]}, Zola has made you a Pickup rider. Open this link to set your password and start delivering: ${l.link}`;

  if (!data) return <div className="card empty"><span className="spinner" /></div>;
  const riders: any[] = data.riders || [];
  const pendingW = (data.withdrawals || []).filter((w: any) => w.status === "pending");
  const ago = (iso?: string) => {
    if (!iso) return "never";
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDateTime(iso);
  };

  return (
    <div className="fade-up stack" style={{ gap: 14 }}>
      <p className="hint">Riders sign up themselves at <a href={pickupUrl()} target="_blank" rel="noopener noreferrer">{pickupUrl().replace(/^https?:\/\//, "")}</a>. Check their national ID in person before approving. A rider can carry parcels worth up to 70% of their balance, one at a time. You can still assign a parcel over that limit from Deliveries (Assign rider) or the transaction page. Riders you add yourself can have no limit at all.</p>
      {err && <div className="notice notice-danger" role="alert">{err}</div>}

      {link && (
        <div className="card card-pad card-mint">
          <h2 className="section-title">Send {link.name} their link</h2>
          <p className="hint" style={{ margin: "4px 0 10px" }}>They open it to set their password, then sign in with their number. It works once, for 7 days. Anyone with this link can take over the account, so send it only to them.</p>
          <p className="num" style={{ overflowWrap: "anywhere", fontSize: 13.5, marginBottom: 10 }}>{link.link}</p>
          <div className="btn-row">
            <a className="btn btn-primary btn-sm" href={`https://wa.me/${intlDigits(link.phone)}?text=${encodeURIComponent(linkMsg(link))}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Send on WhatsApp</a>
            <button className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link.link); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); } catch {} }}><Copy size={15} /> {copiedLink ? "Copied" : "Copy link"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLink(null)}>Close</button>
          </div>
        </div>
      )}

      {!adding && <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => { setAdding(true); setErr(""); }}><Plus size={16} /> Add a rider</button>}
      {adding && (
        <div className="card card-pad stack" style={{ gap: 12 }}>
          <h2 className="section-title">Add a rider</h2>
          <p className="hint">For people you trust, such as your own staff. They are approved straight away. You get a link to send them: they open it, choose a password, and they&apos;re in.</p>
          <div className="form-grid-2">
            <div className="field"><label className="label" htmlFor="nr-name">Full name</label><input id="nr-name" className="input" value={nr.name} onChange={(e) => setNr((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="field"><label className="label" htmlFor="nr-phone">WhatsApp number</label><PhoneField id="nr-phone" value={nr.phone} onChange={(v) => setNr((f) => ({ ...f, phone: v }))} /></div>
            <div className="field"><label className="label" htmlFor="nr-email">Email (optional)</label><input id="nr-email" className="input" type="email" value={nr.email} onChange={(e) => setNr((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="field">
              <label className="label" htmlFor="nr-city">City</label>
              <input id="nr-city" className="input" list="nr-cities" value={nr.city} onChange={(e) => setNr((f) => ({ ...f, city: e.target.value }))} placeholder="Douala" />
              <datalist id="nr-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" checked={nr.noLimit} onChange={(e) => setNr((f) => ({ ...f, noLimit: e.target.checked }))} style={{ marginTop: 3 }} />
            <span><strong>No balance limit.</strong> <span className="hint">They don&apos;t top up and can be given any parcel, whatever its value. If a parcel is lost, Zola carries the loss.</span></span>
          </label>
          <div className="field">
            <span className="label">Where they usually start from (optional)</span>
            <PlaceSearch city={nr.city || undefined} onPick={(p) => setNrBase({ lat: p.lat, lng: p.lng })} />
            <PickupMap height={180} pick={nrBase} onPick={setNrBase} />
            <p className="hint">Used to find the closest rider until their phone shares its location.</p>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={nr.name.trim().length < 2 || nr.phone.length < 9 || !nr.city.trim()} onClick={addRider}>Add and get their link</button>
            <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {pendingW.length > 0 && (
        <div className="card card-pad card-wait">
          <h2 className="section-title" style={{ marginBottom: 8 }}>Rider withdrawals to send ({pendingW.length})</h2>
          {pendingW.map((w: any) => (
            <div key={w.id} className="kv" style={{ alignItems: "center" }}>
              <span><strong>{w.rider_name}</strong>: {money(w.amount)} to {w.network === "orange" ? "Orange Money" : "MTN"}, +237{w.phone}</span>
              <button className="btn btn-primary btn-sm" onClick={() => post(`/api/admin/rider-withdrawals/${w.id}`)}><Banknote size={15} /> Send payout</button>
            </div>
          ))}
        </div>
      )}

      {adj && (
        <div className="card card-pad">
          <h2 className="section-title">Change {adj.name}&apos;s balance</h2>
          <p className="hint" style={{ margin: "2px 0 10px" }}>Use a minus sign to take money off, for example -3500 for a lost parcel. The rider sees the reason in their history.</p>
          <div className="form-grid-2" style={{ marginBottom: 10 }}>
            <input className="input num" placeholder="-3500" aria-label="Amount" value={adjForm.amount} onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))} />
            <input className="input" placeholder="Reason" aria-label="Reason" value={adjForm.note} onChange={(e) => setAdjForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary btn-sm" onClick={async () => { if (await post(`/api/admin/riders/${adj.id}`, { action: "adjust", amount: Number(adjForm.amount), note: adjForm.note })) { setAdj(null); setAdjForm({ amount: "", note: "" }); } }}>Save</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAdj(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{["Rider", "City", "Status", "Balance", "Can carry", "Now", "Last seen", ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>
              {riders.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{r.name}<p className="hint num">+237{r.phone}</p>{r.no_limit && <Pill tone="info">No limit</Pill>}{r.needs_setup && <p className="hint">Hasn&apos;t set a password yet</p>}</td>
                  <td>{r.city}</td>
                  <td><Pill tone={r.status === "approved" ? (r.available ? "ok" : "muted") : r.status === "pending" ? "wait" : "danger"}>{r.status === "approved" ? (r.available ? "Available" : "Off") : r.status === "pending" ? "To approve" : "Suspended"}</Pill></td>
                  <td className="num">{money(r.balance)}</td>
                  <td className="num">{r.no_limit ? "Anything" : money(r.max_value)}</td>
                  <td>{r.active_trade ? <a href={String(r.active_trade).startsWith("pkd_") ? "/admin?tab=deliveries" : `/trade/${r.active_trade}`}>Delivering</a> : "Free"}</td>
                  <td className="hint" suppressHydrationWarning>{ago(r.loc_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {r.status !== "approved" && <button className="btn btn-primary btn-sm" onClick={() => post(`/api/admin/riders/${r.id}`, { action: "approve" })}><CheckCircle size={14} /> Approve</button>}
                      {r.status === "approved" && <button className="btn btn-danger-outline btn-sm" onClick={() => { if (confirm(`Suspend ${r.name}?`)) post(`/api/admin/riders/${r.id}`, { action: "suspend" }); }}><Ban size={14} /> Suspend</button>}
                      <button className="btn btn-secondary btn-sm" onClick={() => { setAdj({ id: r.id, name: r.name }); setAdjForm({ amount: "", note: "" }); }}>Balance</button>
                      {r.status === "approved" && <button className="btn btn-secondary btn-sm" onClick={() => { if (r.no_limit || confirm(`Remove ${r.name}'s balance limit? They will be given any parcel, whatever its value, and Zola carries the loss if one is lost.`)) post(`/api/admin/riders/${r.id}`, { action: "limit", noLimit: !r.no_limit }); }}>{r.no_limit ? "Add limit back" : "No limit"}</button>}
                      <button className="btn btn-ghost btn-sm" title="A new link to set or reset their password" onClick={() => newLink(r.id)}>Password link</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {riders.length === 0 && <p className="empty empty-text">No riders yet. Share {pickupUrl().replace(/^https?:\/\//, "")} with the people you want to deliver for you.</p>}
        </div>
      </div>
    </div>
  );
}

const EMPTY = { agency: "", name: "", city: "", address: "", lat: "", lng: "" };

function Agencies() {
  const [list, setList] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => { fetch("/api/admin/branches").then((r) => r.json()).then((d) => setList(d.branches || [])).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  const pin = form.lat !== "" && form.lng !== "" ? { lat: Number(form.lat), lng: Number(form.lng) } : null;

  async function save() {
    setErr("");
    const res = await fetch(editing ? `/api/admin/branches/${editing}` : "/api/admin/branches", {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, lat: Number(form.lat), lng: Number(form.lng) }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "That didn't go through."); return; }
    setForm(EMPTY); setEditing(null); setOpen(false); load();
  }
  async function toggle(b: any) {
    await fetch(`/api/admin/branches/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !b.active }) });
    load();
  }

  return (
    <div className="fade-up stack" style={{ gap: 14 }}>
      <p className="hint">Sellers choose one of these branches when they create a transaction. Pickup gives the parcel to the closest free rider to the branch, so put each branch exactly on the map.</p>
      {!open && <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => { setOpen(true); setEditing(null); setForm(EMPTY); }}><Plus size={16} /> Add a branch</button>}
      {open && (
        <div className="card card-pad stack" style={{ gap: 12 }}>
          <h2 className="section-title">{editing ? "Edit branch" : "Add a branch"}</h2>
          {err && <div className="notice notice-danger" role="alert">{err}</div>}
          <div className="form-grid-2">
            {[["agency", "Agency", "Touristique Express"], ["name", "Branch", "Mvan"], ["city", "City", "Yaoundé"], ["address", "Address or landmark", "Near the Mvan roundabout"]].map(([k, l, ph]) => (
              <div key={k} className="field">
                <label className="label" htmlFor={`b-${k}`}>{l}</label>
                <input id={`b-${k}`} className="input" placeholder={ph} value={form[k]} onChange={(e) => setForm((f: any) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="field">
            <span className="label">Where it is</span>
            <p className="hint">Tap the map on the branch, or stand at the branch and press Use my location.</p>
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }}
              onClick={() => navigator.geolocation?.getCurrentPosition((p) => setForm((f: any) => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })))}>
              <LocateFixed size={15} /> Use my location
            </button>
            <PlaceSearch city={form.city} onPick={(p) => setForm((f: any) => ({ ...f, lat: String(p.lat), lng: String(p.lng), address: f.address || p.name }))} />
            <PickupMap height={240} pick={pin} onPick={(p) => setForm((f: any) => ({ ...f, lat: String(p.lat), lng: String(p.lng) }))} />
            <div className="form-grid-2">
              <input className="input num" aria-label="Latitude" placeholder="Latitude" value={form.lat} onChange={(e) => setForm((f: any) => ({ ...f, lat: e.target.value }))} />
              <input className="input num" aria-label="Longitude" placeholder="Longitude" value={form.lng} onChange={(e) => setForm((f: any) => ({ ...f, lng: e.target.value }))} />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save branch</button>
            <button className="btn btn-secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{["City", "Agency", "Branch", "Address", "", ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>
              {(list || []).map((b) => (
                <tr key={b.id} style={b.active ? undefined : { opacity: 0.55 }}>
                  <td>{b.city}</td><td className="strong">{b.agency}</td><td>{b.name}</td><td className="hint">{b.address}</td>
                  <td>{b.active ? <Pill tone="ok">In use</Pill> : <Pill tone="muted">Off</Pill>}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(b.id); setOpen(true); setForm({ agency: b.agency, name: b.name, city: b.city, address: b.address || "", lat: String(b.lat), lng: String(b.lng) }); }}><Pencil size={14} /> Edit</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggle(b)}>{b.active ? "Switch off" : "Switch on"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list && list.length === 0 && <p className="empty empty-text">No branches yet. Until you add one, sellers arrange delivery with customer service as before.</p>}
        </div>
      </div>
    </div>
  );
}
