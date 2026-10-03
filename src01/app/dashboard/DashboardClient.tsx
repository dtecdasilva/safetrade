"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, X, Banknote, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";

const STATUS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Awaiting payment", color: "#f59e0b" },
  funds_held:      { label: "Funds held",       color: "#3b82f6" },
  shipped:         { label: "Shipped",           color: "#8b5cf6" },
  delivered:       { label: "Delivered",         color: "#14b8a6" },
  pending_release: { label: "Pending release",   color: "#f59e0b" },
  complete:        { label: "Complete",          color: "#22c55e" },
  disputed:        { label: "Disputed",          color: "#ef4444" },
  cancelled:       { label: "Cancelled",         color: "#555"    },
};

const W_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b" },
  sent:     { label: "Sent",     color: "#22c55e" },
  rejected: { label: "Rejected", color: "#ef4444" },
};

const NETWORKS = ["MTN Mobile Money", "Orange Money"];

export default function DashboardClient({ session, trades }: { session: any; trades: any[] }) {
  const [search, setSearch]           = useState("");
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showW, setShowW]             = useState(false);
  const [wForm, setWForm]             = useState({ amount: "", phone: "", network: NETWORKS[0] });
  const [wError, setWError]           = useState("");
  const [wLoading, setWLoading]       = useState(false);
  const [wSuccess, setWSuccess]       = useState(false);
  const [wHistory, setWHistory]       = useState(false);
  const isVendor = session.role === "vendor";

  const loadW = () => {
    if (!isVendor) return;
    fetch("/api/withdrawals").then(r => r.json()).then(d => setWithdrawals(d.withdrawals || []));
  };
  useEffect(() => { loadW(); }, [isVendor]);

  const active    = trades.filter(t => !["complete","cancelled"].includes(t.status));
  const completed = trades.filter(t => t.status === "complete");
  const escrow    = active.filter(t => t.status !== "pending_payment").reduce((s,t) => s + t.amount, 0);
  const released  = isVendor ? completed.reduce((s:number,t:any) => s + t.amount, 0) : 0;
  const pending   = active.filter(t => t.status === "pending_release").length;
  const hasPendingW = withdrawals.some(w => w.status === "pending");

  const q = search.toLowerCase().trim();
  const filtered = q ? trades.filter(t =>
    t.title?.toLowerCase().includes(q) || t.id?.toLowerCase().includes(q) ||
    t.buyer_name?.toLowerCase().includes(q) || t.vendor_name?.toLowerCase().includes(q) ||
    t.status?.toLowerCase().includes(q) || String(t.amount).includes(q)
  ) : null;

  async function submitW() {
    setWError(""); setWLoading(true);
    try {
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(wForm.amount), phone: wForm.phone, network: wForm.network }) });
      const data = await res.json();
      if (!res.ok) { setWError(data.error); return; }
      setWSuccess(true); setShowW(false); setWForm({ amount: "", phone: "", network: NETWORKS[0] });
      loadW(); setTimeout(() => setWSuccess(false), 5000);
    } catch { setWError("Something went wrong"); }
    finally { setWLoading(false); }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "#0c0c0c", border: "1px solid #242424", borderRadius: 8, color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const canW = !wLoading && !hasPendingW && !!wForm.amount && !!wForm.phone && Number(wForm.amount) >= 1 && wForm.phone.length >= 8;

  const showActive    = filtered ?? active;
  const showCompleted = filtered ? [] : completed;

  return (
    <div style={{ background: "#0c0c0c", minHeight: "100vh" }}>
      <Navbar user={{ name: session.name, role: session.role }} />
      <style>{`
        @keyframes fade-up { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fade-up 0.2s ease forwards; }
        .trade-card:hover { background: #181818 !important; }
        .trade-card { transition: background 0.15s; }
        input:focus { border-color: #22c55e !important; }
      `}</style>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, color: "#555", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              {isVendor ? "Vendor" : "Buyer"} dashboard
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.03em", margin: 0 }}>
              Hello, {session.name.split(" ")[0]}
            </h1>
          </div>
          {isVendor && (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/trade/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#22c55e", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                <Plus size={14} /> New trade
              </Link>
              <button onClick={() => { setShowW(o => !o); setWError(""); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#141414", color: "#888", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1px solid #242424", cursor: "pointer", fontFamily: "inherit" }}>
                <Banknote size={14} /> Withdraw
              </button>
            </div>
          )}
        </div>

        {/* Success toast */}
        {wSuccess && (
          <div style={{ background: "#141414", border: "1px solid #22c55e", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#22c55e" }}>
            <CheckCircle size={14} /> Withdrawal request sent. The admin will process it shortly.
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
          {[
            isVendor
              ? { label: "Released", value: `FCFA ${released.toLocaleString()}` }
              : { label: "In escrow", value: `FCFA ${escrow.toLocaleString()}` },
            { label: isVendor ? "Pending release" : "Active trades", value: isVendor ? String(pending) : String(active.length) },
            { label: "Completed", value: String(completed.length) },
          ].map((s,i) => (
            <div key={i} className="fade-up" style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", animationDelay: `${i*0.05}s` }}>
              <p style={{ fontSize: 11, color: "#555", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#f0f0f0", margin: 0, fontFamily: "monospace", letterSpacing: "-0.02em" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {pending > 0 && (
          <div style={{ background: "#141414", border: "1px solid #2a2000", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#f59e0b" }}>
            <Clock size={14} /> {pending} trade{pending > 1 ? "s" : ""} confirmed — waiting for admin to release funds
          </div>
        )}

        {/* Withdraw form */}
        {isVendor && showW && (
          <div className="fade-up" style={{ background: "#141414", border: "1px solid #242424", borderRadius: 10, padding: "20px", marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: "0 0 4px" }}>Withdraw funds</p>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px" }}>The admin will send the amount to your mobile money number.</p>

            {wError && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{wError}</div>}
            {hasPendingW && <div style={{ background: "#141414", border: "1px solid #2a2000", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#f59e0b", marginBottom: 12, display: "flex", gap: 6 }}><Clock size={13} /> You have a pending withdrawal already.</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 }}>Amount (FCFA)</label>
                <input style={inp} type="number" min="1" placeholder="0" value={wForm.amount} disabled={hasPendingW}
                  onChange={e => setWForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 }}>Phone number</label>
                <div style={{ display: "flex", background: "#0c0c0c", border: "1px solid #242424", borderRadius: 8, overflow: "hidden" }}>
                  <span style={{ padding: "0 10px", display: "flex", alignItems: "center", borderRight: "1px solid #242424", color: "#555", fontSize: 12, fontFamily: "monospace", background: "#141414", flexShrink: 0 }}>+237</span>
                  <input type="tel" placeholder="6XXXXXXXX" value={wForm.phone} disabled={hasPendingW}
                    onChange={e => setWForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"").slice(0,9) }))}
                    style={{ flex: 1, height: 38, padding: "0 10px", background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 13, fontFamily: "monospace" }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 6, fontWeight: 500 }}>Network</label>
              <div style={{ display: "flex", gap: 8 }}>
                {NETWORKS.map(n => (
                  <button key={n} onClick={() => !hasPendingW && setWForm(f => ({ ...f, network: n }))}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", border: `1px solid ${wForm.network === n ? "#22c55e" : "#242424"}`, background: wForm.network === n ? "rgba(34,197,94,0.08)" : "#0c0c0c", color: wForm.network === n ? "#22c55e" : "#555", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submitW} disabled={!canW}
                style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: canW ? "#22c55e" : "#1a1a1a", color: canW ? "#fff" : "#444", fontSize: 13, fontWeight: 600, cursor: canW ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {wLoading ? "Sending..." : "Request withdrawal"}
              </button>
              <button onClick={() => setShowW(false)}
                style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #242424", background: "transparent", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Withdrawal history */}
        {isVendor && withdrawals.length > 0 && (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
            <button onClick={() => setWHistory(o => !o)}
              style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase" }}>Withdrawals ({withdrawals.length})</span>
              {wHistory ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
            </button>
            {wHistory && (
              <div style={{ borderTop: "1px solid #1e1e1e" }}>
                {withdrawals.map(w => {
                  const ws = W_STATUS[w.status] || W_STATUS.pending;
                  return (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #1a1a1a", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: "0 0 1px", fontFamily: "monospace" }}>FCFA {Number(w.amount).toLocaleString()}</p>
                        <p style={{ fontSize: 11, color: "#555", margin: 0 }}>{w.network} · +237{w.phone} · {new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ws.color }}>{ws.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#444", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trades..."
            style={{ width: "100%", padding: "9px 36px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 8, color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex" }}><X size={13} /></button>}
        </div>

        {/* Filtered results */}
        {filtered && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"</p>
            {filtered.length === 0
              ? <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "32px", textAlign: "center" }}><p style={{ color: "#444", margin: 0, fontSize: 13 }}>No trades found</p></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{filtered.map(t => <TradeRow key={t.id} trade={t} role={session.role} />)}</div>
            }
          </div>
        )}

        {/* Active */}
        {!filtered && showActive.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Active</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{showActive.map(t => <TradeRow key={t.id} trade={t} role={session.role} />)}</div>
          </div>
        )}

        {/* Completed */}
        {!filtered && showCompleted.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#444", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Completed</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{showCompleted.map(t => <TradeRow key={t.id} trade={t} role={session.role} />)}</div>
          </div>
        )}

        {!filtered && trades.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <p style={{ fontSize: 14, marginBottom: 6 }}>No trades yet</p>
            {session.role === "buyer" && <p style={{ fontSize: 13 }}>A vendor will create a trade and notify you.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

function TradeRow({ trade, role }: { trade: any; role: string }) {
  const s             = STATUS[trade.status] || STATUS.cancelled;
  const counterparty  = role === "buyer" ? trade.vendor_name  : trade.buyer_name;
  const counterAvatar = role === "buyer" ? trade.vendor_avatar : trade.buyer_avatar;
  const label         = role === "buyer" ? "Vendor" : "Buyer";

  return (
    <Link href={`/trade/${trade.id}`} style={{ textDecoration: "none" }}>
      <div className="trade-card" style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Status dot */}
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trade.title}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: trade.status === "complete" ? "#555" : "#f0f0f0", fontFamily: "monospace", margin: 0, flexShrink: 0 }}>FCFA {Number(trade.amount).toLocaleString()}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 11, color: "#444", margin: 0 }}>{label}: {counterparty}</p>
            <span style={{ fontSize: 11, color: "#333" }}>·</span>
            <p style={{ fontSize: 11, color: s.color, margin: 0, fontWeight: 500 }}>{s.label}</p>
            {trade.delivery_deadline && !["complete","cancelled","disputed"].includes(trade.status) && (
              <>
                <span style={{ fontSize: 11, color: "#333" }}>·</span>
                <p style={{ fontSize: 11, color: "#444", margin: 0 }}>Due {new Date(trade.delivery_deadline).toLocaleDateString()}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
