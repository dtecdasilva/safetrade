import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { chargeMobileMoney } from "@/lib/fapshi";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.buyer_id !== session.id)
      return NextResponse.json({ error: "Only the buyer can pay for this transaction" }, { status: 403 });
    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: "This transaction isn't waiting for payment" }, { status: 400 });

    const body = await req.json();
    const { phoneNumber, network } = body;
    if (!phoneNumber?.trim())
      return NextResponse.json({ error: "Enter your mobile money number" }, { status: 400 });
    if (network !== "mtn" && network !== "orange")
      return NextResponse.json({ error: "Choose a network" }, { status: 400 });

    // Buyer pays buyer_total (item price + fee)
    const chargeAmount = trade.buyer_total || trade.amount;

    // Fapshi wants the local 9-digit number, no 237 country-code prefix
    const phone = phoneNumber.trim().replace(/^237/, "");

    const result = await chargeMobileMoney({
      ref:         params.id,
      amount:      chargeAmount,
      phone,
      network,
      description: `Zola: ${trade.title}`,
    });

    if (!result.success)
      return NextResponse.json({ error: result.error || "The payment could not be started. Please try again." }, { status: 500 });

    // Store Fapshi transaction ref
    const txRef = result.transId || params.id;
    await db.collection("trades").doc(params.id).update({
      fapshi_ref: txRef,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "A payment prompt has been sent to your phone. Please approve it to complete the transaction.",
      ref:     txRef,
      status:  result.data?.status,
    });
  } catch (e: any) {
    console.error("[pay] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
