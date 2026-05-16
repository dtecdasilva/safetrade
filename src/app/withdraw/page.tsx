"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Banknote, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import Link from "next/link";

const NETWORKS = ["MTN Mobile Money", "Orange Money"];

const W_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  sent:     { label: "Sent ✓",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
};

export default function WithdrawPage() {
  const router = useRouter();
  const [user, setUser]             = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [form, setForm]             = useState({ amount: "", phone: "", network: NETWORKS[0] });
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user) { router.push("/auth/login"); return; }
    if (meData.user.role !== "vendor") { router.push("/dashboard"); return; }
    setUser(meData.user);

    const wRes = await fetch("/api/withdrawals");
    const wData = await wRes.json();
    setWithdrawals(wData.withdrawals || []);
    setPageLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const hasPending = withdrawals.some(w => w.status === "pending");
  const canSubmit  = !loading && !hasPending && !!form.amount && !!form.phone && Number(form.amount) >= 500 && form.phone.length >= 8;

  async function submit() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(form.amount), phone: form.phone, network: form.network }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setForm({ amount: "", phone: "", network: NETWORKS[0] });
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

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .w-card { animation: fadeUp 0.25s ease forwards; }
        .net-btn { transition: all 0.15s; }
        .net-btn:hover { opacity: 0.85; }
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
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Request a payout to your mobile money account. The admin will process it manually.</p>
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
        <div className="w-card" style={{ background: "#111812", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 16, padding: "1.5rem", marginBottom: 16 }}>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Amount + Phone */}
          <div className="w-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>AMOUNT (FCFA)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#6b7280", fontFamily: "monospace", pointerEvents: "none" }}>FCFA</span>
                <input
                  className="w-inp"
                  type="number" min="500" placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  disabled={hasPending}
                  style={{ ...inp, paddingLeft: 52, opacity: hasPending ? 0.5 : 1 }}
                />
              </div>
              <p style={{ fontSize: 10, color: "#6b7280", margin: "4px 0 0 2px" }}>Minimum FCFA 500</p>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>MOMO NUMBER</label>
              <div style={{ display: "flex", alignItems: "center", background: "#0a0f0d", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, overflow: "hidden", opacity: hasPending ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRight: "1px solid rgba(74,222,128,0.1)", height: 46, background: "rgba(74,222,128,0.03)", flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>🇨🇲</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>+237</span>
                </div>
                <input
                  className="w-inp"
                  type="tel" placeholder="6XXXXXXXX"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                  disabled={hasPending}
                  style={{ flex: 1, height: 46, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0fdf4", fontSize: 15, fontFamily: "monospace", width: "auto" }}
                />
                {form.phone.length >= 9 && <div style={{ padding: "0 10px", color: "#22c55e" }}><CheckCircle size={15} /></div>}
              </div>
            </div>
          </div>

          {/* Network */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 8, letterSpacing: "0.05em" }}>NETWORK</label>
            <div style={{ display: "flex", gap: 10 }}>
              {NETWORKS.map(n => {
                const isMTN    = n.includes("MTN");
                const isActive = form.network === n;
                const nc       = isMTN ? "#f59e0b" : "#f97316";
                return (
                  <button key={n} className="net-btn"
                    onClick={() => !hasPending && setForm(f => ({ ...f, network: n }))}
                    style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: hasPending ? "not-allowed" : "pointer", border: `1px solid ${isActive ? nc : "rgba(74,222,128,0.1)"}`, background: isActive ? `${nc}12` : "#0a0f0d", color: isActive ? nc : "#6b7280", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: hasPending ? 0.5 : 1 }}>
                    <span style={{ fontSize: 20 }}>{isMTN ? "🟡" : "🟠"}</span>
                    <span>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {form.amount && Number(form.amount) >= 500 && !hasPending && (
            <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>You will receive via {form.network}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#60a5fa", fontFamily: "monospace" }}>
                FCFA {Number(form.amount).toLocaleString()}
              </span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: canSubmit ? "linear-gradient(135deg,#60a5fa,#3b82f6)" : "#1a2535", color: canSubmit ? "#fff" : "#4b5563", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", transition: "all 0.15s", boxShadow: canSubmit ? "0 4px 16px rgba(96,165,250,0.2)" : "none" }}>
            {loading
              ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Sending request...</>
              : <><Banknote size={15} /> Request withdrawal</>
            }
          </button>
        </div>

        {/* History */}
        {withdrawals.length > 0 && (
          <div className="w-card" style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 14, overflow: "hidden" }}>
            <button
              onClick={() => setShowHistory(o => !o)}
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
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#f0fdf4", margin: "0 0 3px", fontFamily: "monospace" }}>
                          FCFA {Number(w.amount).toLocaleString()}
                        </p>
                        <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
                          {w.network} · +237{w.phone} · {new Date(w.created_at).toLocaleDateString()}
                        </p>
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

        {withdrawals.length === 0 && !success && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
            <p style={{ fontSize: 13 }}>No withdrawal history yet.</p>
          </div>
        )}

      </main>
    </div>
  );
}
