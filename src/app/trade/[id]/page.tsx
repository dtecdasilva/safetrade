"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle, AlertTriangle, Truck, ShieldCheck, RefreshCw, Edit3, Trash2, X, Save } from "lucide-react";

const STATUS: Record<string, { label: string; color: string; step: number }> = {
  pending_payment: { label: "Awaiting payment",  color: "#f59e0b", step: 1 },
  funds_held:      { label: "Funds held",        color: "#3b82f6", step: 2 },
  shipped:         { label: "Shipped",            color: "#8b5cf6", step: 3 },
  pending_release: { label: "Pending release",    color: "#f59e0b", step: 4 },
  complete:        { label: "Complete",           color: "#22c55e", step: 5 },
  disputed:        { label: "Disputed",           color: "#ef4444", step: 0 },
  cancelled:       { label: "Cancelled",          color: "#555",    step: 0 },
};

const EV_COLOR: Record<string, string> = { success: "#22c55e", info: "#3b82f6", warn: "#f59e0b", danger: "#ef4444" };
const STEPS = ["Payment", "Escrow", "Shipped", "Release", "Done"];
const NETWORKS = [
  { id: "mtn",    label: "MTN MoMo",     color: "#f59e0b" },
  { id: "orange", label: "Orange Money", color: "#f97316" },
];

export default function TradePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [user, setUser]   = useState<any>(null);
  const [trade, setTrade] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [error, setError]     = useState("");

  // Pay
  const [phone, setPhone]     = useState("");
  const [network, setNetwork] = useState<"mtn"|"orange"|"">("");

  // Notify
  const [notified, setNotified] = useState(false);

  // Edit
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({ title: "", description: "", amount: "", deliveryDays: "" });
  const [editErr, setEditErr]     = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const load = useCallback(async () => {
    const me = await (await fetch("/api/auth/me")).json();
    if (!me.user) { router.push("/auth/login"); return; }
    setUser(me.user);
    const res = await fetch(`/api/trades/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data = await res.json();
    setTrade(data.trade); setEvents(data.events || []); setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function act(action: string, extra: Record<string,any> = {}) {
    setActing(true); setError("");
    try {
      const res  = await fetch(`/api/trades/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      await load();
    } catch { setError("Something went wrong"); }
    finally { setActing(false); }
  }

  async function pay() {
    if (!phone.trim()) { setError("Enter your phone number"); return; }
    if (!network)      { setError("Select a network"); return; }
    setActing(true); setError("");
    try {
      const res  = await fetch(`/api/trades/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: phone, network }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Payment failed"); setActing(false); return; }
      const url  = data.payment_url || data.url || data.paymentUrl;
      if (url) window.location.href = url;
      else { await load(); setActing(false); }
    } catch { setError("Something went wrong"); setActing(false); }
  }

  async function notify() {
    const res = await fetch(`/api/trades/${id}/notify`, { method: "POST" });
    if (res.ok) setNotified(true);
  }

  async function saveEdit() {
    setEditErr(""); setEditSaving(true);
    try {
      const res  = await fetch(`/api/trades/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editForm.title, description: editForm.description, amount: Number(editForm.amount), deliveryDays: Number(editForm.deliveryDays) }) });
      const data = await res.json();
      if (!res.ok) { setEditErr(data.error); return; }
      setEditing(false); await load();
    } catch { setEditErr("Something went wrong"); }
    finally { setEditSaving(false); }
  }

  async function deleteTrade() {
    setDeleting(true);
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
    else { const d = await res.json(); setError(d.error); setDelConfirm(false); setDeleting(false); }
  }

  if (loading || !trade) return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #1e1e1e", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const s       = STATUS[trade.status] || STATUS.cancelled;
  const isAdmin  = user?.role === "admin";
  const isBuyer  = user?.id === trade.buyer_id;
  const isVendor = user?.id === trade.vendor_id;
  const canEdit  = isVendor && trade.status === "pending_payment";
  const step     = s.step;
  const selNet   = NETWORKS.find(n => n.id === network);
  const canPay   = phone.length >= 8 && !!network;
  const editFee  = Number(editForm.amount) ? parseFloat((Number(editForm.amount) * 0.015).toFixed(2)) : 0;

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "#0c0c0c", border: "1px solid #242424", borderRadius: 8, color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" as const };
  const sec: React.CSSProperties = { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "16px", marginBottom: 10 };

  return (
    <div style={{ background: "#0c0c0c", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fade-up 0.2s ease forwards; }
        input:focus { border-color: #22c55e !important; }
        textarea:focus { border-color: #22c55e !important; }
      `}</style>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555", fontSize: 13, textDecoration: "none", marginBottom: 24 }}>
          <ArrowLeft size={13} /> Back
        </Link>

        {/* Header */}
        <div className="fade-up" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: "#444", fontFamily: "monospace", marginBottom: 4 }}>
                {trade.id.slice(0,8).toUpperCase()}
              </p>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{trade.title}</h1>
              <span style={{ fontSize: 12, fontWeight: 500, color: s.color }}>{s.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {canEdit && !editing && (
                <>
                  <button onClick={() => { setEditForm({ title: trade.title, description: trade.description, amount: String(trade.amount), deliveryDays: String(trade.delivery_days || 7) }); setEditing(true); setEditErr(""); }}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #242424", background: "transparent", color: "#555", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "inherit" }}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button onClick={() => setDelConfirm(true)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "inherit" }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {step > 0 && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
              {STEPS.map((label, i) => {
                const n = i + 1;
                const done   = step > n;
                const active = step === n;
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "#22c55e" : active ? "rgba(34,197,94,0.15)" : "#1a1a1a", border: `1.5px solid ${done || active ? "#22c55e" : "#2a2a2a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: done ? "#fff" : active ? "#22c55e" : "#444" }}>
                        {done ? "✓" : n}
                      </div>
                      <span style={{ fontSize: 9, color: active ? "#22c55e" : done ? "#555" : "#333", whiteSpace: "nowrap", display: window?.innerWidth < 400 ? "none" : "block" }}>{label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1.5, background: done ? "#22c55e" : "#1e1e1e", margin: "0 4px", marginBottom: 14 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {delConfirm && (
          <div className="fade-up" style={{ ...sec, border: "1px solid rgba(239,68,68,0.2)" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", margin: "0 0 6px" }}>Delete trade?</p>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 14px" }}>This cannot be undone. The trade and all its events will be deleted.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={deleteTrade} disabled={deleting}
                style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setDelConfirm(false)}
                style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid #242424", background: "transparent", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="fade-up" style={{ ...sec, border: "1px solid #2e2e2e" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Edit trade</p>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 2, display: "flex" }}><X size={15} /></button>
            </div>
            {editErr && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{editErr}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 }}>Title</label>
                <input style={inp} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 }}>Description</label>
                <textarea style={{ ...inp, resize: "vertical" as const, lineHeight: 1.5 }} rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 }}>Amount (FCFA)</label>
                  <input style={inp} type="number" min="1" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 }}>Delivery days</label>
                  <input style={inp} type="number" min="1" max="60" value={editForm.deliveryDays} onChange={e => setEditForm(f => ({ ...f, deliveryDays: e.target.value }))} />
                </div>
              </div>
              {Number(editForm.amount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#0c0c0c", borderRadius: 7 }}>
                  <span style={{ fontSize: 12, color: "#555" }}>Buyer pays</span>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#f0f0f0" }}>FCFA {(Number(editForm.amount) + editFee).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEdit} disabled={editSaving}
                  style={{ flex: 1, padding: "9px", borderRadius: 7, border: "none", background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: editSaving ? 0.7 : 1 }}>
                  <Save size={13} /> {editSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)}
                  style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid #242424", background: "transparent", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* Trade info */}
        <div className="fade-up" style={sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <p style={{ fontSize: 24, fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace", margin: 0, letterSpacing: "-0.02em" }}>
              FCFA {Number(trade.amount).toLocaleString()}
            </p>
            <p style={{ fontSize: 12, color: "#444", margin: 0 }}>Fee: FCFA {Number(trade.fee).toLocaleString()}</p>
          </div>

          {trade.description && (
            <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, margin: "0 0 14px", padding: "10px", background: "#0c0c0c", borderRadius: 7 }}>
              {trade.description}
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Buyer",  val: trade.buyer_name },
              { label: "Vendor", val: trade.vendor_name },
            ].map(p => (
              <div key={p.label} style={{ padding: "10px 12px", background: "#0c0c0c", borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: "#444", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{p.label}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{p.val}</p>
              </div>
            ))}
          </div>

          {(trade.delivery_deadline || trade.tracking_number) && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {trade.delivery_deadline && <span style={{ fontSize: 11, color: "#555", background: "#0c0c0c", padding: "4px 8px", borderRadius: 5 }}>Due {new Date(trade.delivery_deadline).toLocaleDateString()}</span>}
              {trade.tracking_number && <span style={{ fontSize: 11, color: "#555", background: "#0c0c0c", padding: "4px 8px", borderRadius: 5 }}>Tracking: {trade.tracking_number}</span>}
            </div>
          )}
        </div>

        {/* Buyer: pay */}
        {isBuyer && trade.status === "pending_payment" && (
          <div className="fade-up" style={sec}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 4px" }}>Complete payment</p>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px" }}>
              Total to pay: <strong style={{ color: "#f0f0f0", fontFamily: "monospace" }}>FCFA {Number(trade.buyer_total || trade.amount).toLocaleString()}</strong>
            </p>

            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 6, fontWeight: 500 }}>Select network</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {NETWORKS.map(n => (
                <button key={n.id} onClick={() => setNetwork(n.id as "mtn"|"orange")}
                  style={{ padding: "10px", borderRadius: 8, border: `1.5px solid ${network === n.id ? n.color : "#242424"}`, background: network === n.id ? `${n.color}10` : "#0c0c0c", color: network === n.id ? n.color : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                  {n.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 6, fontWeight: 500 }}>
              {network ? (network === "mtn" ? "MTN" : "Orange") : "Mobile money"} number
            </label>
            <div style={{ display: "flex", background: "#0c0c0c", border: `1px solid ${selNet ? selNet.color + "50" : "#242424"}`, borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
              <span style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: `1px solid ${selNet ? selNet.color + "30" : "#242424"}`, color: "#444", fontSize: 12, fontFamily: "monospace", background: "#141414", flexShrink: 0 }}>+237</span>
              <input type="tel" placeholder="6XXXXXXXX" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,9))}
                style={{ flex: 1, height: 40, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 14, fontFamily: "monospace" }} />
            </div>

            <button onClick={pay} disabled={!canPay || acting}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: canPay ? (selNet?.color || "#22c55e") : "#1a1a1a", color: canPay ? "#fff" : "#444", fontSize: 14, fontWeight: 600, cursor: canPay ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: acting ? 0.7 : 1 }}>
              {acting
                ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Redirecting...</>
                : <><ShieldCheck size={14} /> {!network ? "Select a network" : `Pay via ${selNet?.label}`}</>
              }
            </button>
          </div>
        )}

        {/* Buyer: confirm/dispute */}
        {isBuyer && ["shipped","funds_held"].includes(trade.status) && (
          <div className="fade-up" style={sec}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: "0 0 12px" }}>Received your item?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => act("confirm")} disabled={acting}
                style={{ flex: 1, padding: "9px", borderRadius: 7, border: "none", background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle size={13} /> Confirm delivery
              </button>
              <button onClick={() => act("dispute")} disabled={acting}
                style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} /> Dispute
              </button>
            </div>
          </div>
        )}

        {/* Status messages */}
        {isBuyer && trade.status === "pending_release" && <StatusMsg color="#f59e0b" text="Delivery confirmed — admin will release funds shortly." />}
        {isBuyer && trade.status === "complete"        && <StatusMsg color="#22c55e" text="Trade complete. Funds have been released to the vendor." />}
        {isBuyer && trade.status === "disputed"        && <StatusMsg color="#ef4444" text="Dispute open. SafeTrade is reviewing this trade." />}

        {/* Vendor: pending payment */}
        {isVendor && trade.status === "pending_payment" && (
          <div className="fade-up" style={sec}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: "0 0 4px" }}>Waiting for buyer</p>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 12px" }}>The buyer hasn't paid yet.</p>
            <button onClick={notify} style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid #242424", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={13} /> Resend notification
            </button>
            {notified && <p style={{ fontSize: 12, color: "#22c55e", margin: "8px 0 0" }}>Notification resent.</p>}
          </div>
        )}

        {/* Vendor: ship */}
        {isVendor && trade.status === "funds_held" && (
          <div className="fade-up" style={sec}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: "0 0 4px" }}>Ready to ship</p>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 12px" }}>Funds are secured. Ship the item and click below.</p>
            <button onClick={() => act("ship", { trackingNumber: "" })} disabled={acting}
              style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: "#8b5cf6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <Truck size={13} /> {acting ? "Marking..." : "Mark as shipped"}
            </button>
          </div>
        )}

        {isVendor && trade.status === "shipped"         && <StatusMsg color="#8b5cf6" text="Marked as shipped. Waiting for buyer to confirm delivery." />}
        {isVendor && trade.status === "pending_release" && <StatusMsg color="#f59e0b" text="Buyer confirmed delivery. Admin will release your funds shortly." />}
        {isVendor && trade.status === "complete"        && <StatusMsg color="#22c55e" text="Trade complete. Funds have been released to you." />}

        {/* Admin release */}
        {isAdmin && trade.status === "pending_release" && (
          <div className="fade-up" style={{ ...sec, border: "1px solid rgba(245,158,11,0.2)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", margin: "0 0 4px" }}>Action required</p>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 12px" }}>Buyer confirmed delivery. Release FCFA {Number(trade.amount).toLocaleString()} to {trade.vendor_name}.</p>
            <button onClick={async () => { setActing(true); await fetch(`/api/admin/release/${id}`, { method: "POST" }); await load(); setActing(false); }} disabled={acting}
              style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={13} /> {acting ? "Releasing..." : "Release funds"}
            </button>
          </div>
        )}

        {/* Timeline */}
        <div className="fade-up" style={{ ...sec, marginTop: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>Timeline</p>
          {events.length === 0 && <p style={{ fontSize: 13, color: "#444", margin: 0 }}>No events yet.</p>}
          {events.map((ev, i) => {
            const c = EV_COLOR[ev.type] || "#3b82f6";
            return (
              <div key={ev.id} style={{ display: "flex", gap: 12, position: "relative" }}>
                {i < events.length - 1 && <div style={{ position: "absolute", left: 5, top: 18, width: 1, height: "calc(100% - 4px)", background: "#1e1e1e" }} />}
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: c, flexShrink: 0, marginTop: 4 }} />
                <div style={{ paddingBottom: 18, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", margin: "0 0 1px" }}>{ev.label}</p>
                  <p style={{ fontSize: 12, color: "#555", margin: "0 0 2px" }}>{ev.detail}</p>
                  <p style={{ fontSize: 11, color: "#333", fontFamily: "monospace", margin: 0 }}>{new Date(ev.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatusMsg({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ background: "#141414", border: `1px solid ${color}20`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 13, color, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} /> {text}
    </div>
  );
}
