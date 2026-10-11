import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

/**
 * In-app notifications.
 *
 * Every time a transaction moves — created, paid, shipped, delivery
 * confirmed, payment released, disputed — the people involved get a
 * notification in the bell at the top of the app. Withdrawals do the same.
 *
 * Stored in the "notifications" collection, one document per recipient.
 * Admin notifications are addressed to ADMIN_AUDIENCE so every admin sees them.
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
}

export type TradeMove =
  | "created"
  | "edited"
  | "deleted"
  | "paid"
  | "payment_failed"
  | "shipped"
  | "delivered"
  | "released"
  | "disputed";

/** The audience a signed-in person reads notifications for. */
export function audienceFor(session: { id: string; role: string }): string {
  return session.role === "admin" ? ADMIN_AUDIENCE : session.id;
}

const fcfa = (n: unknown) => `FCFA ${(Number(n) || 0).toLocaleString("en-US")}`;

export async function sendNotifications(list: NotificationInput[]): Promise<void> {
  const items = list.filter((n) => n.userId);
  if (!items.length) return;
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

interface TradeLike {
  id: string;
  title: string;
  amount: number;
  buyer_total?: number;
  buyer_id: string;
  buyer_name?: string;
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
  opts: { actorId?: string; actorName?: string } = {}
): Promise<void> {
  try {
    const link   = `/trade/${trade.id}`;
    const item   = `“${trade.title}”`;
    const buyer  = trade.buyer_name  || "The buyer";
    const seller = trade.vendor_name || "The seller";
    const price  = fcfa(trade.amount);
    const total  = fcfa(trade.buyer_total || trade.amount);
    const base   = { link, tradeId: trade.id };
    const out: NotificationInput[] = [];

    switch (move) {
      case "created":
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: `New transaction from ${seller}`,
          body: `${item} is waiting for your payment. Pay ${total} to Zola and we hold it until your order arrives.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "New transaction created",
          body: `${seller} created ${item} for ${buyer}, ${price}.` });
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
          body: `${buyer} paid for ${item}. Zola is holding ${price} for you. Deliver the order to receive it.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: "Payment received",
          body: `Zola is holding your payment for ${item} until you confirm delivery.` });
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
          body: `${seller} shipped ${item}. Confirm delivery once it arrives so the seller can be paid.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "Order shipped",
          body: `${seller} shipped ${item} to ${buyer}.` });
        break;

      case "delivered":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Delivery confirmed",
          body: `${buyer} confirmed delivery of ${item}. Zola is releasing ${price} to you.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "warn",
          title: "Payment ready to release",
          body: `${buyer} confirmed delivery of ${item}. Release ${price} to ${seller}.` });
        break;

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
