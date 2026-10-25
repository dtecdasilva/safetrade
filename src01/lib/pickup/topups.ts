/**
 * Riders topping up their Pickup balance with mobile money.
 *
 * A top-up is a Fapshi payment whose externalId is the top-up's id
 * ("topup_<uuid>"), so the same Fapshi webhook that confirms Zola payments
 * also confirms top-ups. The rider's "Check" button asks Fapshi directly,
 * like "Check payment" does for buyers.
 */
import { getDb } from "@/lib/db";
import { getPaymentStatus } from "@/lib/fapshi";
import { moveRiderMoney, retryWaiting } from "@/lib/pickup/deliveries";

export const TOPUP_PREFIX = "topup_";

export type TopupCheck = "paid" | "already_paid" | "pending" | "failed" | "mismatch" | "unknown";

export async function confirmTopup(topupId: string, transId?: string): Promise<{ result: TopupCheck; balance?: number }> {
  const db: any = getDb();
  const ref = db.collection("rider_topups").doc(topupId);
  const doc = await ref.get();
  if (!doc.exists) return { result: "mismatch" };
  const t = doc.data();
  if (t.status === "paid") return { result: "already_paid" };

  const check = await getPaymentStatus(transId || t.fapshi_ref);
  if (!check.success) return { result: "unknown" };
  const data = check.data || {};
  if (data.externalId && String(data.externalId) !== topupId) return { result: "mismatch" };
  const status = String(data.status || "").toUpperCase();
  if (status === "FAILED" || status === "EXPIRED") {
    await ref.update({ status: "failed", updated_at: new Date().toISOString() });
    return { result: "failed" };
  }
  if (status !== "SUCCESSFUL") return { result: "pending" };
  if (data.amount !== undefined && Number(data.amount) < Number(t.amount)) return { result: "mismatch" };

  // Credit it once only, even if the webhook and the rider's check arrive together
  const claimed: boolean = await db.runTransaction(async (tx: any) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || fresh.data().status === "paid") return false;
    tx.update(ref, { status: "paid", paid_at: new Date().toISOString() });
    return true;
  });
  if (!claimed) return { result: "already_paid" };

  const balance = await moveRiderMoney(db, t.rider_id, Number(t.amount), { type: "topup", note: "Top-up by mobile money", ref: topupId });
  // A bigger balance may let this rider take a delivery that was waiting
  const rider = (await db.collection("riders").doc(t.rider_id).get()).data();
  if (rider) await retryWaiting(db, rider.city);
  return { result: "paid", balance };
}
