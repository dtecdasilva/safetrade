import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.text();
    console.log("[monetbil-webhook] raw body:", body);

    const form = new URLSearchParams(body);
    const status      = form.get("status") || form.get("payment_status") || "";
    const transaction = form.get("transaction_id") || form.get("paymentId") || form.get("payment_id") || "";
    const phone       = form.get("phone") || "";

    console.log("[monetbil-webhook] status:", status, "transaction:", transaction);

    const isSuccess = ["success", "SUCCESS", "successful", "SUCCESSFUL", "1", "paid", "PAID"].includes(status);

    if (!isSuccess) {
      console.log("[monetbil-webhook] payment not successful, status was:", status);
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();

    if (!tradeDoc.exists) {
      console.error("[monetbil-webhook] trade not found:", params.id);
      return NextResponse.json({ ok: true });
    }

    const trade = tradeDoc.data()!;

    if (trade.status !== "pending_payment") {
      console.log("[monetbil-webhook] trade already processed, status:", trade.status);
      return NextResponse.json({ ok: true });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));

    await db.collection("trades").doc(params.id).update({
      status: "funds_held",
      delivery_deadline: deadline.toISOString(),
      monetbil_transaction_id: transaction || trade.monetbil_transaction_id,
      updated_at: new Date().toISOString(),
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId,
      trade_id: params.id,
      label: "Payment confirmed",
      detail: `FCFA ${Number(trade.amount).toLocaleString()} locked in escrow vault${phone ? ` (paid from ${phone})` : ""}`,
      type: "success",
      created_at: new Date().toISOString(),
    });

    console.log("[monetbil-webhook] ✓ trade updated to funds_held:", params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[monetbil-webhook] error:", e.message, e.stack);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
