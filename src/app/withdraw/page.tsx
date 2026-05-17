"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Banknote, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, ArrowLeft, TrendingUp } from "lucide-react";
import Link from "next/link";

const NETWORKS = [
  { id: "MTN Mobile Money",  label: "MTN Mobile Money", emoji: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" },
  { id: "Orange Money",      label: "Orange Money",     emoji: "🟠", color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)" },
];

const W_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  sent:     { label: "Sent ✓",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
};

export default function WithdrawPage() {
  const router = useRouter();
  const [user, setUser]               = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [balance, setBalance]         = useState<{ available: number; totalEarned: number; totalWithdrawn: number } | null>(null);
  const [form, setForm]               = useState({ amount: "", phone: "", network: NETWORKS[0].id });
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user) { router.push("/auth/login"); return; }
    if (meData.user.role !== "vendor") { router.push("/dashboard"); return; }
    setUser(meData.user);

    const [wRes, balRes] = await Promise.all([
      fetch("/api/withdrawals"),
      fetch("/api/withdrawals/balance"),
    ]);
    const wData   = await wRes.json();
    const balData = await balRes.json();
    setWithdrawals(wData.withdrawals || []);
    setBalance(balData);
    setPageLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const hasPending   = withdrawals.some(w => w.status === "pending");
  const available    = balance?.available ?? 0;
  const selectedNet  = NETWORKS.find(n => n.id === form.network)!;
  const amountNum    = Number(form.amount) || 0;
  const canSubmit    = !loading && !hasPending && !!form.phone && form.phone.length >= 8 && amountNum >= 1 && amountNum <= available;

  function setMax() {
    setForm(f => ({ ...f, amount: String(available) }));
  }

  async function submit() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, phone: form.phone, network: form.network }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setForm(f => ({ ...f, amount: "", phone: "" }));
      await loadData();
      setTimeout(() => setSuccess(false), 5000);
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  if (pageLoading) return (
    <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "2px solid rgba(74,222,128,0.2)", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "#0a0f0d", border: "1px solid rgba(74,222,128,0.15)",
    borderRadius: 10, color: "#f0fdf4", fontSize: 14,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  };

  // Amount validation color
  const amountOk      = amountNum >= 1 && amountNum <= available;
  const amountTooHigh = amountNum > available && amountNum > 0;

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .w-card  { animation: fadeUp 0.25s ease forwards; }
        .net-btn { transition: all 0.15s; cursor: pointer; }
        .net-btn:hover { transform: translateY(-1px); }
        .w-inp:focus { border-color: rgba(74,222,128,0.45) !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.07) !important; }
        @media (max-width: 600px) {
          .w-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <main style={{ maxWidth: 540, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>

        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#6b7280", fontSize: 12, textDecoration: "none", marginBottom: 20, fontWeight: 500 }}>
          <ArrowLeft size={13} /> Back to dashboard
        </Link>

        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, letterSpacing: ".12em", marginBottom: 4 }}>VENDOR · WITHDRAW</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0fdf4", margin: "0 0 4px", letterSpacing: "-0.03em" }}>Withdraw funds</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Request a payout to your mobile money account.</p>
        </div>

        {/* Balance card */}
        <div className="w-card" style={{ background: "#111812", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: "1.25rem 1.5rem", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={15} color="#22c55e" />
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", margin: 0 }}>Your balance</p>
          </div>

          <p style={{ fontSize: 36, fontWeight: 700, color: available > 0 ? "#4ade80" : "#6b7280", margin: "0 0 4px", fontFamily: "monospace", letterSpacing: "-0.03em" }}>
            FCFA {available.toLocaleString()}
          </p>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 14px" }}>Available to withdraw</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Total earned",    value: `FCFA ${(balance?.totalEarned ?? 0).toLocaleString()}`,    color: "#22c55e" },
              { label: "Total withdrawn", value: `FCFA ${(balance?.totalWithdrawn ?? 0).toLocaleString()}`, color: "#6b7280" },
            ].map(s => (
              <div key={s.label} style={{ background: "#0d160e", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(74,222,128,0.07)" }}>
                <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 2px" }}>{s.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: s.color, margin: 0, fontFamily: "monospace" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {available <= 0 && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(107,114,128,0.06)", borderRadius: 8, border: "1px solid rgba(107,114,128,0.15)" }}>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                You have no available balance. Complete trades to earn funds.
              </p>
            </div>
          )}
        </div>

        {/* Success */}
        {success && (
          <div className="w-card" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={15} color="#22c55e" />
            <p style={{ fontSize: 13, color: "#22c55e", margin: 0, fontWeight: 600 }}>
              Withdrawal request sent! The admin will process it shortly.
            </p>
          </div>
        )}

        {/* Pending warning */}
        {hasPending && (
          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={15} color="#f59e0b" />
            <p style={{ fontSize: 13, color: "#f59e0b", margin: 0, fontWeight: 600 }}>
              You have a pending withdrawal. Wait for it to be processed before requesting another.
            </p>
          </div>
        )}

        {/* Form */}
        {available > 0 && (
          <div className="w-card" style={{ background: "#111812", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 16, padding: "1.5rem", marginBottom: 16 }}>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            {/* Amount */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em" }}>AMOUNT (FCFA)</label>
                <button
                  onClick={setMax}
                  disabled={hasPending}
                  style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                  Withdraw all (FCFA {available.toLocaleString()})
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#6b7280", fontFamily: "monospace", pointerEvents: "none" }}>FCFA</span>
                <input
                  className="w-inp"
                  type="number" min="1" max={available} placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  disabled={hasPending}
                  style={{
                    ...inp, paddingLeft: 52,
                    borderColor: amountTooHigh ? "rgba(239,68,68,0.4)" : amountOk ? "rgba(34,197,94,0.3)" : "rgba(74,222,128,0.15)",
                    opacity: hasPending ? 0.5 : 1,
                  }}
                />
              </div>
              {amountTooHigh && (
                <p style={{ fontSize: 11, color: "#ef4444", margin: "4px 0 0 2px" }}>
                  Exceeds your available balance of FCFA {available.toLocaleString()}
                </p>
              )}
              {amountOk && (
                <p style={{ fontSize: 11, color: "#22c55e", margin: "4px 0 0 2px" }}>
                  ✓ Within your available balance
                </p>
              )}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>MOMO NUMBER</label>
              <div style={{ display: "flex", alignItems: "center", background: "#0a0f0d", border: `1px solid ${selectedNet.border}`, borderRadius: 10, overflow: "hidden", opacity: hasPending ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRight: `1px solid ${selectedNet.border}`, height: 48, background: selectedNet.bg, flexShrink: 0 }}>
                  <span style={{ fontSize: 18 }}>🇨🇲</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: selectedNet.color, fontFamily: "monospace" }}>+237</span>
                </div>
                <input
                  className="w-inp"
                  type="tel" placeholder="6XXXXXXXX"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                  disabled={hasPending}
                  style={{ flex: 1, height: 48, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0fdf4", fontSize: 15, fontFamily: "monospace", width: "auto" }}
                />
                {form.phone.length >= 9 && <div style={{ padding: "0 10px", color: "#22c55e" }}><CheckCircle size={15} /></div>}
              </div>
            </div>

            {/* Network */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 8, letterSpacing: "0.05em" }}>NETWORK</label>
              <div style={{ display: "flex", gap: 10 }}>
                {NETWORKS.map(n => {
                  const isActive = form.network === n.id;
                  return (
                    <button key={n.id} className="net-btn"
                      onClick={() => !hasPending && setForm(f => ({ ...f, network: n.id }))}
                      style={{ flex: 1, padding: "14px 12px", borderRadius: 12, border: `2px solid ${isActive ? n.color : "rgba(74,222,128,0.1)"}`, background: isActive ? n.bg : "#0a0f0d", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: "inherit", opacity: hasPending ? 0.5 : 1, boxShadow: isActive ? `0 0 0 3px ${n.color}15` : "none", position: "relative" as const }}>
                      {isActive && (
                        <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%", background: n.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>✓</span>
                        </div>
                      )}
                      <span style={{ fontSize: 26 }}>{n.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? n.color : "#9ca3af" }}>{n.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {canSubmit && (
              <div style={{ background: selectedNet.bg, border: `1px solid ${selectedNet.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{selectedNet.emoji}</span>
                  <div>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Sending via</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: selectedNet.color, margin: 0 }}>{selectedNet.label} · +237{form.phone}</p>
                  </div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: selectedNet.color, fontFamily: "monospace" }}>
                  FCFA {amountNum.toLocaleString()}
                </span>
              </div>
            )}

            <button
              onClick={submit}
              disabled={!canSubmit}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: canSubmit ? `linear-gradient(135deg, ${selectedNet.color}, ${form.network === "MTN Mobile Money" ? "#d97706" : "#ea580c"})` : "#1a2535", color: canSubmit ? "#fff" : "#4b5563", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", transition: "all 0.15s", boxShadow: canSubmit ? `0 4px 16px ${selectedNet.color}30` : "none" }}>
              {loading
                ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Sending...</>
                : <><Banknote size={15} /> Request withdrawal of FCFA {amountNum > 0 ? amountNum.toLocaleString() : "—"}</>
              }
            </button>
          </div>
        )}

        {/* History */}
        {withdrawals.length > 0 && (
          <div className="w-card" style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 14, overflow: "hidden" }}>
            <button onClick={() => setShowHistory(o => !o)}
              style={{ width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em" }}>
                WITHDRAWAL HISTORY ({withdrawals.length})
              </span>
              {showHistory ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
            </button>
            {showHistory && (
              <div style={{ borderTop: "1px solid rgba(74,222,128,0.08)" }}>
                {withdrawals.map(w => {
                  const ws = W_STATUS[w.status] || W_STATUS.pending;
                  return (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(74,222,128,0.04)", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#f0fdf4", margin: "0 0 3px", fontFamily: "monospace" }}>FCFA {Number(w.amount).toLocaleString()}</p>
                        <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{w.network} · +237{w.phone} · {new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <span style={{ padding: "4px 10px", borderRadius: 12, background: ws.bg, color: ws.color, fontSize: 10, fontWeight: 700, border: `1px solid ${ws.color}25` }}>
                        {ws.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
