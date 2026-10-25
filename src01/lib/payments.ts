/**
 * Confirming a buyer's payment.
 *
 * Fapshi normally tells Zola about a payment through the webhook. If that
 * message never arrives, the transaction would stay "Payment pending" even
 * though the buyer paid. confirmPayment() asks Fapshi directly, so the
 * webhook, the buyer's "Check payment" button, the admin's button and the
 * automatic check while the buyer waits all share exactly the same rules.
 */
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getPaymentStatus } from "@/lib/fapshi";
import { notifyTradeMove } from "@/lib/notifications";
import { notifyVendorPaymentReceived } from "@/lib/whatsapp";
import { startDelivery } from "@/lib/pickup/deliveries";

export type PaymentCheck =
  | "paid"          // confirmed just now: the transaction is now held by Zola
  | "already_paid"  // it had already been marked as paid
  | "pending"       // Fapshi is still waiting for the buyer to approve
  | "failed"        // the attempt failed or expired: the buyer can try again
  | "mismatch"      // Fapshi's record doesn't match this transaction: not trusted
  | "unknown";      // Fapshi couldn't be reached

export async function confirmPayment(tradeId: string, transId: string): Promise<{ result: PaymentCheck; detail?: string }> {
  const check = await getPaymentStatus(transId);
  if (!check.success) return { result: "unknown", detail: check.error };

  const data   = check.data || {};
  const status = String(data.status || "").toUpperCase();

  // The payment must belong to this transaction
  if (data.externalId && String(data.externalId) !== tradeId) {
    console.error("[payments] transId", transId, "belongs to", data.externalId, "not", tradeId);
    return { result: "mismatch", detail: "This payment belongs to another transaction" };
  }

  const db  = getDb();
  const ref = db.collection("trades").doc(tradeId);
  const doc = await ref.get();
  if (!doc.exists) return { result: "mismatch", detail: "Transaction not found" };
  const trade = doc.data()!;

  if (trade.status !== "pending_payment") return { result: "already_paid" };

  if (status === "FAILED" || status === "EXPIRED") {
    // The attempt is over: the seller may edit again and the buyer may retry
    await ref.update({ payment_started_at: null });
    return { result: "failed", detail: status };
  }
  if (status !== "SUCCESSFUL") return { result: "pending", detail: status };

  // Never accept less than the buyer owes (Fapshi charges whole francs)
  const owed = Math.round(Number(trade.buyer_total || trade.amount));
  if (data.amount !== undefined && Number(data.amount) < owed) {
    console.error("[payments] paid", data.amount, "but", owed, "is owed on", tradeId);
    return { result: "mismatch", detail: `Paid FCFA ${data.amount}, but FCFA ${owed} is owed` };
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));
  const now = new Date().toISOString();

  // Mark as paid only once, even if the webhook and a check arrive together
  const marked: boolean = await db.runTransaction(async (tx: any) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || fresh.data().status !== "pending_payment") return false;
    tx.update(ref, {
      status: "funds_held",
      delivery_deadline: deadline.toISOString(),
      fapshi_ref: transId,
      paid_at: now,
      updated_at: now,
    });
    return true;
  });
  if (!marked) return { result: "already_paid" };

  const eventId = randomUUID();
  await db.collection("trade_events").doc(eventId).set({
    id: eventId, trade_id: tradeId,
    label: "Payment confirmed",
    detail: `FCFA ${Number(trade.amount).toLocaleString()} safely held by Zola`,
    type: "success", created_at: now,
  });

  await notifyTradeMove("paid", { ...(trade as any), id: tradeId });

  // Goods sent through an agency: Pickup assigns a rider now
  await startDelivery(tradeId);

  try {
    const vendor = (await db.collection("users").doc(trade.vendor_id).get()).data();
    if (vendor?.phone) {
      notifyVendorPaymentReceived({
        vendorPhone: vendor.phone, vendorName: trade.vendor_name,
        buyerName: trade.buyer_name, title: trade.title,
        amount: trade.amount, tradeId,
      }).catch(console.error);
    }
  } catch (e: any) {
    console.error("[payments] WhatsApp to seller failed:", e?.message);
  }

  return { result: "paid" };
}
