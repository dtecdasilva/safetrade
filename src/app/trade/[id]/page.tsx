"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle, AlertTriangle, Truck, ShieldCheck, RefreshCw, Edit3, Trash2, X, Save, Check, MessageSquareWarning, PhoneCall, Copy } from "lucide-react";
import { MoneyRail, PageLoader, PhoneField, StatusPill, Steps, Timeline } from "@/components/ui";
import { fmtDate, fmtDateTime, initials, money, shortId, statusMeta, statusStory, ViewerRole } from "@/lib/zola";
import { COMPLAINT_MAX, COMPLAINT_MIN, REVIEW_HOURS, reviewState, timeLeft } from "@/lib/review";
import { ContactRow, SupportButtons, SupportLine } from "@/components/Support";
import { handoverHow } from "@/lib/handover";
import { prettyPhone } from "@/lib/support";
import { quote, feePercentOf, feePercentLabel, DELIVERY_NOTE } from "@/lib/fees";

const NETWORKS = [
  { id: "mtn",    label: "MTN MoMo" },
  { id: "orange", label: "Orange Money" },
];

const DELIVERY_STATUS: Record<string, string> = {
  pending_payment: "Starts once the buyer pays",
  funds_held:      "Waiting for the seller to send it to Zola",
  shipped:         "With Zola for delivery",
  delivered:       "Delivery confirmed",
  pending_release: "Confirmed by the buyer",
  complete:        "Delivery confirmed",
  disputed:        "On hold while Zola reviews",
  cancelled:       "Cancelled",
};

const PAYOUT_STATUS: Record<string, string> = {
  pending_payment: "Waiting for the buyer's payment",
  funds_held:      "Held by Zola until delivery is confirmed",
  shipped:         "Held by Zola until delivery is confirmed",
  delivered:       "Being released",
  pending_release: "Under review, then released",
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
  const [notifyMsg, setNotifyMsg] = useState("");
  const [copied, setCopied]       = useState(false);

  // Review after "Confirm delivery": the buyer's complaint, and the admin's steps
  const [contacts, setContacts]         = useState<any>(null);
  const [complaining, setComplaining]   = useState(false);
  const [complaint, setComplaint]       = useState("");
  const [contactNote, setContactNote]   = useState("");
  const [resolveNote, setResolveNote]   = useState("");
  const [now, setNow]                   = useState(() => Date.now());

  // Edit
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({ title: "", description: "", amount: "", deliveryDays: "", needsDelivery: true });
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
    setTrade(data.trade); setEvents(data.events || []); setContacts(data.contacts || null); setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // Keep "time left in the review" honest while the page stays open
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // When a notification arrives (the other side paid, shipped, confirmed...), show the new status straight away
  useEffect(() => {
    const onMove = () => { load(); };
    window.addEventListener("zola:notification", onMove);
    return () => window.removeEventListener("zola:notification", onMove);
  }, [load]);

  async function act(action: string, extra: Record<string,any> = {}) {
    setActing(true); setError("");
    try {
      const res  = await fetch(`/api/trades/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return false; }
      await load();
      return true;
    } catch { setError("Something went wrong. Check your connection and try again."); return false; }
    finally { setActing(false); }
  }

  async function sendComplaint() {
    const ok = await act("complain", { reason: complaint });
    if (ok) { setComplaining(false); setComplaint(""); }
  }

  // Admin: log the call or text, settle a complaint, release the payment
  async function adminPost(url: string, body?: Record<string, any>) {
    setActing(true); setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "That didn't go through. Please try again."); return false; }
      await load();
      return true;
    } catch { setError("Something went wrong. Check your connection and try again."); return false; }
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
    setNotifyMsg(""); setNotified(false);
    const res  = await fetch(`/api/trades/${id}/notify`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setNotifyMsg(data.error || "The reminder could not be sent. Please try again."); return; }
    if (data.invited && !data.emailSent && !data.whatsappSent) { setNotifyMsg("The invitation could not be sent. Check the buyer's email and number, or share the link with them yourself."); await load(); return; }
    setNotified(true);
    if (data.invited) await load();
  }

  // The seller can pass the invitation on themselves (SMS, another chat, in person)
  async function copyInvite() {
    const link = `${window.location.origin}/auth/register?invite=${id}`;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Copy this link and send it to the buyer", link); }
  }

  async function saveEdit() {
    setEditErr(""); setEditSaving(true);
    try {
      const res  = await fetch(`/api/trades/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editForm.title, description: editForm.description, amount: Number(editForm.amount), deliveryDays: Number(editForm.deliveryDays), needsDelivery: editForm.needsDelivery }) });
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
  // The buyer has no Zola account yet and has been invited to sign up
  const buyerPending = !!trade.buyer_pending;
  const inviteEmail  = !!trade.buyer_invite_sent?.email;
  const inviteWa     = !!trade.buyer_invite_sent?.whatsapp;
  const step     = s.step;
  const selNet   = NETWORKS.find(n => n.id === network);
  const canPay   = phone.length >= 8 && !!network;
  const editQuote = quote(Number(editForm.amount), editForm.needsDelivery);
  const deliveryFee = Number(trade.delivery_fee) || 0;
  // Transactions with a delivery fee are goods to ship; the rest are services or hand-overs
  const hasDelivery = deliveryFee > 0;

  const viewer: ViewerRole = isBuyer ? "buyer" : isVendor ? "seller" : "admin";
  const story   = statusStory(trade, viewer, now);
  const review  = reviewState(trade, now);
  const reviewUntil = review.endsAt ? fmtDateTime(review.endsAt) : "";
  const complaintLen = complaint.trim().length;
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

        <div style={{ padding: "8px 14px 12px", background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: deliveryFee > 0 ? 8 : 18 }}>
          <div className="kv"><span>Item price</span><span>{money(trade.amount)}</span></div>
          <div className="kv"><span>Zola fee ({feePercentOf(trade)})</span><span>{money(trade.fee)}</span></div>
          {deliveryFee > 0 && <div className="kv"><span>Delivery</span><span>{money(deliveryFee)}</span></div>}
          <div className="kv kv-total">
            <span>Total to pay</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</span>
          </div>
        </div>
        {deliveryFee > 0 && <p className="hint" style={{ marginBottom: 18 }}>{DELIVERY_NOTE}</p>}

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
            ? "Confirm only once you've received it and checked it."
            : "The seller hasn't marked it as shipped yet. If it has already been handed to you, you can confirm now."}
          {" "}After you confirm, you still have {REVIEW_HOURS} hours to tell us if anything is wrong before the seller is paid.
          If it never arrived or isn&apos;t what was agreed, open a dispute instead and your payment stays held.
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
        {buyerPending ? (
          <>
            <h2 id="wait-title" className="section-title">Waiting for the buyer to join Zola</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              This buyer doesn&apos;t have a Zola account yet.{" "}
              {inviteEmail && inviteWa
                ? <>We invited them by email ({trade.buyer_email}) and WhatsApp (<span className="num">{prettyPhone(trade.buyer_phone)}</span>) to sign up so they can pay.</>
                : inviteEmail
                  ? <>We invited them by email ({trade.buyer_email}) to sign up so they can pay. The WhatsApp message to <span className="num">{prettyPhone(trade.buyer_phone)}</span> didn&apos;t go through, so share the link with them too.</>
                  : inviteWa
                    ? <>We invited them on WhatsApp (<span className="num">{prettyPhone(trade.buyer_phone)}</span>) to sign up so they can pay. The email to {trade.buyer_email} didn&apos;t go through.</>
                    : <>Neither the email nor the WhatsApp invitation went through. Copy the link and send it to them yourself.</>}
              {" "}Don&apos;t send anything until Zola confirms the payment is held.
            </p>
            <div className="btn-row">
              <button onClick={notify} className="btn btn-secondary">
                <RefreshCw size={16} /> Send the invitation again
              </button>
              <button onClick={copyInvite} className="btn btn-secondary">
                <Copy size={16} /> {copied ? "Link copied" : "Copy invitation link"}
              </button>
            </div>
            {notified && <p role="status" style={{ fontSize: 14, color: "var(--emerald-press)", fontWeight: 600, marginTop: 10 }}>Invitation sent again.</p>}
          </>
        ) : (
          <>
            <h2 id="wait-title" className="section-title">Waiting for the buyer to pay</h2>
            <p className="hint" style={{ margin: "2px 0 14px" }}>
              {trade.buyer_name} has been notified. Don&apos;t send anything until Zola confirms the payment is held.
            </p>
            <button onClick={notify} className="btn btn-secondary">
              <RefreshCw size={16} /> Send a reminder
            </button>
            {notified && <p role="status" style={{ fontSize: 14, color: "var(--emerald-press)", fontWeight: 600, marginTop: 10 }}>Reminder sent.</p>}
          </>
        )}
        {notifyMsg && <p role="alert" className="hint-error" style={{ marginTop: 10 }}>{notifyMsg}</p>}
      </section>
    );
  } else if (isVendor && trade.status === "funds_held") {
    action = (
      <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="ship-title">
        <h2 id="ship-title" className="section-title">Payment has been secured</h2>
        <p style={{ fontSize: 14.5, margin: "2px 0 16px", color: "var(--emerald-press)" }}>
          {hasDelivery
            ? <>Now <strong>send the item to Zola</strong>, not straight to the buyer. Zola delivers it, and the buyer has already paid for delivery. {handoverHow()} Once Zola has the item, mark it as sent.</>
            : "Complete the work to receive your funds. Once you've delivered what was agreed, mark it as delivered."}
        </p>
        <button onClick={() => act("ship", { trackingNumber: "" })} disabled={acting} className="btn btn-primary">
          <Truck size={17} /> {acting ? "Marking..." : hasDelivery ? "Mark as sent to Zola" : "Mark as delivered"}
        </button>
      </section>
    );
  } else if (isBuyer && trade.status === "pending_release") {
    /* The buyer confirmed delivery: 24 hours to say something is wrong */
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="review-title">
        {review.complaintOpen ? (
          <>
            <h2 id="review-title" className="section-title">We&apos;ve received your complaint</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              Zola is looking into it and will call or text you. The seller is not paid until it is settled.
            </p>
            <p className="said">{trade.complaint_text}</p>
            <p className="said-meta" suppressHydrationWarning>Sent {fmtDateTime(trade.complaint_at)}</p>
            <p className="hint" style={{ margin: "16px 0 10px", fontSize: 14 }}>Want to reach us sooner?</p>
            <SupportButtons small />
          </>
        ) : review.complaintResolved ? (
          <>
            <h2 id="review-title" className="section-title">Your complaint has been resolved</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              {review.windowOpen
                ? `Zola closed your complaint. The seller is paid once the review ends on ${reviewUntil}.`
                : "Zola closed your complaint and is releasing the payment to the seller."}
            </p>
            {trade.complaint_resolution && <p className="said">{trade.complaint_resolution}</p>}
            <div style={{ marginTop: 14 }}><SupportLine lead="Still not right?" /></div>
          </>
        ) : review.canComplain ? (
          !complaining ? (
            <>
              <h2 id="review-title" className="section-title">Is everything okay with your order?</h2>
              <p className="hint" style={{ margin: "2px 0 16px", fontSize: 14 }}>
                Thanks for confirming delivery. This transaction is under review until{" "}
                <strong style={{ color: "var(--navy)" }} suppressHydrationWarning>{reviewUntil}</strong> ({timeLeft(review.msLeft)} left).
                If anything is wrong, make a complaint before then and your payment stays held. Zola may call or text you to check.
              </p>
              <button onClick={() => { setComplaining(true); setError(""); }} className="btn btn-secondary">
                <MessageSquareWarning size={17} /> Make a complaint
              </button>
            </>
          ) : (
            <>
              <h2 id="review-title" className="section-title">Make a complaint</h2>
              <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
                Tell us what went wrong. Your payment stays held, and Zola will call or text you.
              </p>
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="label" htmlFor="complaint">What went wrong?</label>
                <textarea id="complaint" className="textarea" rows={4} maxLength={COMPLAINT_MAX} autoFocus
                  placeholder="For example: the screen is cracked, or one item is missing from the box"
                  value={complaint} onChange={e => setComplaint(e.target.value)} />
                <p className="hint">{complaintLen < COMPLAINT_MIN ? "A sentence or two is enough." : `${complaintLen} of ${COMPLAINT_MAX} characters`}</p>
              </div>
              <div className="btn-row">
                <button onClick={sendComplaint} disabled={acting || complaintLen < COMPLAINT_MIN} className="btn btn-primary" style={{ flex: 1 }}>
                  {acting ? "Sending..." : "Send complaint"}
                </button>
                <button onClick={() => setComplaining(false)} disabled={acting} className="btn btn-secondary">Cancel</button>
              </div>
            </>
          )
        ) : (
          <>
            <h2 id="review-title" className="section-title">The review is over</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              The {REVIEW_HOURS} hours for making a complaint have passed, and Zola is releasing the payment to the seller.
            </p>
            <SupportLine lead="Something still wrong?" />
          </>
        )}
      </section>
    );
  } else if (isVendor && trade.status === "pending_release") {
    action = (
      <section className={`card card-pad tx-action fade-up${review.complaintOpen ? " card-wait" : ""}`} aria-labelledby="review-title">
        {review.complaintOpen ? (
          <>
            <h2 id="review-title" className="section-title">The buyer reported a problem</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              Your payment stays held while Zola looks into it. We may call or text you to hear your side.
            </p>
            <p className="said">{trade.complaint_text}</p>
            <p className="said-meta" suppressHydrationWarning>Sent {fmtDateTime(trade.complaint_at)}</p>
            <p className="hint" style={{ margin: "16px 0 10px", fontSize: 14 }}>You can also reach us directly.</p>
            <SupportButtons small />
          </>
        ) : review.windowOpen ? (
          <>
            <h2 id="review-title" className="section-title">Delivery confirmed, now under review</h2>
            <p className="hint" style={{ margin: "2px 0 0", fontSize: 14 }}>
              {trade.buyer_name} confirmed delivery. Zola reviews every delivery for {REVIEW_HOURS} hours and checks with the buyer.
              If no problem is reported, your {money(trade.amount)} is released after{" "}
              <strong style={{ color: "var(--navy)" }} suppressHydrationWarning>{reviewUntil}</strong>.
            </p>
          </>
        ) : (
          <>
            <h2 id="review-title" className="section-title">The review is over</h2>
            <p className="hint" style={{ margin: "2px 0 0", fontSize: 14 }}>
              Zola is releasing your {money(trade.amount)}. You&apos;ll be notified when it reaches your wallet.
            </p>
          </>
        )}
      </section>
    );
  } else if (isAdmin && trade.status === "pending_release") {
    /* Admin: call or text the buyer, settle any complaint, then release */
    const buyerContact = contacts?.buyer || { name: trade.buyer_name, phone: trade.buyer_phone, email: trade.buyer_email };
    action = (
      <section className="card card-pad card-wait tx-action fade-up" aria-labelledby="release-title">
        <h2 id="release-title" className="section-title">Review this delivery</h2>
        <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }} suppressHydrationWarning>
          {trade.buyer_name} confirmed delivery{trade.confirmed_at ? ` on ${fmtDateTime(trade.confirmed_at)}` : ""}.
          {" "}Three things have to be true before {money(trade.amount)} goes to {trade.vendor_name}.
        </p>

        <ol className="checks">
          {/* 1. Call or text the buyer */}
          <li className={`check${review.contacted ? " is-done" : ""}`}>
            <span className="check-mark" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            <div style={{ minWidth: 0 }}>
              <p className="check-title">Call or text the buyer</p>
              <p className="check-text" suppressHydrationWarning>
                {review.contacted
                  ? `Done${trade.review_contacted_by ? ` by ${trade.review_contacted_by}` : ""} on ${fmtDateTime(trade.review_contacted_at)}.${trade.review_contact_note ? ` Note: ${trade.review_contact_note}` : ""}`
                  : "Check the order arrived and is what was agreed."}
              </p>
              <div className="check-body">
                <ContactRow role="Buyer" name={buyerContact.name} phone={buyerContact.phone} />
                {!review.contacted && (
                  <>
                    <div className="field">
                      <label className="label" htmlFor="contact-note">What did the buyer say? (optional)</label>
                      <input id="contact-note" className="input" maxLength={500} value={contactNote}
                        placeholder="For example: received it, all good" onChange={e => setContactNote(e.target.value)} />
                    </div>
                    <div>
                      <button disabled={acting} className="btn btn-secondary"
                        onClick={async () => { if (await adminPost(`/api/admin/review/${id}`, { action: "contacted", note: contactNote })) setContactNote(""); }}>
                        <PhoneCall size={16} /> Mark buyer as contacted
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </li>

          {/* 2. Complaint */}
          <li className={`check${review.complaintOpen ? " is-bad" : " is-done"}`}>
            <span className="check-mark" aria-hidden="true">{!review.complaintOpen && <Check size={14} strokeWidth={3} />}</span>
            <div style={{ minWidth: 0 }}>
              <p className="check-title">
                {review.complaintOpen ? "Settle the buyer's complaint" : review.complaintResolved ? "Complaint resolved" : "No complaint"}
              </p>
              {!review.hasComplaint && (
                <p className="check-text">
                  {review.windowOpen ? "The buyer hasn't reported a problem. They can until the review ends." : "The buyer didn't report a problem."}
                </p>
              )}
              {review.hasComplaint && (
                <div className="check-body">
                  <div>
                    <p className="said">{trade.complaint_text}</p>
                    <p className="said-meta" suppressHydrationWarning>{trade.buyer_name}, {fmtDateTime(trade.complaint_at)}</p>
                  </div>
                  {review.complaintResolved && (
                    <p className="check-text" suppressHydrationWarning>
                      Resolved{trade.complaint_resolved_by ? ` by ${trade.complaint_resolved_by}` : ""} on {fmtDateTime(trade.complaint_resolved_at)}. Note: {trade.complaint_resolution}
                    </p>
                  )}
                  {review.complaintOpen && (
                    <>
                      <div className="field">
                        <label className="label" htmlFor="resolve-note">How was it settled?</label>
                        <textarea id="resolve-note" className="textarea" rows={2} maxLength={500} value={resolveNote}
                          placeholder="The buyer and seller both see this note" onChange={e => setResolveNote(e.target.value)} />
                      </div>
                      <div>
                        <button disabled={acting || !resolveNote.trim()} className="btn btn-secondary"
                          onClick={async () => { if (await adminPost(`/api/admin/review/${id}`, { action: "resolve", note: resolveNote })) setResolveNote(""); }}>
                          <CheckCircle size={16} /> Mark complaint as resolved
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>

          {/* 3. The 24 hours */}
          <li className={`check${review.windowOpen ? "" : " is-done"}`}>
            <span className="check-mark" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            <div style={{ minWidth: 0 }}>
              <p className="check-title">{REVIEW_HOURS}-hour review</p>
              <p className="check-text" suppressHydrationWarning>
                {review.windowOpen
                  ? `Ends ${reviewUntil}, ${timeLeft(review.msLeft)} left.`
                  : reviewUntil ? `Ended ${reviewUntil}.` : "Confirmed before reviews were introduced, so there is nothing to wait for."}
              </p>
            </div>
          </li>
        </ol>

        <button disabled={acting || !review.canRelease} className="btn btn-primary" style={{ marginTop: 8 }}
          onClick={() => adminPost(`/api/admin/release/${id}`)}>
          <ShieldCheck size={17} /> {acting ? "Working..." : `Release ${money(trade.amount)}`}
        </button>
        {!review.canRelease && (
          <ul className="blockers" aria-label="Before you can release">
            {review.blockers.map(b => <li key={b}>{b}</li>)}
          </ul>
        )}
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
                onClick={() => { setEditForm({ title: trade.title, description: trade.description, amount: String(trade.amount), deliveryDays: String(trade.delivery_days || 7), needsDelivery: trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0 }); setEditing(true); setEditErr(""); }}>
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
              <div className="field">
                <span className="label">Does it need to be delivered?</span>
                <div className="seg" role="group" aria-label="Delivery">
                  <button type="button" className="seg-item" aria-pressed={editForm.needsDelivery}
                    onClick={() => setEditForm(f => ({ ...f, needsDelivery: true }))}>Yes, deliver it</button>
                  <button type="button" className="seg-item" aria-pressed={!editForm.needsDelivery}
                    onClick={() => setEditForm(f => ({ ...f, needsDelivery: false }))}>No, nothing to deliver</button>
                </div>
              </div>
              {Number(editForm.amount) > 0 && (
                <div className="kv" style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--r-md)" }}>
                  <span>Buyer pays, including the {feePercentLabel(Number(editForm.amount))} Zola fee{editQuote.deliveryFee > 0 ? ` and ${money(editQuote.deliveryFee)} delivery` : ""}</span>
                  <span>{money(editQuote.total)}</span>
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
                <div className="kv"><span>Zola fee ({feePercentOf(trade)}){isVendor ? ", paid by the buyer" : ""}</span><span>{money(trade.fee)}</span></div>
                {deliveryFee > 0 && <div className="kv"><span>Delivery{isVendor ? ", paid by the buyer" : ""}</span><span>{money(deliveryFee)}</span></div>}
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
                buyerPending
                  ? { role: "Buyer, invited, not on Zola yet", name: prettyPhone(trade.buyer_phone), avatar: "?", you: false }
                  : { role: "Buyer", name: trade.buyer_name, avatar: trade.buyer_avatar, you: isBuyer },
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

              <div className="kv"><span>Delivery</span><span>{trade.needs_delivery === false ? "Not needed for this transaction" : DELIVERY_STATUS[trade.status] || "—"}</span></div>
              {trade.delivery_deadline
                ? <div className="kv"><span>Deliver by</span><span suppressHydrationWarning>{fmtDate(trade.delivery_deadline)}</span></div>
                : trade.delivery_days && trade.status === "pending_payment"
                  ? <div className="kv"><span>Delivery time</span><span>{trade.delivery_days} day{Number(trade.delivery_days) === 1 ? "" : "s"} after payment</span></div>
                  : null}
              {trade.tracking_number && <div className="kv"><span>Tracking number</span><span>{trade.tracking_number}</span></div>}
              {trade.created_at && <div className="kv"><span>Created</span><span suppressHydrationWarning>{fmtDate(trade.created_at)}</span></div>}
              {deliveryFee > 0 && !isVendor && !["complete", "cancelled"].includes(trade.status) && (
                <p className="hint" style={{ marginTop: 10 }}>{DELIVERY_NOTE}</p>
              )}
            </section>

            {isAdmin && (
              <section className="card card-pad fade-up" aria-labelledby="contacts-title">
                <h2 id="contacts-title" className="section-title" style={{ marginBottom: 2 }}>Contact</h2>
                {/* During a review the buyer's details already sit next to "Call or text the buyer" */}
                {trade.status !== "pending_release" && (
                  <ContactRow role="Buyer" name={contacts?.buyer?.name || trade.buyer_name} phone={contacts?.buyer?.phone || trade.buyer_phone} email={contacts?.buyer?.email || trade.buyer_email} />
                )}
                <ContactRow role="Seller" name={contacts?.seller?.name || trade.vendor_name} phone={contacts?.seller?.phone}                      email={contacts?.seller?.email || trade.vendor_email} />
              </section>
            )}

            {isBuyer && !["complete", "cancelled"].includes(trade.status) && (
              <p className="protect" style={{ padding: "0 4px" }}>
                <ShieldCheck size={17} />
                <span>Your payment is protected by Zola until the transaction is completed.</span>
              </p>
            )}
            {isVendor && isHeld && trade.status !== "disputed" && (
              <p className="protect" style={{ padding: "0 4px" }}>
                <ShieldCheck size={17} />
                <span>The buyer&apos;s payment is held by Zola. It is released to you after delivery is confirmed and the {REVIEW_HOURS}-hour review.</span>
              </p>
            )}
            {!isAdmin && <div style={{ padding: "0 4px" }}><SupportLine /></div>}
          </aside>
        </div>
      </main>
    </div>
  );
}
