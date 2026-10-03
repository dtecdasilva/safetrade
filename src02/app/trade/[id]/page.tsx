"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle, AlertTriangle, Truck, ShieldCheck, RefreshCw, Edit3, Trash2, X, Save } from "lucide-react";
import { MoneyRail, PageLoader, PhoneField, StatusPill, Steps, Timeline } from "@/components/ui";
import { fmtDate, initials, money, shortId, statusMeta, statusStory, ViewerRole } from "@/lib/zola";

const NETWORKS = [
  { id: "mtn",    label: "MTN MoMo" },
  { id: "orange", label: "Orange Money" },
];

const DELIVERY_STATUS: Record<string, string> = {
  pending_payment: "Starts once the buyer pays",
  funds_held:      "Not shipped yet",
  shipped:         "Shipped, waiting for the buyer to confirm",
  delivered:       "Delivery confirmed",
  pending_release: "Delivery confirmed",
  complete:        "Delivery confirmed",
  disputed:        "On hold while Zola reviews",
  cancelled:       "Cancelled",
};

const PAYOUT_STATUS: Record<string, string> = {
  pending_payment: "Waiting for the buyer's payment",
  funds_held:      "Held by Zola until delivery is confirmed",
  shipped:         "Held by Zola until delivery is confirmed",
  delivered:       "Being released",
  pending_release: "Being released",
  complete:        "Released to your wallet",
  disputed:        "On hold while Zola reviews",
  cancelled:       "Cancelled",
};

export default function TradePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [user, setUser]   = useState<any>(null);
  const [trade, setTrade] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [error, setError]     = useState("");

  const [phone, setPhone]     = useState("");
  const [network, setNetwork] = useState<"mtn"|"orange"|"">("");
  const [paymentSent, setPaymentSent] = useState(false);

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
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setActing(false); }
  }

  async function pay() {
    if (!phone.trim()) { setError("Enter your mobile money number"); return; }
    if (!network)      { setError("Choose a network"); return; }
    setActing(true); setError("");
    try {
      const res  = await fetch(`/api/trades/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, network }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "The payment could not be started. Please try again."); setActing(false); return; }

      // Fapshi sends a mobile money push — no redirect needed
      // Show waiting state and poll for status
      setPaymentSent(true);
      setActing(false);

      // Poll trade status every 5 seconds for up to 3 minutes
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const r = await fetch(`/api/trades/${id}`);
        const d = await r.json();
        if (d.trade?.status !== "pending_payment") {
          clearInterval(poll);
          await load();
        }
        if (attempts >= 36) clearInterval(poll); // stop after 3 mins
      }, 5000);
    } catch { setError("Something went wrong. Check your connection and try again."); setActing(false); }
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
    } catch { setEditErr("Something went wrong. Check your connection and try again."); }
    finally { setEditSaving(false); }
  }

  async function deleteTrade() {
    setDeleting(true);
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
    else { const d = await res.json(); setError(d.error); setDelConfirm(false); setDeleting(false); }
  }

  if (loading || !trade) return <PageLoader />;

  const s        = statusMeta(trade.status);
  const isAdmin  = user?.role === "admin";
  const isBuyer  = user?.id === trade.buyer_id;
  const isVendor = user?.id === trade.vendor_id;
  const canEdit  = isVendor && trade.status === "pending_payment";
  const step     = s.step;
  const selNet   = NETWORKS.find(n => n.id === network);
  const canPay   = phone.length >= 8 && !!network;
  const editFee  = Number(editForm.amount) ? parseFloat((Number(editForm.amount) * 0.015).toFixed(2)) : 0;

  const viewer: ViewerRole = isBuyer ? "buyer" : isVendor ? "seller" : "admin";
  const story   = statusStory(trade, viewer);
  const total   = Number(trade.buyer_total || trade.amount);
  const hasPaid = !["pending_payment", "cancelled"].includes(trade.status);
  const isHeld  = s.money === "zola";

  /* ── The one thing this person can do right now ── */
  let action: React.ReactNode = null;

  if (isBuyer && trade.status === "pending_payment") {
    action = !paymentSent ? (
      <section className="card card-pad tx-action" aria-labelledby="pay-title">
        <h2 id="pay-title" className="section-title">Pay securely</h2>
        <p className="hint" style={{ margin: "2px 0 18px" }}>
          You pay Zola, not the seller. We hold your payment until you confirm delivery.
        </p>

        <div className="kv" style={{ padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: 18 }}>
          <span>Total to pay</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</span>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <span className="label">Network</span>
          <div className="choice-row">
            {NETWORKS.map(n => (
              <button key={n.id} type="button" className="choice" aria-pressed={network === n.id}
                onClick={() => setNetwork(n.id as "mtn"|"orange")}>
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label className="label" htmlFor="pay-phone">
            {network ? (network === "mtn" ? "MTN" : "Orange") : "Mobile money"} number
          </label>
          <PhoneField id="pay-phone" value={phone} onChange={setPhone} />
        </div>

        <button onClick={pay} disabled={!canPay || acting} className="btn btn-primary btn-lg btn-block" style={{ whiteSpace: "normal", lineHeight: 1.25, padding: "10px 16px" }}>
          {acting
            ? <><span className="spinner spinner-sm spinner-on-color" /> Sending prompt to your phone...</>
            : <><ShieldCheck size={18} style={{ flexShrink: 0 }} /> {!network ? "Choose a network to pay" : `Pay ${money(total)} with ${selNet?.label}`}</>
          }
        </button>
      </section>
    ) : (
      // Waiting for the buyer to approve the prompt on their phone
      <section className="card card-pad tx-action" style={{ textAlign: "center" }} role="status">
        <span className="spinner" style={{ width: 36, height: 36, marginBottom: 14 }} />
        <h2 className="section-title">Approve the payment on your phone</h2>
        <p style={{ fontSize: 14.5, margin: "6px auto 0", maxWidth: "40ch" }}>
          We&apos;ve sent a payment prompt to <strong className="num" style={{ color: "var(--navy)" }}>+237{phone}</strong>. Approve it to finish paying.
        </p>
        <p className="hint" style={{ margin: "10px 0 16px" }}>This page updates automatically once your payment is confirmed.</p>
        <button onClick={() => { setPaymentSent(false); setPhone(""); setNetwork(""); }} className="btn btn-secondary btn-sm">
          Use a different number
        </button>
      </section>
    );
  } else if (isBuyer && ["shipped","funds_held"].includes(trade.status)) {
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="confirm-title">
        <h2 id="confirm-title" className="section-title">
          {trade.status === "shipped" ? "Has your order arrived?" : "Already have your order?"}
        </h2>
        <p className="hint" style={{ margin: "2px 0 16px" }}>
          {trade.status === "shipped"
            ? "Confirm only once you've received it and checked it. Zola then releases the payment to the seller."
            : "The seller hasn't marked it as shipped yet. If it has already been handed to you, you can confirm now. Zola then releases the payment to the seller."}
          {" "}If something is wrong, open a dispute and your payment stays held.
        </p>
        <div className="btn-row">
          <button onClick={() => act("confirm")} disabled={acting} className="btn btn-primary" style={{ flex: 1 }}>
            <CheckCircle size={17} /> Confirm delivery
          </button>
          <button onClick={() => act("dispute")} disabled={acting} className="btn btn-danger-outline">
            <AlertTriangle size={17} /> Open a dispute
          </button>
        </div>
      </section>
    );
  } else if (isVendor && trade.status === "pending_payment") {
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="wait-title">
        <h2 id="wait-title" className="section-title">Waiting for the buyer to pay</h2>
        <p className="hint" style={{ margin: "2px 0 14px" }}>
          {trade.buyer_name} has been notified. Don&apos;t ship anything until Zola confirms the payment is held.
        </p>
        <button onClick={notify} className="btn btn-secondary">
          <RefreshCw size={16} /> Send a reminder
        </button>
        {notified && <p role="status" style={{ fontSize: 14, color: "var(--emerald-press)", fontWeight: 600, marginTop: 10 }}>Reminder sent.</p>}
      </section>
    );
  } else if (isVendor && trade.status === "funds_held") {
    action = (
      <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="ship-title">
        <h2 id="ship-title" className="section-title">Payment has been secured</h2>
        <p style={{ fontSize: 14.5, margin: "2px 0 16px", color: "var(--emerald-press)" }}>
          Complete the delivery to receive your funds. Once you&apos;ve shipped or handed over the order, mark it as shipped.
        </p>
        <button onClick={() => act("ship", { trackingNumber: "" })} disabled={acting} className="btn btn-primary">
          <Truck size={17} /> {acting ? "Marking..." : "Mark as shipped"}
        </button>
      </section>
    );
  } else if (isAdmin && trade.status === "pending_release") {
    action = (
      <section className="card card-pad card-wait tx-action fade-up" aria-labelledby="release-title">
        <h2 id="release-title" className="section-title">Release this payment</h2>
        <p className="hint" style={{ margin: "2px 0 16px" }}>
          The buyer confirmed delivery. Release {money(trade.amount)} to {trade.vendor_name}.
        </p>
        <button onClick={async () => { setActing(true); await fetch(`/api/admin/release/${id}`, { method: "POST" }); await load(); setActing(false); }} disabled={acting} className="btn btn-primary">
          <ShieldCheck size={17} /> {acting ? "Releasing..." : "Release payment"}
        </button>
      </section>
    );
  }

  return (
    <div className="page">
      <Navbar user={{ name: user.name, role: user.role }} />

      <main className="container main">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="back-link">
          <ArrowLeft size={15} /> Back
        </Link>

        {/* Header */}
        <div className="tx-head fade-up">
          <div style={{ flex: 1, minWidth: 0 }}>
            <StatusPill status={trade.status} />
            <h1 className="page-title" style={{ margin: "10px 0 4px", overflowWrap: "anywhere" }}>{trade.title}</h1>
            <p className="tx-id">Transaction ID <strong>{shortId(trade.id)}</strong></p>
          </div>
          {canEdit && !editing && (
            <div className="btn-row" style={{ flexShrink: 0, flexWrap: "nowrap" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: "0 0 auto" }}
                onClick={() => { setEditForm({ title: trade.title, description: trade.description, amount: String(trade.amount), deliveryDays: String(trade.delivery_days || 7) }); setEditing(true); setEditErr(""); }}>
                <Edit3 size={15} /> Edit
              </button>
              <button className="btn btn-danger-outline btn-sm" style={{ flex: "0 0 auto" }} onClick={() => setDelConfirm(true)}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {delConfirm && (
          <div className="card card-pad card-danger fade-up" role="alertdialog" aria-labelledby="del-title" style={{ marginBottom: 16 }}>
            <h2 id="del-title" className="section-title">Delete this transaction?</h2>
            <p className="hint" style={{ margin: "2px 0 14px" }}>This can&apos;t be undone. The transaction and its activity history will be removed.</p>
            <div className="btn-row">
              <button onClick={deleteTrade} disabled={deleting} className="btn btn-danger">
                {deleting ? "Deleting..." : "Delete transaction"}
              </button>
              <button onClick={() => setDelConfirm(false)} className="btn btn-secondary">Keep it</button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="card card-pad fade-up" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2 className="section-title">Edit transaction</h2>
              <button onClick={() => setEditing(false)} className="icon-btn" aria-label="Close" style={{ width: 36, height: 36 }}><X size={17} /></button>
            </div>
            {editErr && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{editErr}</div>}
            <div className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label className="label" htmlFor="e-title">Title</label>
                <input id="e-title" className="input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label" htmlFor="e-desc">Description</label>
                <textarea id="e-desc" className="textarea" rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label className="label" htmlFor="e-amount">Item price (FCFA)</label>
                  <input id="e-amount" className="input num" type="number" min="1" inputMode="numeric" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="e-days">Delivery time (days)</label>
                  <input id="e-days" className="input num" type="number" min="1" max="60" inputMode="numeric" value={editForm.deliveryDays} onChange={e => setEditForm(f => ({ ...f, deliveryDays: e.target.value }))} />
                </div>
              </div>
              {Number(editForm.amount) > 0 && (
                <div className="kv" style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--r-md)" }}>
                  <span>Buyer pays, including the 1.5% Zola fee</span>
                  <span>{money(Number(editForm.amount) + editFee)}</span>
                </div>
              )}
              <div className="btn-row">
                <button onClick={saveEdit} disabled={editSaving} className="btn btn-primary" style={{ flex: 1 }}>
                  <Save size={16} /> {editSaving ? "Saving..." : "Save changes"}
                </button>
                <button onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} /> <span>{error}</span>
          </div>
        )}

        <div className="tx-layout">
          <div className="tx-main">

            {/* Where the money is, what happens next, who acts */}
            <section className="card card-pad tx-status fade-up" aria-label="Transaction status">
              {step > 0 && <div style={{ marginBottom: 26 }}><Steps step={step} /></div>}

              <MoneyRail
                at={s.money}
                you={isBuyer ? "buyer" : isVendor ? "seller" : undefined}
                names={{ buyer: trade.buyer_name?.split(" ")[0], seller: trade.vendor_name?.split(" ")[0] }}
              />
              <p className="where">{story.where}</p>

              <div className="answers">
                <div className="answer">
                  <p className="answer-q">What happens next</p>
                  <p className="answer-a">{story.next}</p>
                </div>
                <div className="answer">
                  <p className="answer-q">Who needs to act</p>
                  <p className="answer-a" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {story.who}
                    {story.yourMove && <span className="tag tag-you">Your move</span>}
                  </p>
                </div>
              </div>
            </section>

            {action}

            {/* Activity */}
            <section className="card card-pad tx-activity fade-up" aria-labelledby="activity-title">
              <h2 id="activity-title" className="section-title" style={{ marginBottom: 16 }}>Activity</h2>
              {events.length === 0
                ? <p className="hint">Nothing has happened on this transaction yet.</p>
                : <Timeline events={events} />}
            </section>
          </div>

          {/* Details */}
          <aside className="tx-aside">
            <section className="card card-pad fade-up" aria-labelledby="money-title">
              <p id="money-title" className="stat-label" style={{ marginBottom: 4 }}>
                {isVendor ? "You receive" : isBuyer ? (hasPaid ? "You paid" : "Total to pay") : "Buyer pays"}
              </p>
              <p className="amount-xl">{money(isVendor ? trade.amount : total)}</p>

              <div style={{ marginTop: 14 }}>
                <div className="kv"><span>Item price</span><span>{money(trade.amount)}</span></div>
                <div className="kv"><span>Zola fee (1.5%){isVendor ? ", paid by the buyer" : ""}</span><span>{money(trade.fee)}</span></div>
                <div className="kv kv-total"><span>{isBuyer ? "Total" : "Buyer pays"}</span><span>{money(total)}</span></div>
              </div>

              {!isBuyer && (
                <div className="receipt-out" style={{ marginTop: 14 }}>
                  <span>{isVendor ? "Your payout" : "Seller receives"}</span><strong>{money(trade.amount)}</strong>
                </div>
              )}
              {isVendor && (
                <div className="kv" style={{ marginTop: 8 }}><span>Payout status</span><span>{PAYOUT_STATUS[trade.status] || "—"}</span></div>
              )}
              {isBuyer && isHeld && (
                <div className="receipt-out" style={{ marginTop: 14 }}>
                  <span>Held by Zola for the seller</span><strong>{money(trade.amount)}</strong>
                </div>
              )}
            </section>

            <section className="card card-pad fade-up" aria-labelledby="details-title">
              <h2 id="details-title" className="section-title" style={{ marginBottom: 10 }}>Details</h2>

              {trade.description && (
                <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{trade.description}</p>
              )}

              <hr className="divider" />

              {[
                { role: "Buyer",  name: trade.buyer_name,  avatar: trade.buyer_avatar,  you: isBuyer },
                { role: "Seller", name: trade.vendor_name, avatar: trade.vendor_avatar, you: isVendor },
              ].map(p => (
                <div key={p.role} className="party">
                  <span className="avatar">{initials(p.name, p.avatar)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="party-role">{p.role}</p>
                    <p className="party-name">{p.name || "—"}</p>
                  </div>
                  {p.you && <span className="tag tag-you">You</span>}
                </div>
              ))}

              <hr className="divider" />

              <div className="kv"><span>Delivery</span><span>{DELIVERY_STATUS[trade.status] || "—"}</span></div>
              {trade.delivery_deadline
                ? <div className="kv"><span>Deliver by</span><span suppressHydrationWarning>{fmtDate(trade.delivery_deadline)}</span></div>
                : trade.delivery_days && trade.status === "pending_payment"
                  ? <div className="kv"><span>Delivery time</span><span>{trade.delivery_days} day{Number(trade.delivery_days) === 1 ? "" : "s"} after payment</span></div>
                  : null}
              {trade.tracking_number && <div className="kv"><span>Tracking number</span><span>{trade.tracking_number}</span></div>}
              {trade.created_at && <div className="kv"><span>Created</span><span suppressHydrationWarning>{fmtDate(trade.created_at)}</span></div>}
            </section>

            {isBuyer && !["complete", "cancelled"].includes(trade.status) && (
              <p className="protect" style={{ padding: "0 4px" }}>
                <ShieldCheck size={17} />
                <span>Your payment is protected by Zola until the transaction is completed.</span>
              </p>
            )}
            {isVendor && isHeld && trade.status !== "disputed" && (
              <p className="protect" style={{ padding: "0 4px" }}>
                <ShieldCheck size={17} />
                <span>The buyer&apos;s payment is held by Zola. It is released to you once delivery is confirmed.</span>
              </p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
