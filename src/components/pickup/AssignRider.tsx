"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, UserCheck, UserX } from "lucide-react";
import { money } from "@/lib/zola";

/**
 * Admin: give a delivery to a rider. Every approved rider is listed, including
 * those whose balance is too low for the parcel's value (the admin can still
 * assign them, with a warning). Riders already carrying a parcel can't be chosen.
 */
export default function AssignRider({ id, status, riderName, onDone }: {
  id: string; status: string; riderName?: string; onDone: () => void;
}) {
  const [data, setData] = useState<{ amount: number; candidates: any[] } | null>(null);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!["waiting_rider", "assigned"].includes(status)) return;
    fetch(`/api/admin/deliveries/${encodeURIComponent(id)}`).then((r) => r.json()).then((d) => setData({ amount: d.amount || 0, candidates: d.candidates || [] })).catch(() => setData({ amount: 0, candidates: [] }));
  }, [id, status]);

  if (!["waiting_rider", "assigned"].includes(status)) return null;

  async function post(action: string, riderId?: string) {
    setMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/admin/deliveries/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, riderId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "That didn't go through. Please try again."); return; }
      if (action === "auto" && !d.rider) setMsg("No free rider with enough balance yet. Choose one below to assign anyway.");
      setPick(""); onDone();
    } finally { setBusy(false); }
  }

  const chosen = data?.candidates.find((c) => c.id === pick);
  const label = (c: any) => [
    c.name,
    c.same_city ? "" : c.city,
    c.km !== null ? `${c.km} km away` : "",
    c.busy ? "has a parcel" : !c.available ? "off" : "",
    c.can_carry ? "" : `balance covers up to ${money(c.max_value)}`,
  ].filter(Boolean).join(", ");

  return (
    <div className="stack" style={{ gap: 10, marginTop: 12 }}>
      <div className="btn-row">
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => post("auto")}><RefreshCw size={15} /> Find a free rider</button>
        {status === "assigned" && <button className="btn btn-danger-outline btn-sm" disabled={busy} onClick={() => post("unassign")}><UserX size={15} /> Take it back from {riderName}</button>}
      </div>
      {data && data.candidates.length > 0 && (
        <div className="pk-row">
          <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Choose a rider">
            <option value="">Choose a rider</option>
            {data.candidates.map((c) => <option key={c.id} value={c.id} disabled={c.busy}>{label(c)}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!pick || busy} onClick={() => post("assign", pick)}><UserCheck size={15} /> {chosen && !chosen.can_carry ? "Assign anyway" : "Assign"}</button>
        </div>
      )}
      {chosen && !chosen.can_carry && (
        <p className="notice notice-wait" style={{ display: "flex", gap: 8 }}><AlertTriangle size={16} style={{ flex: "none", marginTop: 2 }} />
          <span>{chosen.name}&apos;s balance only covers parcels up to {money(chosen.max_value)}, and this one is worth {money(data!.amount)}. If it gets lost, their balance won&apos;t cover it and Zola carries the difference.</span></p>
      )}
      {chosen && !chosen.available && !chosen.busy && <p className="hint">{chosen.name} is switched off in the app. Call them first to make sure they can go.</p>}
      {data && data.candidates.length === 0 && <p className="hint">No approved riders yet.</p>}
      {msg && <p role="alert" className="hint-error">{msg}</p>}
    </div>
  );
}
