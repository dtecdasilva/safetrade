"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Banknote, ChevronDown, ChevronUp, CheckCircle, Clock, Truck, PackageCheck, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import TxRow from "@/components/TxRow";
import { ZolaMark } from "@/components/Logo";
import { PhoneField, Pill, Timeline } from "@/components/ui";
import { WITHDRAWAL_STATUS, fmtDate, money } from "@/lib/zola";
import type { ActivityItem } from "@/lib/activity";

const NETWORKS = ["MTN Mobile Money", "Orange Money"];

export default function DashboardClient({ session, trades, activity = [] }: { session: any; trades: any[]; activity?: ActivityItem[] }) {
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
  const held      = active.filter(t => t.status !== "pending_payment");
  const escrow    = held.reduce((s,t) => s + t.amount, 0);
  const released  = isVendor ? completed.reduce((s:number,t:any) => s + t.amount, 0) : 0;
  const pending   = active.filter(t => t.status === "pending_release").length;
  const hasPendingW = withdrawals.some(w => w.status === "pending");

  const unpaid      = active.filter(t => t.status === "pending_payment");
  const unpaidTotal = unpaid.reduce((s,t) => s + Number(t.buyer_total || t.amount), 0);

  // What this person needs to do next
  const todos = isVendor
    ? active.filter(t => t.status === "funds_held").map(t => ({
        id: t.id, icon: <Truck size={17} />, cta: "Open",
        title: `Deliver “${t.title}”`,
        text: "Payment has been secured. Complete the delivery to receive your funds.",
      }))
    : [
        ...unpaid.map(t => ({
          id: t.id, icon: <Banknote size={17} />, cta: "Pay securely",
          title: `Pay for “${t.title}”`,
          text: `${money(t.buyer_total || t.amount)} to pay. Zola holds it until your order arrives.`,
        })),
        ...active.filter(t => t.status === "shipped").map(t => ({
          id: t.id, icon: <PackageCheck size={17} />, cta: "Review",
          title: `Confirm delivery of “${t.title}”`,
          text: "Confirm once your order has arrived so the seller can be paid.",
        })),
      ];

  async function submitW() {
    setWError(""); setWLoading(true);
    try {
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(wForm.amount), phone: wForm.phone, network: wForm.network }) });
      const data = await res.json();
      if (!res.ok) { setWError(data.error); return; }
      setWSuccess(true); setShowW(false); setWForm({ amount: "", phone: "", network: NETWORKS[0] });
      loadW(); setTimeout(() => setWSuccess(false), 5000);
    } catch { setWError("Something went wrong. Check your connection and try again."); }
    finally { setWLoading(false); }
  }

  const canW = !wLoading && !hasPendingW && !!wForm.amount && !!wForm.phone && Number(wForm.amount) >= 1 && wForm.phone.length >= 8;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="page">
      <Navbar user={{ name: session.name, role: session.role }} />

      <main className="container main">

        {/* Header */}
        <div className="dash-head">
          <div>
            <h1 className="page-title">Hello, {session.name.split(" ")[0]}</h1>
            <p className="page-sub">
              {isVendor ? "Here's where your sales and payments stand." : "Here's where your purchases and payments stand."}
            </p>
          </div>
          {isVendor && (
            <div className="dash-actions">
              <Link href="/trade/new" className="btn btn-primary">
                <Plus size={17} /> New transaction
              </Link>
              <button onClick={() => { setShowW(o => !o); setWError(""); }} className="btn btn-secondary" aria-expanded={showW}>
                <Banknote size={17} /> Withdraw
              </button>
            </div>
          )}
        </div>

        {/* Success message */}
        {wSuccess && (
          <div className="notice notice-ok fade-up" role="status" style={{ marginBottom: 16 }}>
            <CheckCircle size={16} /> Withdrawal requested. Zola will send it to your mobile money number.
          </div>
        )}

        {/* Withdraw form */}
        {isVendor && showW && (
          <div className="card card-pad fade-up" style={{ marginBottom: 24, maxWidth: 640 }}>
            <h2 className="section-title">Withdraw funds</h2>
            <p className="hint" style={{ margin: "2px 0 16px" }}>Zola sends the amount to your mobile money number.</p>

            {wError && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{wError}</div>}
            {hasPendingW && <div className="notice notice-wait" style={{ marginBottom: 12 }}><Clock size={16} /> You already have a withdrawal in progress.</div>}

            <div className="form-grid-2" style={{ marginBottom: 14 }}>
              <div className="field">
                <label className="label" htmlFor="w-amount">Amount (FCFA)</label>
                <input id="w-amount" className="input num" type="number" min="1" placeholder="0" inputMode="numeric" value={wForm.amount} disabled={hasPendingW}
                  onChange={e => setWForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label" htmlFor="w-phone">Mobile money number</label>
                <PhoneField id="w-phone" value={wForm.phone} disabled={hasPendingW}
                  onChange={v => setWForm(f => ({ ...f, phone: v }))} />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 18 }}>
              <span className="label">Network</span>
              <div className="choice-row">
                {NETWORKS.map(n => (
                  <button key={n} type="button" className="choice" aria-pressed={wForm.network === n} disabled={hasPendingW}
                    onClick={() => !hasPendingW && setWForm(f => ({ ...f, network: n }))}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="btn-row">
              <button onClick={submitW} disabled={!canW} className="btn btn-primary" style={{ flex: 1 }}>
                {wLoading ? "Sending..." : "Request withdrawal"}
              </button>
              <button onClick={() => setShowW(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Money and counts */}
        <div className="stats">
          <div className="stat stat-lead">
            <p className="stat-label"><ZolaMark size={18} color="currentColor" /> Held by Zola</p>
            <p className="stat-value">{money(escrow)}</p>
            <p className="stat-note">
              {held.length === 0
                ? "Nothing is being held right now."
                : isVendor
                  ? `Secured for ${plural(held.length, "order")}. Released to you when delivery is confirmed.`
                  : `Protected across ${plural(held.length, "transaction")} until you confirm delivery.`}
            </p>
          </div>

          {isVendor ? (
            <div className="stat">
              <p className="stat-label">Money received</p>
              <p className="stat-value">{money(released)}</p>
              <p className="stat-note">From completed transactions</p>
            </div>
          ) : (
            <div className="stat">
              <p className="stat-label">Pending payments</p>
              <p className="stat-value">{unpaid.length}</p>
              <p className="stat-note">{unpaid.length ? `${money(unpaidTotal)} to pay` : "Nothing to pay"}</p>
            </div>
          )}

          {isVendor ? (
            <div className="stat">
              <p className="stat-label">Pending payments</p>
              <p className="stat-value">{unpaid.length}</p>
              <p className="stat-note">{unpaid.length ? "Waiting for buyers to pay" : "No one owes a payment"}</p>
            </div>
          ) : (
            <div className="stat">
              <p className="stat-label">Active</p>
              <p className="stat-value">{active.length}</p>
              <p className="stat-note">Transactions in progress</p>
            </div>
          )}

          <div className="stat">
            <p className="stat-label">Completed</p>
            <p className="stat-value">{completed.length}</p>
            <p className="stat-note">Delivered and paid out</p>
          </div>
        </div>

        {/* Being released */}
        {pending > 0 && (
          <div className="notice notice-ok" style={{ marginBottom: 24 }}>
            <Clock size={16} />
            <span>
              {plural(pending, "transaction")} delivered.{" "}
              {isVendor ? "Zola is releasing your payment." : "Your payment is being sent to the seller."}
            </span>
          </div>
        )}

        <div className="dash-grid">
          <div className="dash-col">

            {/* Waiting on you */}
            {todos.length > 0 && (
              <section aria-labelledby="todo-title">
                <div className="block-head">
                  <h2 id="todo-title" className="section-title">Waiting on you</h2>
                  <Pill tone="wait">{todos.length}</Pill>
                </div>
                <div className="card card-wait" style={{ background: "var(--gold-tint)", overflow: "hidden" }}>
                  {todos.map(t => (
                    <Link key={t.id} href={`/trade/${t.id}`} className="todo">
                      <span className="todo-icon">{t.icon}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="todo-title">{t.title}</span>
                        <span className="todo-text">{t.text}</span>
                      </span>
                      <span className="btn btn-secondary btn-sm">{t.cta} <ChevronRight size={15} /></span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Active transactions */}
            <section id="transactions" aria-labelledby="active-title">
              <div className="block-head">
                <h2 id="active-title" className="section-title">Active transactions{active.length > 0 ? ` (${active.length})` : ""}</h2>
                {trades.length > 0 && <Link href="/transactions" className="block-link">View all</Link>}
              </div>
              {active.length > 0 ? (
                <div className="card tx-list">
                  {active.map(t => <TxRow key={t.id} trade={t} role={session.role} />)}
                </div>
              ) : (
                <div className="card empty">
                  <p className="empty-title">{trades.length === 0 ? "No transactions yet" : "No active transactions"}</p>
                  <p className="empty-text">
                    {isVendor
                      ? "Create a transaction and Zola will notify the buyer to pay."
                      : "When a seller creates a transaction for your number, it will appear here."}
                  </p>
                  {isVendor && (
                    <Link href="/trade/new" className="btn btn-primary" style={{ marginTop: 18 }}>
                      <Plus size={17} /> New transaction
                    </Link>
                  )}
                </div>
              )}
            </section>

            {/* Completed */}
            {completed.length > 0 && (
              <section aria-labelledby="done-title">
                <div className="block-head">
                  <h2 id="done-title" className="section-title">Completed</h2>
                  {completed.length > 3 && <Link href="/transactions" className="block-link">View all {completed.length}</Link>}
                </div>
                <div className="card tx-list">
                  {completed.slice(0, 3).map(t => <TxRow key={t.id} trade={t} role={session.role} />)}
                </div>
              </section>
            )}
          </div>

          <div className="dash-col">

            {/* Recent activity */}
            <section id="activity" aria-labelledby="activity-title">
              <div className="block-head">
                <h2 id="activity-title" className="section-title">Recent activity</h2>
                {activity.length > 0 && <Link href="/activity" className="block-link">View all</Link>}
              </div>
              <div className="card card-pad">
                {activity.length > 0 ? (
                  <Timeline
                    events={activity.map(a => ({
                      ...a,
                      context: (
                        <Link href={`/trade/${a.trade_id}`} style={{ fontSize: 13, fontWeight: 600 }}>{a.trade_title}</Link>
                      ),
                    }))}
                  />
                ) : (
                  <p className="hint">Payments, deliveries and confirmations will show up here as they happen.</p>
                )}
              </div>
            </section>

            {/* Withdrawal history */}
            {isVendor && withdrawals.length > 0 && (
              <section aria-label="Withdrawals">
                <div className="card" style={{ overflow: "hidden" }}>
                  <button onClick={() => setWHistory(o => !o)} aria-expanded={wHistory}
                    style={{ width: "100%", minHeight: 52, padding: "0 18px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
                    <span className="section-title" style={{ fontSize: 15 }}>Withdrawals ({withdrawals.length})</span>
                    {wHistory ? <ChevronUp size={17} color="var(--ink-3)" /> : <ChevronDown size={17} color="var(--ink-3)" />}
                  </button>
                  {wHistory && (
                    <div style={{ borderTop: "1px solid var(--line-soft)" }}>
                      {withdrawals.map(w => {
                        const ws = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
                        return (
                          <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--line-soft)", flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <p className="num" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)" }}>{money(w.amount)}</p>
                              <p className="hint num" suppressHydrationWarning>{w.network}, +237{w.phone}, {fmtDate(w.created_at)}</p>
                            </div>
                            <Pill tone={ws.tone}>{ws.label}</Pill>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
