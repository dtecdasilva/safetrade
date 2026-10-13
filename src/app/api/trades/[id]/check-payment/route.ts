import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { confirmPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  paid:         "Payment confirmed. Zola is now holding it.",
  already_paid: "This payment has already been confirmed.",
  pending:      "The payment hasn't gone through yet. If you approved it on your phone, wait a minute and check again.",
  failed:       "This payment didn't go through, so no money was taken. You can try again.",
  mismatch:     "We couldn't match this payment to the transaction. Contact Zola customer service.",
  unknown:      "We couldn't reach the payment service. Please try again in a minute.",
};

/**
 * "Check payment": asks Fapshi whether the latest payment attempt went
 * through, for when the usual confirmation never reached Zola.
 * Open to the buyer, the seller and admins.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const doc = await getDb().collection("trades").doc(params.id).get();
    if (!doc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    const trade = doc.data()!;

    if (session.role !== "admin" && session.id !== trade.buyer_id && session.id !== trade.vendor_id)
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    if (trade.status !== "pending_payment")
      return NextResponse.json({ result: "already_paid", message: MESSAGES.already_paid });
    if (!trade.fapshi_ref)
      return NextResponse.json({ error: "No payment has been started for this transaction yet" }, { status: 400 });

    const { result } = await confirmPayment(params.id, String(trade.fapshi_ref));
    return NextResponse.json({ result, message: MESSAGES[result] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
