import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyVendorFundsReleased } from "@/lib/whatsapp";
import { notifyTradeMove } from "@/lib/notifications";
import { reviewState } from "@/lib/review";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.status !== "pending_release")
      return NextResponse.json({ error: "This transaction isn't ready for release yet" }, { status: 400 });

    // The payment is only released once the 24-hour review allows it:
    // buyer contacted, no open complaint, and the 24 hours are over.
    const review = reviewState(trade as any);
    if (!review.canRelease)
      return NextResponse.json({ error: `This payment can't be released yet. ${review.blockers.join(" ")}`, blockers: review.blockers }, { status: 400 });

    await db.collection("trades").doc(params.id).update({
      status: "complete",
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId, trade_id: params.id,
      label: "Payment released",
      detail: `FCFA ${trade.amount.toLocaleString()} released to the seller`,
      type: "success",
      created_at: new Date().toISOString(),
    });

    await notifyTradeMove("released", { ...(trade as any), id: params.id });

    // Increment vendor trade_count
    const vendorRef = db.collection("users").doc(trade.vendor_id);
    const vendorDoc = await vendorRef.get();
    if (vendorDoc.exists) {
      const v = vendorDoc.data()!;
      await vendorRef.update({ trade_count: (v.trade_count || 0) + 1 });

      // Notify vendor on WhatsApp
      if (v.phone) {
        notifyVendorFundsReleased({
          vendorPhone: v.phone,
          vendorName: trade.vendor_name,
          title: trade.title,
          amount: trade.amount,
        }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
