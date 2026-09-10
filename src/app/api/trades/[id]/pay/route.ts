import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { chargeMobileMoney } from "@/lib/tranzak";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.buyer_id !== session.id)
      return NextResponse.json({ error: "Only the buyer can pay for this trade" }, { status: 403 });
    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: "Trade is not pending payment" }, { status: 400 });

    const body = await req.json();
    const { phoneNumber, network } = body;
    if (!phoneNumber?.trim())
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

    // Buyer pays buyer_total (item price + fee)
    const chargeAmount = trade.buyer_total || trade.amount;

    // Format phone with country code
    const phone = `237${phoneNumber.trim().replace(/^237/, "")}`;

    const result = await chargeMobileMoney({
      ref:         params.id,
      amount:      chargeAmount,
      phone,
      description: `SafeTrade: ${trade.title}`,
    });

    if (!result.success)
      return NextResponse.json({ error: result.error || "Payment initiation failed" }, { status: 500 });

    // Store Tranzak transaction ref
    const txRef = result.tx?.data?.requestId || result.tx?.data?.mchTransactionRef || params.id;
    await db.collection("trades").doc(params.id).update({
      tranzak_ref: txRef,
      updated_at:  new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "A payment prompt has been sent to your phone. Please approve it to complete the transaction.",
      ref:     txRef,
      status:  result.tx?.data?.status,
    });
  } catch (e: any) {
    console.error("[pay] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
