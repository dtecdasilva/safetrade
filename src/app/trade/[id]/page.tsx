"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, CheckCircle, AlertTriangle, Truck, ShieldCheck, RefreshCw, Edit3, Trash2, X, Save, Check, MessageSquareWarning, PhoneCall, Copy, Flag, MessageCircle } from "lucide-react";
import { MoneyRail, PageLoader, PhoneField, StatusPill, Steps, Timeline } from "@/components/ui";
import { fmtDate, fmtDateTime, initials, money, shortId, statusMeta, statusStory, ViewerRole } from "@/lib/zola";
import { COMPLAINT_MAX, COMPLAINT_MIN, REVIEW_HOURS, reviewState, timeLeft } from "@/lib/review";
import { ContactRow, SupportButtons, SupportLine } from "@/components/Support";
import { handoverHow } from "@/lib/handover";
import { prettyPhone } from "@/lib/support";
import { quote, feePercentOf, feePercentLabel, DELIVERY_NOTE } from "@/lib/fees";
import { useT, rich } from "@/components/I18n";
import { REPORT_MAX, REPORT_MIN, REPORT_REASONS, canReportSeller, reportReasonLabel } from "@/lib/reports";
import { intlDigits } from "@/lib/support";
import DeliveryPanel from "@/components/pickup/DeliveryPanel";
import OriginPicker, { OriginValue, originReady } from "@/components/pickup/OriginPicker";
import DeliverySpot from "@/components/pickup/DeliverySpot";

const NETWORKS = [
  { id: "mtn",    label: "MTN MoMo" },
  { id: "orange", label: "Orange Money" },
];

const DELIVERY_STATUS: Record<string, string> = {
  awaiting_seller: "Starts once the buyer pays",
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
  awaiting_seller: "Waiting for you to confirm",
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
  const { t, lang } = useT();
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
  const [waitedOut, setWaitedOut]     = useState(false);
  const [checking, setChecking]       = useState(false);
  const [checkMsg, setCheckMsg]       = useState("");

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

  // A transaction the buyer started: the seller confirms or declines it
  const [declining, setDeclining]     = useState(false);
  const [declineWhy, setDeclineWhy]   = useState("");
  const [acceptOrigin, setAcceptOrigin] = useState<OriginValue>({ deliveryMode: "" });
  const [hasBranches, setHasBranches]   = useState(false);
  // The Pickup delivery (goods sent through a bus agency)
  const [delivery, setDelivery]         = useState<any>(null);

  // Reporting the seller (any time, even after completion), and the admin's flag
  const [sellerFlag, setSellerFlag]   = useState<any>(null);
  const [myReport, setMyReport]       = useState<any>(null);
  const [reporting, setReporting]     = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportText, setReportText]   = useState("");
  const [reportErr, setReportErr]     = useState("");
  const [reportSent, setReportSent]   = useState(false);

  // Delete
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const load = useCallback(async () => {
    const me = await (await fetch("/api/auth/me")).json();
    if (!me.user) { router.push(`/auth/login?next=${encodeURIComponent(`/trade/${id}`)}`); return; }
    setUser(me.user);
    const res = await fetch(`/api/trades/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data = await res.json();
    setTrade(data.trade); setEvents(data.events || []); setContacts(data.contacts || null);
    setSellerFlag(data.sellerFlag || null); setMyReport(data.myReport || null); setDelivery(data.delivery || null); setLoading(false);
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

  async function sendReport() {
    setReportErr(""); setActing(true);
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tradeId: id, reason: reportReason, details: reportText }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setReportErr(data.error || "Your report could not be sent. Please try again."); return; }
      setMyReport(data.report); setReporting(false); setReportSent(true); setReportText(""); setReportReason("");
    } catch { setReportErr("Something went wrong. Check your connection and try again."); }
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

  // Ask Fapshi directly whether the payment went through (if its confirmation never reached Zola)
  async function checkPayment(quiet = false) {
    if (!quiet) { setChecking(true); setCheckMsg(""); }
    try {
      const res  = await fetch(`/api/trades/${id}/check-payment`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.result === "paid" || data.result === "already_paid") { setPaymentSent(false); await load(); }
      if (!quiet) setCheckMsg(res.ok ? data.message : data.error || "Something went wrong. Please try again.");
      return data.result as string | undefined;
    } catch {
      if (!quiet) setCheckMsg("Something went wrong. Check your connection and try again.");
    } finally {
      if (!quiet) setChecking(false);
    }
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
      setWaitedOut(false);
      setCheckMsg("");
      setActing(false);

      // Poll trade status every 5 seconds for up to 3 minutes
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        // Every 15 seconds, also ask Fapshi directly in case its confirmation is slow to arrive
        if (attempts % 3 === 0) await checkPayment(true);
        const r = await fetch(`/api/trades/${id}`);
        const d = await r.json();
        if (d.trade?.status !== "pending_payment") {
          clearInterval(poll);
          await load();
        }
        if (attempts >= 36) { clearInterval(poll); setWaitedOut(true); } // stop after 3 mins
      }, 5000);
    } catch { setError("Something went wrong. Check your connection and try again."); setActing(false); }
  }

  async function notify() {
    setNotifyMsg(""); setNotified(false);
    const res  = await fetch(`/api/trades/${id}/notify`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setNotifyMsg(data.error || "The reminder could not be sent. Please try again."); return; }
    if (data.invited && !data.emailSent && !data.whatsappSent) {
      setNotifyMsg(trade?.status === "awaiting_seller"
        ? "The invitation could not be sent. Check the seller's email, or send them the link on WhatsApp."
        : "The invitation could not be sent. Check the buyer's email and number, or share the link with them yourself.");
      await load(); return;
    }
    setNotified(true);
    if (data.invited) await load();
  }

  // The seller can pass the invitation on themselves (SMS, another chat, in person)
  async function copyInvite() {
    const link = trade?.status === "awaiting_seller" && !trade?.vendor_pending
      ? `${window.location.origin}/trade/${id}`
      : `${window.location.origin}/auth/register?invite=${id}`;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt(t("Copy this link and send it to the buyer"), link); }
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
  // The seller can change their transaction until the buyer pays. A buyer who
  // started one can change it until the seller confirms, and cancel it until they pay.
  const startedByBuyer = trade.created_by === "buyer";
  const canEdit  = (isVendor && trade.status === "pending_payment") || (isBuyer && trade.status === "awaiting_seller");
  const canDelete = (isVendor && trade.status === "pending_payment")
    || (isBuyer && startedByBuyer && ["awaiting_seller", "pending_payment"].includes(trade.status));
  const buyerCancels = isBuyer && startedByBuyer;
  const vendorPending = !!trade.vendor_pending;
  const sellerInviteEmail = !!trade.vendor_invite_sent?.email;
  const reportable = isBuyer && canReportSeller(trade);
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
  const story   = statusStory(trade, viewer, now, t, lang);
  const review  = reviewState(trade, now);
  const reviewUntil = review.endsAt ? fmtDateTime(review.endsAt, lang) : "";
  const complaintLen = complaint.trim().length;
  const total   = Number(trade.buyer_total || trade.amount);
  const hasPaid = !["awaiting_seller", "pending_payment", "cancelled"].includes(trade.status);
  const isHeld  = s.money === "zola";

  /* ── The one thing this person can do right now ── */
  let action: React.ReactNode = null;

  // A ready-made WhatsApp message the buyer sends the seller from their own phone
  const sellerLink = typeof window !== "undefined"
    ? `${window.location.origin}${vendorPending ? `/auth/register?invite=${id}` : `/trade/${id}`}`
    : "";
  const waText = t("Hi, I've started a Zola transaction to buy “{title}” from you for {price}. Please check the details and confirm, so I can pay safely through Zola: {link}", { title: trade.title, price: money(trade.amount), link: sellerLink });
  const sellerWa = intlDigits(trade.vendor_phone);
  const waUrl = `https://wa.me/${sellerWa}?text=${encodeURIComponent(waText)}`;

  if (isVendor && trade.status === "awaiting_seller") {
    action = (
      <section className="card card-pad card-wait tx-action fade-up" aria-labelledby="accept-title">
        <h2 id="accept-title" className="section-title">{t("{name} wants to buy this from you", { name: trade.buyer_name })}</h2>
        <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
          {t("Check the item, the description and your price. If they match what you agreed, confirm and the buyer can pay Zola. Don't send anything until Zola tells you the payment is held.")}
        </p>
        <div style={{ padding: "8px 14px 12px", background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: 16 }}>
          <div className="kv"><span>{t("Item")}</span><span style={{ overflowWrap: "anywhere", textAlign: "right" }}>{trade.title}</span></div>
          <div className="kv"><span>{t("Delivery")}</span><span>{trade.needs_delivery === false ? t("Nothing to deliver") : hasBranches ? t("By a Zola rider") : t("You send it to Zola")}</span></div>
          <div className="kv kv-total"><span>{t("You receive")}</span><span style={{ fontSize: 18, fontWeight: 800 }}>{money(trade.amount)}</span></div>
        </div>
        {trade.needs_delivery !== false && (
          <div style={{ marginBottom: 14 }}>
            <OriginPicker value={acceptOrigin} onChange={setAcceptOrigin} onLoaded={setHasBranches} idPrefix="acc" />
          </div>
        )}
        {!declining ? (
          <div className="btn-row">
            <button onClick={() => act("accept", acceptOrigin)} disabled={acting || (hasBranches && trade.needs_delivery !== false && !originReady(acceptOrigin))} className="btn btn-primary" style={{ flex: 1 }}>
              <CheckCircle size={17} /> {acting ? t("Confirming...") : t("Confirm details")}
            </button>
            <button onClick={() => { setDeclining(true); setError(""); }} disabled={acting} className="btn btn-secondary">
              <X size={17} /> {t("Decline")}
            </button>
          </div>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 14 }}>
              <label className="label" htmlFor="decline-why">{t("Tell the buyer why (optional)")}</label>
              <textarea id="decline-why" className="textarea" rows={3} maxLength={500} autoFocus
                placeholder={t("For example: the price we agreed was FCFA 45,000")}
                value={declineWhy} onChange={e => setDeclineWhy(e.target.value)} />
              <p className="hint">{t("The transaction is cancelled. The buyer can start a new one with the right details.")}</p>
            </div>
            <div className="btn-row">
              <button onClick={async () => { if (await act("decline", { reason: declineWhy })) { setDeclining(false); setDeclineWhy(""); } }} disabled={acting} className="btn btn-danger" style={{ flex: 1 }}>
                {acting ? t("Declining...") : t("Decline transaction")}
              </button>
              <button onClick={() => setDeclining(false)} disabled={acting} className="btn btn-secondary">{t("Back")}</button>
            </div>
          </>
        )}
      </section>
    );
  } else if (isBuyer && trade.status === "awaiting_seller") {
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="await-title">
        <h2 id="await-title" className="section-title">{vendorPending ? t("Waiting for the seller to join Zola") : t("Waiting for the seller to confirm")}</h2>
        <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
          {vendorPending
            ? (sellerInviteEmail
                ? t("This seller doesn't have a Zola account yet. We emailed them ({email}) an invitation to sign up and confirm. Send them the link on WhatsApp too, so they see it quickly.", { email: trade.vendor_invite_email })
                : t("This seller doesn't have a Zola account yet, and the email invitation didn't go through. Send them the link on WhatsApp."))
            : t("{name} has been notified. You can pay as soon as they confirm the details. Send them a WhatsApp message to speed things up.", { name: trade.vendor_name })}
          {" "}{t("You pay nothing until then.")}
        </p>
        <div className="btn-row">
          {sellerWa && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <MessageCircle size={16} /> {t("Send on WhatsApp")}
            </a>
          )}
          <button onClick={notify} className="btn btn-secondary">
            <RefreshCw size={16} /> {vendorPending ? t("Send the invitation again") : t("Send a reminder")}
          </button>
          <button onClick={copyInvite} className="btn btn-secondary">
            <Copy size={16} /> {copied ? t("Link copied") : t("Copy link")}
          </button>
        </div>
        {notified && <p role="status" style={{ fontSize: 14, color: "var(--emerald-press)", fontWeight: 600, marginTop: 10 }}>{vendorPending ? t("Invitation sent again.") : t("Reminder sent.")}</p>}
        {notifyMsg && <p role="alert" className="hint-error" style={{ marginTop: 10 }}>{t(notifyMsg)}</p>}
      </section>
    );
  } else if (isBuyer && trade.status === "pending_payment" && trade.delivery_pending) {
    /* Pickup: the delivery fee comes from the distance, so the buyer says where to deliver first */
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="spot-title">
        <h2 id="spot-title" className="section-title">{t("Where should we deliver?")}</h2>
        <p className="hint" style={{ margin: "2px 0 14px" }}>
          {t("A Zola rider brings it to you. The delivery price depends on the distance from {from}, so mark your spot first. You'll see the full total before you pay.", { from: trade.dest_branch ? `${trade.dest_branch.agency}, ${trade.dest_branch.name}` : (trade.origin?.city || "") })}
        </p>
        <DeliverySpot tradeId={trade.id} initial={null} onSaved={load} saveLabel={t("See the delivery price")} />
      </section>
    );
  } else if (isBuyer && trade.status === "pending_payment") {
    action = !paymentSent ? (
      <section className="card card-pad tx-action" aria-labelledby="pay-title">
        <h2 id="pay-title" className="section-title">{t("Pay securely")}</h2>
        <p className="hint" style={{ margin: "2px 0 18px" }}>
          {t("You pay Zola, not the seller. We hold your payment until you confirm delivery.")}
        </p>

        <div style={{ padding: "8px 14px 12px", background: "var(--bg)", borderRadius: "var(--r-md)", marginBottom: deliveryFee > 0 ? 8 : 18 }}>
          <div className="kv"><span>{t("Item price")}</span><span>{money(trade.amount)}</span></div>
          <div className="kv"><span>{t("Zola fee ({rate})", { rate: feePercentOf(trade) })}</span><span>{money(trade.fee)}</span></div>
          {deliveryFee > 0 && <div className="kv"><span>{trade.delivery_km ? t("Delivery ({km} km)", { km: trade.delivery_km }) : t("Delivery")}</span><span>{money(deliveryFee)}</span></div>}
          <div className="kv kv-total">
            <span>{t("Total to pay")}</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</span>
          </div>
        </div>
        {deliveryFee > 0 && <p className="hint" style={{ marginBottom: 18 }}>{t(DELIVERY_NOTE)}</p>}

        <div className="field" style={{ marginBottom: 14 }}>
          <span className="label">{t("Network")}</span>
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
            {network === "mtn" ? t("MTN number") : network === "orange" ? t("Orange number") : t("Mobile money number")}
          </label>
          <PhoneField id="pay-phone" value={phone} onChange={setPhone} />
        </div>

        <button onClick={pay} disabled={!canPay || acting} className="btn btn-primary btn-lg btn-block" style={{ whiteSpace: "normal", lineHeight: 1.25, padding: "10px 16px" }}>
          {acting
            ? <><span className="spinner spinner-sm spinner-on-color" /> {t("Sending prompt to your phone...")}</>
            : <><ShieldCheck size={18} style={{ flexShrink: 0 }} /> {!network ? t("Choose a network to pay") : t("Pay {amount} with {network}", { amount: money(total), network: selNet?.label })}</>
          }
        </button>

        {trade.fapshi_ref && (
          <p className="hint" style={{ marginTop: 14, fontSize: 13.5 }}>
            {t("Already paid, but this still says Payment pending?")}{" "}
            <button type="button" className="link-btn" onClick={() => checkPayment()} disabled={checking}>
              {checking ? t("Checking...") : t("Check payment")}
            </button>
          </p>
        )}
        {checkMsg && <p role="status" className="hint" style={{ marginTop: 8, fontSize: 14 }}>{t(checkMsg)}</p>}
      </section>
    ) : (
      // Waiting for the buyer to approve the prompt on their phone
      <section className="card card-pad tx-action" style={{ textAlign: "center" }} role="status">
        <span className="spinner" style={{ width: 36, height: 36, marginBottom: 14 }} />
        <h2 className="section-title">{t("Approve the payment on your phone")}</h2>
        <p style={{ fontSize: 14.5, margin: "6px auto 0", maxWidth: "40ch" }}>
          {rich(t("We've sent a payment prompt to <b>{phone}</b>. Approve it to finish paying.", { phone: `+237${phone}` }), { b: (c) => <strong className="num" style={{ color: "var(--navy)" }}>{c}</strong> })}
        </p>
        <p className="hint" style={{ margin: "10px 0 16px" }}>
          {waitedOut
            ? t("Still waiting. If you approved the payment, check it now. Otherwise you can try again.")
            : t("This page updates automatically once your payment is confirmed.")}
        </p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          {waitedOut && (
            <button onClick={() => checkPayment()} disabled={checking} className="btn btn-primary btn-sm">
              <RefreshCw size={15} /> {checking ? t("Checking...") : t("Check payment")}
            </button>
          )}
          <button onClick={() => { setPaymentSent(false); setPhone(""); setNetwork(""); }} className="btn btn-secondary btn-sm">
            {t("Use a different number")}
          </button>
        </div>
        {checkMsg && <p role="status" className="hint" style={{ marginTop: 12, fontSize: 14 }}>{t(checkMsg)}</p>}
      </section>
    );
  } else if (isBuyer && ["shipped","funds_held"].includes(trade.status)) {
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="confirm-title">
        <h2 id="confirm-title" className="section-title">
          {trade.status === "shipped" ? t("Has your order arrived?") : t("Already have your order?")}
        </h2>
        <p className="hint" style={{ margin: "2px 0 16px" }}>
          {trade.status === "shipped"
            ? t("Confirm only once you've received it and checked it.")
            : t("The seller hasn't marked it as shipped yet. If it has already been handed to you, you can confirm now.")}
          {" "}{t("After you confirm, you still have {hours} hours to tell us if anything is wrong before the seller is paid.", { hours: REVIEW_HOURS })}{" "}
          {t("If it never arrived or isn't what was agreed, open a dispute instead and your payment stays held.")}
        </p>
        <div className="btn-row">
          <button onClick={() => act("confirm")} disabled={acting} className="btn btn-primary" style={{ flex: 1 }}>
            <CheckCircle size={17} /> {t("Confirm delivery")}
          </button>
          <button onClick={() => act("dispute")} disabled={acting} className="btn btn-danger-outline">
            <AlertTriangle size={17} /> {t("Open a dispute")}
          </button>
        </div>
      </section>
    );
  } else if (isVendor && trade.status === "pending_payment") {
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="wait-title">
        {buyerPending ? (
          <>
            <h2 id="wait-title" className="section-title">{t("Waiting for the buyer to join Zola")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              {t("This buyer doesn't have a Zola account yet.")}{" "}
              {inviteEmail && inviteWa
                ? t("We invited them by email ({email}) and WhatsApp ({phone}) to sign up so they can pay.", { email: trade.buyer_email, phone: prettyPhone(trade.buyer_phone) })
                : inviteEmail
                  ? t("We invited them by email ({email}) to sign up so they can pay. The WhatsApp message to {phone} didn't go through, so share the link with them too.", { email: trade.buyer_email, phone: prettyPhone(trade.buyer_phone) })
                  : inviteWa
                    ? t("We invited them on WhatsApp ({phone}) to sign up so they can pay. The email to {email} didn't go through.", { email: trade.buyer_email, phone: prettyPhone(trade.buyer_phone) })
                    : t("Neither the email nor the WhatsApp invitation went through. Copy the link and send it to them yourself.")}
              {" "}{t("Don't send anything until Zola confirms the payment is held.")}
            </p>
            <div className="btn-row">
              <button onClick={notify} className="btn btn-secondary">
                <RefreshCw size={16} /> {t("Send the invitation again")}
              </button>
              <button onClick={copyInvite} className="btn btn-secondary">
                <Copy size={16} /> {copied ? t("Link copied") : t("Copy invitation link")}
              </button>
            </div>
            {notified && <p role="status" style={{ fontSize: 14, color: "var(--emerald-press)", fontWeight: 600, marginTop: 10 }}>{t("Invitation sent again.")}</p>}
          </>
        ) : (
          <>
            <h2 id="wait-title" className="section-title">{t("Waiting for the buyer to pay")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px" }}>
              {t("{name} has been notified. Don't send anything until Zola confirms the payment is held.", { name: trade.buyer_name })}
            </p>
            <button onClick={notify} className="btn btn-secondary">
              <RefreshCw size={16} /> {t("Send a reminder")}
            </button>
            {notified && <p role="status" style={{ fontSize: 14, color: "var(--emerald-press)", fontWeight: 600, marginTop: 10 }}>{t("Reminder sent.")}</p>}
          </>
        )}
        {notifyMsg && <p role="alert" className="hint-error" style={{ marginTop: 10 }}>{t(notifyMsg)}</p>}
      </section>
    );
  } else if (isVendor && trade.status === "funds_held" && (trade.dest_branch || trade.origin) && trade.needs_delivery !== false) {
    // Goods through a bus agency: the seller sends it to the Pickup rider
    action = <DeliveryPanel trade={trade} delivery={delivery} viewer="seller" onChange={load} act={act} acting={acting} />;
  } else if (isVendor && trade.status === "funds_held") {
    action = (
      <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="ship-title">
        <h2 id="ship-title" className="section-title">{t("Payment has been secured")}</h2>
        <p style={{ fontSize: 14.5, margin: "2px 0 16px", color: "var(--emerald-press)" }}>
          {hasDelivery
            ? <>{rich(t("Now <b>send the item to Zola</b>, not straight to the buyer. Zola delivers it, and the buyer has already paid for delivery."), { b: (c) => <strong>{c}</strong> })} {handoverHow(lang)} {t("Once Zola has the item, mark it as sent.")}</>
            : t("Complete the work to receive your funds. Once you've delivered what was agreed, mark it as delivered.")}
        </p>
        <button onClick={() => act("ship", { trackingNumber: "" })} disabled={acting} className="btn btn-primary">
          <Truck size={17} /> {acting ? t("Marking...") : hasDelivery ? t("Mark as sent to Zola") : t("Mark as delivered")}
        </button>
      </section>
    );
  } else if (isAdmin && trade.status === "pending_payment" && trade.fapshi_ref) {
    /* A payment was started: the admin can ask Fapshi whether it went through */
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="check-title">
        <h2 id="check-title" className="section-title">A payment was started</h2>
        <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
          The buyer was sent a payment prompt{trade.payment_started_at ? ` on ${fmtDateTime(trade.payment_started_at)}` : ""}.
          If they say they paid but this still says Payment pending, ask Fapshi directly.
        </p>
        <button onClick={() => checkPayment()} disabled={checking} className="btn btn-secondary">
          <RefreshCw size={16} /> {checking ? "Checking..." : "Check payment with Fapshi"}
        </button>
        {checkMsg && <p role="status" className="hint" style={{ marginTop: 10, fontSize: 14 }}>{checkMsg}</p>}
      </section>
    );
  } else if (isBuyer && trade.status === "pending_release") {
    /* The buyer confirmed delivery: 24 hours to say something is wrong */
    action = (
      <section className="card card-pad tx-action fade-up" aria-labelledby="review-title">
        {review.complaintOpen ? (
          <>
            <h2 id="review-title" className="section-title">{t("We've received your complaint")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              {t("Zola is looking into it and will call or text you. The seller is not paid until it is settled.")}
            </p>
            <p className="said">{trade.complaint_text}</p>
            <p className="said-meta" suppressHydrationWarning>{t("Sent {date}", { date: fmtDateTime(trade.complaint_at, lang) })}</p>
            <p className="hint" style={{ margin: "16px 0 10px", fontSize: 14 }}>{t("Want to reach us sooner?")}</p>
            <SupportButtons small />
          </>
        ) : review.complaintResolved ? (
          <>
            <h2 id="review-title" className="section-title">{t("Your complaint has been resolved")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              {review.windowOpen
                ? t("Zola closed your complaint. The seller is paid once the review ends on {date}.", { date: reviewUntil })
                : t("Zola closed your complaint and is releasing the payment to the seller.")}
            </p>
            {trade.complaint_resolution && <p className="said">{trade.complaint_resolution}</p>}
            <div style={{ marginTop: 14 }}><SupportLine lead="Still not right?" /></div>
          </>
        ) : review.canComplain ? (
          !complaining ? (
            <>
              <h2 id="review-title" className="section-title">{t("Is everything okay with your order?")}</h2>
              <p className="hint" style={{ margin: "2px 0 16px", fontSize: 14 }} suppressHydrationWarning>
                {rich(t("Thanks for confirming delivery. This transaction is under review until <b>{until}</b> ({left} left).", { until: reviewUntil, left: timeLeft(review.msLeft, lang) }), { b: (c) => <strong style={{ color: "var(--navy)" }}>{c}</strong> })}{" "}
                {t("If anything is wrong, make a complaint before then and your payment stays held. Zola may call or text you to check.")}
              </p>
              <button onClick={() => { setComplaining(true); setError(""); }} className="btn btn-secondary">
                <MessageSquareWarning size={17} /> {t("Make a complaint")}
              </button>
            </>
          ) : (
            <>
              <h2 id="review-title" className="section-title">{t("Make a complaint")}</h2>
              <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
                {t("Tell us what went wrong. Your payment stays held, and Zola will call or text you.")}
              </p>
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="label" htmlFor="complaint">{t("What went wrong?")}</label>
                <textarea id="complaint" className="textarea" rows={4} maxLength={COMPLAINT_MAX} autoFocus
                  placeholder={t("For example: the screen is cracked, or one item is missing from the box")}
                  value={complaint} onChange={e => setComplaint(e.target.value)} />
                <p className="hint">{complaintLen < COMPLAINT_MIN ? t("A sentence or two is enough.") : t("{n} of {max} characters", { n: complaintLen, max: COMPLAINT_MAX })}</p>
              </div>
              <div className="btn-row">
                <button onClick={sendComplaint} disabled={acting || complaintLen < COMPLAINT_MIN} className="btn btn-primary" style={{ flex: 1 }}>
                  {acting ? t("Sending...") : t("Send complaint")}
                </button>
                <button onClick={() => setComplaining(false)} disabled={acting} className="btn btn-secondary">{t("Cancel")}</button>
              </div>
            </>
          )
        ) : (
          <>
            <h2 id="review-title" className="section-title">{t("The review is over")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              {t("The {hours} hours for making a complaint have passed, and Zola is releasing the payment to the seller.", { hours: REVIEW_HOURS })}
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
            <h2 id="review-title" className="section-title">{t("The buyer reported a problem")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px", fontSize: 14 }}>
              {t("Your payment stays held while Zola looks into it. We may call or text you to hear your side.")}
            </p>
            <p className="said">{trade.complaint_text}</p>
            <p className="said-meta" suppressHydrationWarning>{t("Sent {date}", { date: fmtDateTime(trade.complaint_at, lang) })}</p>
            <p className="hint" style={{ margin: "16px 0 10px", fontSize: 14 }}>{t("You can also reach us directly.")}</p>
            <SupportButtons small />
          </>
        ) : review.windowOpen ? (
          <>
            <h2 id="review-title" className="section-title">{t("Delivery confirmed, now under review")}</h2>
            <p className="hint" style={{ margin: "2px 0 0", fontSize: 14 }} suppressHydrationWarning>
              {t("{name} confirmed delivery. Zola reviews every delivery for {hours} hours and checks with the buyer.", { name: trade.buyer_name, hours: REVIEW_HOURS })}{" "}
              {rich(t("If no problem is reported, your {amount} is released after <b>{until}</b>.", { amount: money(trade.amount), until: reviewUntil }), { b: (c) => <strong style={{ color: "var(--navy)" }}>{c}</strong> })}
            </p>
          </>
        ) : (
          <>
            <h2 id="review-title" className="section-title">{t("The review is over")}</h2>
            <p className="hint" style={{ margin: "2px 0 0", fontSize: 14 }}>
              {t("Zola is releasing your {amount}. You'll be notified when it reaches your wallet.", { amount: money(trade.amount) })}
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
          <ArrowLeft size={15} /> {t("Back")}
        </Link>

        {/* Header */}
        <div className="tx-head fade-up">
          <div style={{ flex: 1, minWidth: 0 }}>
            <StatusPill status={trade.status} />
            <h1 className="page-title" style={{ margin: "10px 0 4px", overflowWrap: "anywhere" }}>{trade.title}</h1>
            <p className="tx-id">{t("Transaction ID")} <strong>{shortId(trade.id)}</strong></p>
          </div>
          {(canEdit || canDelete) && !editing && (
            <div className="btn-row" style={{ flexShrink: 0, flexWrap: "nowrap" }}>
              {canEdit && (
                <button className="btn btn-secondary btn-sm" style={{ flex: "0 0 auto" }}
                  onClick={() => { setEditForm({ title: trade.title, description: trade.description, amount: String(trade.amount), deliveryDays: String(trade.delivery_days || 7), needsDelivery: trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0 }); setEditing(true); setEditErr(""); }}>
                  <Edit3 size={15} /> {t("Edit")}
                </button>
              )}
              {canDelete && (
                <button className="btn btn-danger-outline btn-sm" style={{ flex: "0 0 auto" }} onClick={() => setDelConfirm(true)}>
                  {buyerCancels ? <X size={15} /> : <Trash2 size={15} />} {buyerCancels ? t("Cancel") : t("Delete")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {delConfirm && (
          <div className="card card-pad card-danger fade-up" role="alertdialog" aria-labelledby="del-title" style={{ marginBottom: 16 }}>
            <h2 id="del-title" className="section-title">{buyerCancels ? t("Cancel this transaction?") : t("Delete this transaction?")}</h2>
            <p className="hint" style={{ margin: "2px 0 14px" }}>
              {buyerCancels
                ? t("Nothing has been paid. The seller is told you cancelled, and the transaction is removed.")
                : t("This can't be undone. The transaction and its activity history will be removed.")}
            </p>
            <div className="btn-row">
              <button onClick={deleteTrade} disabled={deleting} className="btn btn-danger">
                {deleting ? (buyerCancels ? t("Cancelling...") : t("Deleting...")) : buyerCancels ? t("Cancel transaction") : t("Delete transaction")}
              </button>
              <button onClick={() => setDelConfirm(false)} className="btn btn-secondary">{t("Keep it")}</button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="card card-pad fade-up" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2 className="section-title">{t("Edit transaction")}</h2>
              <button onClick={() => setEditing(false)} className="icon-btn" aria-label={t("Close")} style={{ width: 36, height: 36 }}><X size={17} /></button>
            </div>
            {editErr && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(editErr)}</div>}
            <div className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label className="label" htmlFor="e-title">{t("Title")}</label>
                <input id="e-title" className="input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label" htmlFor="e-desc">{t("Description")}</label>
                <textarea id="e-desc" className="textarea" rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label className="label" htmlFor="e-amount">{t("Item price (FCFA)")}</label>
                  <input id="e-amount" className="input num" type="number" min="1" inputMode="numeric" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="e-days">{t("Delivery time (days)")}</label>
                  <input id="e-days" className="input num" type="number" min="1" max="60" inputMode="numeric" value={editForm.deliveryDays} onChange={e => setEditForm(f => ({ ...f, deliveryDays: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <span className="label">{t("Does it need to be delivered?")}</span>
                <div className="seg" role="group" aria-label={t("Delivery")}>
                  <button type="button" className="seg-item" aria-pressed={editForm.needsDelivery}
                    onClick={() => setEditForm(f => ({ ...f, needsDelivery: true }))}>{t("Yes, deliver it")}</button>
                  <button type="button" className="seg-item" aria-pressed={!editForm.needsDelivery}
                    onClick={() => setEditForm(f => ({ ...f, needsDelivery: false }))}>{t("No, nothing to deliver")}</button>
                </div>
              </div>
              {Number(editForm.amount) > 0 && (
                <div className="kv" style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--r-md)" }}>
                  <span>{editQuote.deliveryFee > 0
                    ? t("Buyer pays, including the {rate} Zola fee and {delivery} delivery", { rate: feePercentLabel(Number(editForm.amount)), delivery: money(editQuote.deliveryFee) })
                    : t("Buyer pays, including the {rate} Zola fee", { rate: feePercentLabel(Number(editForm.amount)) })}</span>
                  <span>{money(editQuote.total)}</span>
                </div>
              )}
              <div className="btn-row">
                <button onClick={saveEdit} disabled={editSaving} className="btn btn-primary" style={{ flex: 1 }}>
                  <Save size={16} /> {editSaving ? t("Saving...") : t("Save changes")}
                </button>
                <button onClick={() => setEditing(false)} className="btn btn-secondary">{t("Cancel")}</button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} /> <span>{t(error)}</span>
          </div>
        )}

        {/* Zola flagged this seller after reports from buyers */}
        {sellerFlag?.flagged && isBuyer && !["complete", "cancelled"].includes(trade.status) && (
          <div className="notice notice-danger fade-up" role="alert" style={{ marginBottom: 16 }}>
            <Flag size={16} />
            <span>
              <strong>{t("Be careful with this seller.")}</strong>{" "}
              {t("Zola has received reports about {name}.", { name: trade.vendor_name })}{" "}
              {hasPaid
                ? t("Check your order carefully before you confirm delivery, and contact Zola if anything seems wrong.")
                : t("Think carefully before paying, and never pay the seller outside Zola.")}
            </span>
          </div>
        )}
        {sellerFlag?.flagged && isAdmin && (
          <div className="notice notice-danger fade-up" style={{ marginBottom: 16 }}>
            <Flag size={16} />
            <span suppressHydrationWarning>
              <strong>This seller is flagged.</strong> Buyers see a warning on this transaction.
              {sellerFlag.by ? ` Flagged by ${sellerFlag.by}${sellerFlag.at ? ` on ${fmtDate(sellerFlag.at)}` : ""}.` : ""}
              {sellerFlag.note ? ` Note: ${sellerFlag.note}` : ""}
            </span>
          </div>
        )}

        <div className="tx-layout">
          <div className="tx-main">

            {/* Where the money is, what happens next, who acts */}
            <section className="card card-pad tx-status fade-up" aria-label={t("Transaction status")}>
              {step > 0 && <div style={{ marginBottom: 26 }}><Steps step={step} /></div>}

              <MoneyRail
                at={s.money}
                you={isBuyer ? "buyer" : isVendor ? "seller" : undefined}
                names={{ buyer: buyerPending ? t("Invited buyer") : trade.buyer_name?.split(" ")[0], seller: vendorPending ? t("Invited seller") : trade.vendor_name?.split(" ")[0] }}
              />
              <p className="where">{story.where}</p>

              <div className="answers">
                <div className="answer">
                  <p className="answer-q">{t("What happens next")}</p>
                  <p className="answer-a">{story.next}</p>
                </div>
                <div className="answer">
                  <p className="answer-q">{t("Who needs to act")}</p>
                  <p className="answer-a" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {story.who}
                    {story.yourMove && <span className="tag tag-you">{t("Your move")}</span>}
                  </p>
                </div>
              </div>
            </section>

            {action}

            {/* Where the parcel is (buyer and admin) */}
            {(trade.dest_branch || trade.origin) && (isBuyer || isAdmin) && <DeliveryPanel trade={trade} delivery={delivery} viewer={isBuyer ? "buyer" : "admin"} onChange={load} />}

            {/* Activity */}
            <section className="card card-pad tx-activity fade-up" aria-labelledby="activity-title">
              <h2 id="activity-title" className="section-title" style={{ marginBottom: 16 }}>{t("Activity")}</h2>
              {events.length === 0
                ? <p className="hint">{t("Nothing has happened on this transaction yet.")}</p>
                : <Timeline events={events} />}
            </section>
          </div>

          {/* Details */}
          <aside className="tx-aside">
            <section className="card card-pad fade-up" aria-labelledby="money-title">
              <p id="money-title" className="stat-label" style={{ marginBottom: 4 }}>
                {isVendor ? t("You receive") : isBuyer ? (hasPaid ? t("You paid") : t("Total to pay")) : t("Buyer pays")}
              </p>
              <p className="amount-xl">{money(isVendor ? trade.amount : total)}</p>

              <div style={{ marginTop: 14 }}>
                <div className="kv"><span>{t("Item price")}</span><span>{money(trade.amount)}</span></div>
                <div className="kv"><span>{isVendor ? t("Zola fee ({rate}), paid by the buyer", { rate: feePercentOf(trade) }) : t("Zola fee ({rate})", { rate: feePercentOf(trade) })}</span><span>{money(trade.fee)}</span></div>
                {deliveryFee > 0 && <div className="kv"><span>{isVendor ? t("Delivery, paid by the buyer") : trade.delivery_km ? t("Delivery ({km} km)", { km: trade.delivery_km }) : t("Delivery")}</span><span>{money(deliveryFee)}</span></div>}
                {trade.delivery_pending && <div className="kv"><span>{t("Delivery")}</span><span>{t("By distance, once the buyer sets where to deliver")}</span></div>}
                <div className="kv kv-total"><span>{isBuyer ? t("Total") : t("Buyer pays")}</span><span>{money(total)}</span></div>
              </div>

              {!isBuyer && (
                <div className="receipt-out" style={{ marginTop: 14 }}>
                  <span>{isVendor ? t("Your payout") : t("Seller receives")}</span><strong>{money(trade.amount)}</strong>
                </div>
              )}
              {isVendor && (
                <div className="kv" style={{ marginTop: 8 }}><span>{t("Payout status")}</span><span>{PAYOUT_STATUS[trade.status] ? t(PAYOUT_STATUS[trade.status]) : "—"}</span></div>
              )}
              {isBuyer && isHeld && (
                <div className="receipt-out" style={{ marginTop: 14 }}>
                  <span>{t("Held by Zola for the seller")}</span><strong>{money(trade.amount)}</strong>
                </div>
              )}
            </section>

            <section className="card card-pad fade-up" aria-labelledby="details-title">
              <h2 id="details-title" className="section-title" style={{ marginBottom: 10 }}>{t("Details")}</h2>

              {trade.description && (
                <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{trade.description}</p>
              )}

              <hr className="divider" />

              {[
                buyerPending
                  ? { role: "Buyer, invited, not on Zola yet", name: prettyPhone(trade.buyer_phone), avatar: "?", you: false }
                  : { role: "Buyer", name: trade.buyer_name, avatar: trade.buyer_avatar, you: isBuyer },
                vendorPending
                  ? { role: "Seller, invited, not on Zola yet", name: prettyPhone(trade.vendor_phone), avatar: "?", you: false }
                  : { role: "Seller", name: trade.vendor_name, avatar: trade.vendor_avatar, you: isVendor },
              ].map(p => (
                <div key={p.role} className="party">
                  <span className="avatar">{initials(p.name, p.avatar)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="party-role">{t(p.role)}</p>
                    <p className="party-name">{p.name || "—"}</p>
                  </div>
                  {p.you && <span className="tag tag-you">{t("You")}</span>}
                </div>
              ))}

              <hr className="divider" />

              <div className="kv"><span>{t("Delivery")}</span><span>{trade.needs_delivery === false ? t("Not needed for this transaction") : DELIVERY_STATUS[trade.status] ? t(DELIVERY_STATUS[trade.status]) : "—"}</span></div>
              {trade.delivery_deadline
                ? <div className="kv"><span>{t("Deliver by")}</span><span suppressHydrationWarning>{fmtDate(trade.delivery_deadline, lang)}</span></div>
                : trade.delivery_days && ["awaiting_seller", "pending_payment"].includes(trade.status)
                  ? <div className="kv"><span>{t("Delivery time")}</span><span>{Number(trade.delivery_days) === 1 ? t("1 day after payment") : t("{n} days after payment", { n: trade.delivery_days })}</span></div>
                  : null}
              {trade.dest_branch && <div className="kv"><span>{t("Sent to")}</span><span style={{ textAlign: "right" }}>{trade.dest_branch.agency}, {trade.dest_branch.name} ({trade.dest_branch.city})</span></div>}
              {!trade.dest_branch && trade.delivery_mode === "out_of_town" && trade.origin?.city && <div className="kv"><span>{t("Buyer's city")}</span><span style={{ textAlign: "right" }}>{trade.origin.city}{delivery?.sent_agency ? ` (${delivery.sent_agency})` : ""}</span></div>}
              {trade.delivery_mode === "same_city" && trade.origin && <div className="kv"><span>{t("Collected from")}</span><span style={{ textAlign: "right" }}>{isVendor || isAdmin ? `${trade.origin.label} (${trade.origin.city})` : t("The seller, in {city}", { city: trade.origin.city })}</span></div>}
              {(trade.dest_branch || trade.origin) && delivery?.rider_name && isVendor && <div className="kv"><span>{t("Zola rider")}</span><span>{delivery.rider_name}</span></div>}
              {trade.tracking_number && <div className="kv"><span>{trade.dest_branch || trade.delivery_mode === "out_of_town" ? t("Agency receipt") : t("Tracking number")}</span><span>{trade.tracking_number}</span></div>}
              {trade.created_at && <div className="kv"><span>{t("Created")}</span><span suppressHydrationWarning>{fmtDate(trade.created_at, lang)}</span></div>}
              {deliveryFee > 0 && !isVendor && !["complete", "cancelled"].includes(trade.status) && (
                <p className="hint" style={{ marginTop: 10 }}>{t(DELIVERY_NOTE)}</p>
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

            {/* Report the seller: open to the buyer at any stage, even after completion */}
            {reportable && (
              <section className="card card-pad fade-up" aria-labelledby="report-title">
                {myReport ? (
                  <>
                    <h2 id="report-title" className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Flag size={16} /> {t("You reported this seller")}</h2>
                    <p className="hint" style={{ marginTop: 4 }} suppressHydrationWarning>
                      {reportSent
                        ? t("Thanks. Zola reviews every report and may contact you. The seller is not told who reported them.")
                        : t("Sent {date}: {reason}. Zola reviews every report and may contact you.", { date: fmtDate(myReport.created_at, lang), reason: t(reportReasonLabel(myReport.reason)) })}
                    </p>
                  </>
                ) : !reporting ? (
                  <>
                    <h2 id="report-title" className="section-title">{t("Problem with this seller?")}</h2>
                    <p className="hint" style={{ margin: "4px 0 12px" }}>
                      {t("Tell Zola, even after the transaction is completed. The seller is not told who reported them.")}
                    </p>
                    <button onClick={() => { setReporting(true); setReportErr(""); }} className="btn btn-secondary btn-sm">
                      <Flag size={15} /> {t("Report this seller")}
                    </button>
                  </>
                ) : (
                  <>
                    <h2 id="report-title" className="section-title">{t("Report {name}", { name: trade.vendor_name })}</h2>
                    <p className="hint" style={{ margin: "4px 0 12px" }}>{t("Zola reviews every report. If other buyers should be careful, we warn them about this seller.")}</p>
                    {reportErr && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(reportErr)}</div>}
                    <fieldset className="field" style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
                      <legend className="label" style={{ marginBottom: 6 }}>{t("What happened?")}</legend>
                      <div className="report-reasons">
                        {REPORT_REASONS.map(r => (
                          <label key={r.key} className="report-reason">
                            <input type="radio" name="report-reason" value={r.key} checked={reportReason === r.key} onChange={() => setReportReason(r.key)} />
                            <span>{t(r.label)}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label className="label" htmlFor="report-text">{t("Tell us more")}</label>
                      <textarea id="report-text" className="textarea" rows={4} maxLength={REPORT_MAX}
                        placeholder={t("What happened, and when? Include anything that helps us check.")}
                        value={reportText} onChange={e => setReportText(e.target.value)} />
                      <p className="hint">{reportText.trim().length < REPORT_MIN ? t("A sentence or two is enough.") : t("{n} of {max} characters", { n: reportText.trim().length, max: REPORT_MAX })}</p>
                    </div>
                    <div className="btn-row">
                      <button onClick={sendReport} disabled={acting || !reportReason || reportText.trim().length < REPORT_MIN} className="btn btn-danger" style={{ flex: 1 }}>
                        {acting ? t("Sending...") : t("Send report")}
                      </button>
                      <button onClick={() => setReporting(false)} disabled={acting} className="btn btn-secondary">{t("Cancel")}</button>
                    </div>
                  </>
                )}
              </section>
            )}

            {isBuyer && !["complete", "cancelled"].includes(trade.status) && (
              <p className="protect" style={{ padding: "0 4px" }}>
                <ShieldCheck size={17} />
                <span>{t("Your payment is protected by Zola until the transaction is completed.")}</span>
              </p>
            )}
            {isVendor && isHeld && trade.status !== "disputed" && (
              <p className="protect" style={{ padding: "0 4px" }}>
                <ShieldCheck size={17} />
                <span>{t("The buyer's payment is held by Zola. It is released to you after delivery is confirmed and the {hours}-hour review.", { hours: REVIEW_HOURS })}</span>
              </p>
            )}
            {!isAdmin && <div style={{ padding: "0 4px" }}><SupportLine /></div>}
          </aside>
        </div>
      </main>
    </div>
  );
}
