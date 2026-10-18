"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Ban, Plus, Pencil, Banknote, LocateFixed } from "lucide-react";
import { Pill } from "@/components/ui";
import PickupMap from "@/components/pickup/Map";
import { fmtDateTime, money } from "@/lib/zola";
import { pickupUrl } from "@/lib/pickup/config";

/** Admin tabs for Pickup: riders (approve, balance, withdrawals) and agency branches. Admin screens stay in English. */
export default function AdminPickup({ tab }: { tab: "riders" | "agencies" }) {
  return tab === "riders" ? <Riders /> : <Agencies />;
}

function Riders() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [adj, setAdj] = useState<{ id: string; name: string } | null>(null);
  const [adjForm, setAdjForm] = useState({ amount: "", note: "" });
  const load = useCallback(() => { fetch("/api/admin/riders").then((r) => r.json()).then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: any = {}) {
    setErr("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "That didn't go through. Please try again."); return false; }
    load(); return true;
  }

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
      <p className="hint">Riders sign up at <a href={pickupUrl()} target="_blank" rel="noopener noreferrer">{pickupUrl().replace(/^https?:\/\//, "")}</a>. Check their national ID in person before approving. A rider can carry parcels worth up to 70% of their balance, one at a time.</p>
      {err && <div className="notice notice-danger" role="alert">{err}</div>}

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
                  <td className="strong">{r.name}<p className="hint num">+237{r.phone}</p></td>
                  <td>{r.city}</td>
                  <td><Pill tone={r.status === "approved" ? (r.available ? "ok" : "muted") : r.status === "pending" ? "wait" : "danger"}>{r.status === "approved" ? (r.available ? "Available" : "Off") : r.status === "pending" ? "To approve" : "Suspended"}</Pill></td>
                  <td className="num">{money(r.balance)}</td>
                  <td className="num">{money(r.max_value)}</td>
                  <td>{r.active_trade ? <a href={`/trade/${r.active_trade}`}>Delivering</a> : "Free"}</td>
                  <td className="hint" suppressHydrationWarning>{ago(r.loc_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {r.status !== "approved" && <button className="btn btn-primary btn-sm" onClick={() => post(`/api/admin/riders/${r.id}`, { action: "approve" })}><CheckCircle size={14} /> Approve</button>}
                      {r.status === "approved" && <button className="btn btn-danger-outline btn-sm" onClick={() => { if (confirm(`Suspend ${r.name}?`)) post(`/api/admin/riders/${r.id}`, { action: "suspend" }); }}><Ban size={14} /> Suspend</button>}
                      <button className="btn btn-secondary btn-sm" onClick={() => { setAdj({ id: r.id, name: r.name }); setAdjForm({ amount: "", note: "" }); }}>Balance</button>
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
