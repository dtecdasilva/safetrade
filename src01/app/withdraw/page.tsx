"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Clock } from "lucide-react";

const NETWORKS = ["MTN Mobile Money", "Orange Money"];

const W_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b" },
  sent:     { label: "Sent",     color: "#22c55e" },
  rejected: { label: "Rejected", color: "#ef4444" },
};

export default function WithdrawPage() {
  const router = useRouter();
  const [user, setUser]               = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [balance, setBalance]         = useState<{ available: number; totalEarned: number; totalWithdrawn: number } | null>(null);
  const [form, setForm]               = useState({ amount: "", phone: "", network: NETWORKS[0] });
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = async () => {
    const me = await (await fetch("/api/auth/me")).json();
    if (!me.user) { router.push("/auth/login"); return; }
    if (me.user.role !== "vendor") { router.push("/dashboard"); return; }
    setUser(me.user);
    const [wr, br] = await Promise.all([fetch("/api/withdrawals"), fetch("/api/withdrawals/balance")]);
    const [wd, bd] = await Promise.all([wr.json(), br.json()]);
    setWithdrawals(wd.withdrawals || []);
    setBalance(bd);
    setPageLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const hasPending  = withdrawals.some(w => w.status === "pending");
  const available   = balance?.available ?? 0;
  const amountNum   = Number(form.amount) || 0;
  const canSubmit   = !loading && !hasPending && !!form.phone && form.phone.length >= 8 && amountNum >= 1 && amountNum <= available;
  const amountOver  = amountNum > available && amountNum > 0;

  async function submit() {
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amountNum, phone: form.phone, network: form.network }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true); setForm(f => ({ ...f, amount: "", phone: "" }));
      await loadData(); setTimeout(() => setSuccess(false), 5000);
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  if (pageLoading) return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #1e1e1e", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "#141414", border: "1px solid #242424", borderRadius: 8, color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" as const };
  const sec: React.CSSProperties = { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "16px", marginBottom: 12 };

  return (
    <div style={{ background: "#0c0c0c", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input:focus { border-color: #22c55e !important; }`}</style>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 80px" }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555", fontSize: 13, textDecoration: "none", marginBottom: 24 }}>
          <ArrowLeft size={13} /> Back
        </Link>

        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: "#555", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Vendor</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.03em", margin: 0 }}>Withdraw funds</h1>
        </div>

        {/* Balance */}
        <div style={sec}>
          <p style={{ fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px" }}>Available balance</p>
          <p style={{ fontSize: 32, fontWeight: 600, color: available > 0 ? "#f0f0f0" : "#444", fontFamily: "monospace", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            FCFA {available.toLocaleString()}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Total earned",    value: `FCFA ${(balance?.totalEarned ?? 0).toLocaleString()}` },
              { label: "Total withdrawn", value: `FCFA ${(balance?.totalWithdrawn ?? 0).toLocaleString()}` },
            ].map(s => (
              <div key={s.label} style={{ padding: "8px 10px", background: "#0c0c0c", borderRadius: 7 }}>
                <p style={{ fontSize: 11, color: "#444", margin: "0 0 2px" }}>{s.label}</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#888", margin: 0, fontFamily: "monospace" }}>{s.value}</p>
              </div>
            ))}
          </div>
          {available <= 0 && <p style={{ fontSize: 12, color: "#444", margin: "10px 0 0" }}>Complete trades to earn funds.</p>}
        </div>

        {success && (
          <div style={{ background: "#141414", border: "1px solid #22c55e", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#22c55e" }}>
            <CheckCircle size={14} /> Withdrawal request sent. Admin will process it shortly.
          </div>
        )}

        {hasPending && (
          <div style={{ background: "#141414", border: "1px solid #2a2000", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#f59e0b" }}>
            <Clock size={14} /> You have a pending withdrawal. Wait for it to be processed.
          </div>
        )}

        {/* Form */}
        {available > 0 && (
          <div style={sec}>
            {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</div>}

            {/* Amount */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>Amount (FCFA)</label>
                <button onClick={() => setForm(f => ({ ...f, amount: String(available) }))} disabled={hasPending}
                  style={{ fontSize: 11, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                  Withdraw all
                </button>
              </div>
              <input style={{ ...inp, borderColor: amountOver ? "rgba(239,68,68,0.4)" : "#242424" }}
                type="number" min="1" max={available} placeholder="0"
                value={form.amount} disabled={hasPending}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              {amountOver && <p style={{ fontSize: 11, color: "#ef4444", margin: "4px 0 0" }}>Exceeds available balance</p>}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Phone number</label>
              <div style={{ display: "flex", background: "#141414", border: "1px solid #242424", borderRadius: 8, overflow: "hidden", transition: "border-color 0.15s" }}>
                <span style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: "1px solid #242424", color: "#444", fontSize: 12, fontFamily: "monospace", background: "#1a1a1a", flexShrink: 0 }}>+237</span>
                <input type="tel" placeholder="6XXXXXXXX" value={form.phone} disabled={hasPending}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"").slice(0,9) }))}
                  onFocus={e => (e.currentTarget.parentElement!.style.borderColor = "#22c55e")}
                  onBlur={e => (e.currentTarget.parentElement!.style.borderColor = "#242424")}
                  style={{ flex: 1, height: 38, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 13, fontFamily: "monospace" }} />
              </div>
            </div>

            {/* Network */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Network</label>
              <div style={{ display: "flex", gap: 8 }}>
                {NETWORKS.map(n => (
                  <button key={n} onClick={() => !hasPending && setForm(f => ({ ...f, network: n }))}
                    style={{ flex: 1, padding: "8px", borderRadius: 7, border: `1px solid ${form.network === n ? "#22c55e" : "#242424"}`, background: form.network === n ? "rgba(34,197,94,0.06)" : "#0c0c0c", color: form.network === n ? "#22c55e" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={submit} disabled={!canSubmit}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: canSubmit ? "#22c55e" : "#1a1a1a", color: canSubmit ? "#fff" : "#444", fontSize: 13, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Sending..." : "Request withdrawal"}
            </button>
          </div>
        )}

        {/* History */}
        {withdrawals.length > 0 && (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => setShowHistory(o => !o)}
              style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#444", letterSpacing: "0.06em", textTransform: "uppercase" }}>History ({withdrawals.length})</span>
              {showHistory ? <ChevronUp size={13} color="#444" /> : <ChevronDown size={13} color="#444" />}
            </button>
            {showHistory && (
              <div style={{ borderTop: "1px solid #1a1a1a" }}>
                {withdrawals.map(w => {
                  const ws = W_STATUS[w.status] || W_STATUS.pending;
                  return (
                    <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #141414", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", margin: "0 0 1px", fontFamily: "monospace" }}>FCFA {Number(w.amount).toLocaleString()}</p>
                        <p style={{ fontSize: 11, color: "#444", margin: 0 }}>{w.network} · +237{w.phone} · {new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ws.color }}>{ws.label}</span>
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
