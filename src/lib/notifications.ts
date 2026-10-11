import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/mail";
import { SUPPORT_LINE, prettyPhone, siteUrl } from "@/lib/support";
import { REVIEW_HOURS } from "@/lib/review";

/**
 * Notifications.
 *
 * Every time a transaction moves — created, paid, shipped, delivery
 * confirmed, complaint made, payment released, disputed — the people
 * involved get a notification in the bell at the top of the app AND the same
 * message by email. Withdrawals do the same.
 *
 * In-app: stored in the "notifications" collection, one document per
 * recipient. Admin notifications are addressed to ADMIN_AUDIENCE so every
 * admin sees them.
 *
 * Email: sent through Resend (see lib/mail.ts) to the address on the
 * person's account. Admin notifications go to ADMIN_EMAIL when it is set,
 * otherwise to the email of every admin account.
 *
 * Nothing here ever throws: a notification failing must never block a
 * payment or a status change.
 */

export const ADMIN_AUDIENCE = "admin";

export type NotificationTone = "info" | "success" | "warn" | "danger";

export interface NotificationInput {
  userId: string;
  title: string;
  body: string;
  link?: string;
  tone?: NotificationTone;
  tradeId?: string;
  /** Extra words for the email subject, usually the item name. */
  subject?: string;
  /** Set to false when this person already gets a fuller email for the same event. */
  email?: boolean;
}

export type TradeMove =
  | "created"
  | "buyer_joined"
  | "edited"
  | "deleted"
  | "paid"
  | "payment_failed"
  | "shipped"
  | "delivered"
  | "complained"
  | "complaint_resolved"
  | "released"
  | "disputed";

/** The audience a signed-in person reads notifications for. */
export function audienceFor(session: { id: string; role: string }): string {
  return session.role === "admin" ? ADMIN_AUDIENCE : session.id;
}

const fcfa = (n: unknown) => `FCFA ${(Number(n) || 0).toLocaleString("en-US")}`;

export async function sendNotifications(list: NotificationInput[]): Promise<void> {
  // "invited:<phone>" stands in for a buyer who has not signed up yet: there is
  // no account to notify, they get the invitation by email and WhatsApp instead.
  const items = list.filter((n) => n.userId && !n.userId.startsWith("invited:"));
  if (!items.length) return;
  // The bell and the inbox are independent: one failing never stops the other.
  await Promise.all([saveInApp(items), sendByEmail(items)]);
}

async function saveInApp(items: NotificationInput[]): Promise<void> {
  try {
    const db = getDb();
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const n of items) {
      const id = randomUUID();
      batch.set(db.collection("notifications").doc(id), {
        id,
        user_id: n.userId,
        title: n.title,
        body: n.body,
        link: n.link || "",
        tone: n.tone || "info",
        trade_id: n.tradeId || "",
        read: false,
        created_at: now,
      });
    }
    await batch.commit();
  } catch (e: any) {
    console.error("[notifications] failed to send:", e?.message);
  }
}

/* ── Email copies ────────────────────────────────────────────────────────── */

/** The seeded admin login is not a real mailbox, so nothing is sent to it. */
const PLACEHOLDER_EMAILS = new Set(["admin@safetrade.com"]);

function looksLikeEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Where admin notifications are emailed. */
async function adminEmails(): Promise<string[]> {
  const configured = (process.env.ADMIN_EMAIL || "")
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(looksLikeEmail);
  if (configured.length) return configured;

  const snap = await getDb().collection("users").where("role", "==", "admin").get();
  return snap.docs
    .map((d) => String(d.data().email || "").trim().toLowerCase())
    .filter((e) => looksLikeEmail(e) && !PLACEHOLDER_EMAILS.has(e));
}

async function emailsFor(userId: string): Promise<string[]> {
  if (userId === ADMIN_AUDIENCE) return adminEmails();
  const doc = await getDb().collection("users").doc(userId).get();
  const email = doc.exists ? String(doc.data()?.email || "").trim() : "";
  return looksLikeEmail(email) ? [email] : [];
}

function buttonLabel(link: string): string {
  if (link.startsWith("/trade/")) return "View transaction";
  if (link.startsWith("/withdraw")) return "Open your wallet";
  if (link.startsWith("/admin")) return "Open admin";
  return "Open Zola";
}

async function sendByEmail(items: NotificationInput[]): Promise<void> {
  try {
    const wanted = items.filter((n) => n.email !== false);
    if (!wanted.length) return;
    if (!process.env.RESEND_API_KEY) {
      console.warn("[notifications] email copies skipped: RESEND_API_KEY is not set.");
      return;
    }

    // Look each recipient up once, even if they get several messages
    const ids = Array.from(new Set(wanted.map((n) => n.userId)));
    const found = await Promise.all(
      ids.map(async (id) => {
        try { return [id, await emailsFor(id)] as const; }
        catch (e: any) { console.error("[notifications] email lookup failed:", e?.message); return [id, [] as string[]] as const; }
      })
    );
    const addresses = new Map<string, string[]>(found);
    const base = siteUrl();

    const jobs: Promise<unknown>[] = [];
    for (const n of wanted) {
      const link = n.link || "/dashboard";
      const url  = `${base}${link}`;
      const label = buttonLabel(link);
      const subject = `Zola: ${n.title}${n.subject ? ` · ${n.subject}` : ""}`;
      const text = `${n.body}\n\n${label}: ${url}\n\n${SUPPORT_LINE}\n\nZola\nSecure transactions. Simple payments.`;
      const html = emailLayout({ heading: n.title, intro: n.body, cta: { label, url } });
      for (const to of addresses.get(n.userId) || []) {
        jobs.push(
          sendEmail({ to, subject, text, html }).catch((e: any) =>
            console.error("[notifications] email failed:", e?.message)
          )
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch (e: any) {
    console.error("[notifications] email copies failed:", e?.message);
  }
}

interface TradeLike {
  id: string;
  title: string;
  amount: number;
  buyer_total?: number;
  buyer_id: string;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_pending?: boolean;
  needs_delivery?: boolean;
  delivery_fee?: number;
  vendor_id: string;
  vendor_name?: string;
}

/**
 * Tell everyone involved that a transaction has moved.
 * `actorId` is the person who caused the move; they aren't notified about
 * their own action unless the message is a useful confirmation.
 */
export async function notifyTradeMove(
  move: TradeMove,
  trade: TradeLike,
  opts: { actorId?: string; actorName?: string; reason?: string; note?: string } = {}
): Promise<void> {
  try {
    const link   = `/trade/${trade.id}`;
    const item   = `“${trade.title}”`;
    const buyer  = trade.buyer_name  || "The buyer";
    const seller = trade.vendor_name || "The seller";
    const price  = fcfa(trade.amount);
    const total  = fcfa(trade.buyer_total || trade.amount);
    const base   = { link, tradeId: trade.id, subject: trade.title };
    const phone  = prettyPhone(trade.buyer_phone);
    // Goods are handed to Zola for delivery; services have nothing to deliver
    const goods  = trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0;
    const out: NotificationInput[] = [];

    switch (move) {
      case "created":
        // The buyer already gets a fuller email (with the price breakdown) from the create step
        out.push({ ...base, userId: trade.buyer_id, tone: "info", email: false,
          title: `New transaction from ${seller}`,
          body: `${item} is waiting for your payment. Pay ${total} to Zola and we hold it until your order arrives.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "New transaction created",
          body: trade.buyer_pending
            ? `${seller} created ${item}, ${price}, for a buyer who is not on Zola yet${phone ? ` (${phone})` : ""}. They have been invited to sign up and pay.`
            : `${seller} created ${item} for ${buyer}, ${price}.` });
        break;

      case "buyer_joined":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Your buyer has joined Zola",
          body: `${buyer} created an account and can now pay ${total} for ${item}. We'll tell you as soon as the payment is held.` });
        // They are looking at the transaction right after signing up, so no email
        out.push({ ...base, userId: trade.buyer_id, tone: "info", email: false,
          title: `A transaction from ${seller} is waiting`,
          body: `${item} is waiting for your payment. Pay ${total} to Zola and we hold it until your order arrives.` });
        break;

      case "edited":
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Transaction details changed",
          body: `${seller} updated ${item}. The total to pay is now ${total}. Review the details before paying.` });
        break;

      case "deleted":
        out.push({ userId: trade.buyer_id, tone: "warn", link: "/dashboard",
          title: "Transaction removed by the seller",
          body: `${seller} deleted ${item} before payment. Nothing was charged.` });
        break;

      case "paid":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Payment secured",
          body: goods
            ? `${buyer} paid for ${item}. Zola is holding ${price} for you. Now send the item to Zola: we deliver it to the buyer, and the buyer has already paid for delivery.`
            : `${buyer} paid for ${item}. Zola is holding ${price} for you. Complete the work to receive it.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: "Payment received",
          body: goods
            ? `Zola is holding your payment for ${item}. The seller now sends it to Zola, and Zola delivers it to you.`
            : `Zola is holding your payment for ${item} until you confirm it has been delivered.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "Payment received",
          body: `${buyer} paid ${total} for ${item}. Zola is holding ${price} for ${seller}.` });
        break;

      case "payment_failed":
        out.push({ ...base, userId: trade.buyer_id, tone: "warn",
          title: "Payment not completed",
          body: `Your payment for ${item} was cancelled or timed out. No money was taken. You can try again.` });
        break;

      case "shipped":
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Your order is on its way",
          body: goods
            ? `${seller} has handed ${item} to Zola for delivery. Confirm delivery once it arrives so the seller can be paid.`
            : `${seller} marked ${item} as delivered. Confirm delivery once you have it so the seller can be paid.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: goods ? "warn" : "info",
          title: goods ? "Item handed over for delivery" : "Order marked as delivered",
          body: goods
            ? `${seller} marked ${item} as sent to Zola. Deliver it to ${buyer}${phone ? ` (${phone})` : ""}.`
            : `${seller} marked ${item} as delivered to ${buyer}.` });
        break;

      case "delivered":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Delivery confirmed, now under review",
          body: `${buyer} confirmed delivery of ${item}. Zola reviews every delivery for ${REVIEW_HOURS} hours, then releases ${price} to you.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Thanks for confirming delivery",
          body: `${item} is now under review for ${REVIEW_HOURS} hours. If anything is wrong with your order, make a complaint from the transaction page before the review ends. Zola may call or text you to check. After that, the seller is paid.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "warn",
          title: "Review started: call or text the buyer",
          body: `${buyer} confirmed delivery of ${item}. Call or text them${phone ? ` on ${phone}` : ""} to check, then release ${price} to ${seller} once the ${REVIEW_HOURS}-hour review is over.` });
        break;

      case "complained": {
        const said = opts.reason ? ` They said: “${opts.reason}”` : "";
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "danger",
          title: "Complaint to review",
          body: `${buyer} made a complaint about ${item}.${said} Call or text them${phone ? ` on ${phone}` : ""}. ${price} stays on hold for ${seller} until you mark it as resolved.` });
        out.push({ ...base, userId: trade.vendor_id, tone: "warn",
          title: "The buyer reported a problem",
          body: `${buyer} made a complaint about ${item}. Your payment of ${price} stays held by Zola while we look into it. We may call or text you.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "We've received your complaint",
          body: `Zola is looking into your complaint about ${item} and will call or text you. The seller is not paid until it is settled.` });
        break;
      }

      case "complaint_resolved": {
        const note = opts.note ? ` Note from Zola: “${opts.note}”` : "";
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Your complaint has been resolved",
          body: `Zola has closed your complaint about ${item}.${note}` });
        out.push({ ...base, userId: trade.vendor_id, tone: "info",
          title: "Complaint resolved",
          body: `The buyer's complaint about ${item} has been closed.${note}` });
        break;
      }

      case "released":
        out.push({ ...base, userId: trade.vendor_id, tone: "success", link: "/withdraw",
          title: "You've been paid",
          body: `${price} for ${item} is now in your Zola wallet, ready to withdraw.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: "Transaction completed",
          body: `Zola released your payment for ${item} to ${seller}.` });
        break;

      case "disputed": {
        const who = opts.actorName || "Someone";
        const text = `${who} opened a dispute on ${item}. The payment stays held by Zola while it is reviewed.`;
        if (opts.actorId !== trade.vendor_id)
          out.push({ ...base, userId: trade.vendor_id, tone: "danger", title: "Dispute opened", body: text });
        if (opts.actorId !== trade.buyer_id)
          out.push({ ...base, userId: trade.buyer_id, tone: "danger", title: "Dispute opened", body: text });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "danger",
          title: "Dispute to review",
          body: `${who} opened a dispute on ${item} (${buyer} and ${seller}). ${price} is on hold.` });
        break;
      }
    }

    await sendNotifications(out);
  } catch (e: any) {
    console.error("[notifications] trade move failed:", e?.message);
  }
}

/** A seller asked to withdraw: tell the admin there is a payout to send. */
export async function notifyWithdrawalRequested(w: {
  vendor_name?: string; amount: number; phone: string; network: string;
}): Promise<void> {
  await sendNotifications([{
    userId: ADMIN_AUDIENCE, tone: "warn", link: "/admin",
    title: "Withdrawal requested",
    body: `${w.vendor_name || "A seller"} asked to withdraw ${fcfa(w.amount)} to ${w.network}, +237${w.phone}.`,
  }]);
}

/** The admin sent a withdrawal: tell the seller the money is on its way. */
export async function notifyWithdrawalSent(w: {
  vendor_id: string; amount: number; phone: string; network: string;
}): Promise<void> {
  await sendNotifications([{
    userId: w.vendor_id, tone: "success", link: "/withdraw",
    title: "Withdrawal sent",
    body: `${fcfa(w.amount)} was sent to your ${w.network} number, +237${w.phone}.`,
  }]);
}
