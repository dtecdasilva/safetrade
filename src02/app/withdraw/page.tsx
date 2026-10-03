"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { PageLoader, PhoneField, Pill } from "@/components/ui";
import { WITHDRAWAL_STATUS, fmtDate, money } from "@/lib/zola";

const NETWORKS = ["MTN Mobile Money", "Orange Money"];

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
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  if (pageLoading) return <PageLoader />;

  return (
    <div className="page">
      <Navbar user={{ name: user.name, role: user.role }} />

      <main className="container main narrow">
        <Link href="/dashboard" className="back-link">
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Wallet</h1>
          <p className="page-sub">Money from completed transactions, ready to withdraw to mobile money.</p>
        </div>

        <div className="stack">
          {/* Balance */}
          <section className="card card-pad card-mint" aria-labelledby="bal-title">
            <p id="bal-title" className="stat-label" style={{ color: "var(--emerald-press)" }}>Available to withdraw</p>
            <p className="amount-xl" style={{ fontSize: 34, margin: "4px 0 16px" }}>{money(available)}</p>
            <div className="form-grid-2">
              {[
                { label: "Total received",  value: money(balance?.totalEarned ?? 0) },
                { label: "Total withdrawn", value: money(balance?.totalWithdrawn ?? 0) },
              ].map(s => (
                <div key={s.label} style={{ padding: "10px 12px", background: "#fff", border: "1px solid var(--mint-line)", borderRadius: "var(--r-md)" }}>
                  <p className="hint">{s.label}</p>
                  <p className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>{s.value}</p>
                </div>
              ))}
            </div>
            {available <= 0 && (
              <p style={{ fontSize: 14, marginTop: 14, color: "var(--emerald-press)" }}>
                When a transaction is completed, the payment appears here.
              </p>
            )}
          </section>

          {success && (
            <div className="notice notice-ok fade-up" role="status">
              <CheckCircle size={16} /> Withdrawal requested. Zola will send it to your mobile money number.
            </div>
          )}

          {hasPending && (
            <div className="notice notice-wait">
              <Clock size={16} /> You have a withdrawal in progress. You can request another once it has been sent.
            </div>
          )}

          {/* Form */}
          {available > 0 && (
            <section className="card card-pad" aria-labelledby="w-title">
              <h2 id="w-title" className="section-title" style={{ marginBottom: 16 }}>Withdraw funds</h2>

              {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 14 }}>{error}</div>}

              {/* Amount */}
              <div className="field" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <label className="label" htmlFor="w-amount">Amount (FCFA)</label>
                  <button type="button" className="link-btn" style={{ fontSize: 13.5 }} disabled={hasPending}
                    onClick={() => setForm(f => ({ ...f, amount: String(available) }))}>
                    Withdraw everything
                  </button>
                </div>
                <input id="w-amount" className={`input num${amountOver ? " is-invalid" : ""}`}
                  type="number" min="1" max={available} placeholder="0" inputMode="numeric"
                  value={form.amount} disabled={hasPending}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                {amountOver && <p className="hint-error">That&apos;s more than your available balance of {money(available)}.</p>}
              </div>

              {/* Phone */}
              <div className="field" style={{ marginBottom: 16 }}>
                <label className="label" htmlFor="w-phone">Mobile money number</label>
                <PhoneField id="w-phone" value={form.phone} disabled={hasPending}
                  onChange={v => setForm(f => ({ ...f, phone: v }))} />
              </div>

              {/* Network */}
              <div className="field" style={{ marginBottom: 20 }}>
                <span className="label">Network</span>
                <div className="choice-row">
                  {NETWORKS.map(n => (
                    <button key={n} type="button" className="choice" aria-pressed={form.network === n} disabled={hasPending}
                      onClick={() => !hasPending && setForm(f => ({ ...f, network: n }))}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={submit} disabled={!canSubmit} className="btn btn-primary btn-block">
                {loading ? "Sending..." : amountNum > 0 && !amountOver ? `Request withdrawal of ${money(amountNum)}` : "Request withdrawal"}
              </button>
            </section>
          )}

          {/* History */}
          {withdrawals.length > 0 && (
            <section className="card" style={{ overflow: "hidden" }} aria-label="Withdrawal history">
              <button onClick={() => setShowHistory(o => !o)} aria-expanded={showHistory}
                style={{ width: "100%", minHeight: 54, padding: "0 20px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
                <span className="section-title" style={{ fontSize: 15 }}>Withdrawal history ({withdrawals.length})</span>
                {showHistory ? <ChevronUp size={17} color="var(--ink-3)" /> : <ChevronDown size={17} color="var(--ink-3)" />}
              </button>
              {showHistory && (
                <div style={{ borderTop: "1px solid var(--line-soft)" }}>
                  {withdrawals.map(w => {
                    const ws = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
                    return (
                      <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line-soft)", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <p className="num" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)" }}>{money(w.amount)}</p>
                          <p className="hint num">{w.network}, +237{w.phone}, {fmtDate(w.created_at)}</p>
                        </div>
                        <Pill tone={ws.tone}>{ws.label}</Pill>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
