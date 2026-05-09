import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    console.log("[monetbil/notify] raw body:", body);

    const form = new URLSearchParams(body);
    const rawStatus  = form.get("status") || form.get("payment_status") || "";
    const paymentId  = form.get("transaction_id") || form.get("paymentId") || form.get("payment_id") || "";
    const phone      = form.get("phone") || "";

    console.log("[monetbil/notify] status:", rawStatus, "paymentId:", paymentId);

    const isPaid = ["success", "SUCCESS", "successful", "SUCCESSFUL", "1", "paid", "PAID"].includes(rawStatus);

    if (!isPaid) {
      console.log("[monetbil/notify] payment not successful, ignoring");
      return NextResponse.json({ ok: true });
    }

    if (!paymentId) {
      console.error("[monetbil/notify] no paymentId in payload");
      return NextResponse.json({ ok: true });
    }

    const db = getDb();

    // Find the trade by monetbil_transaction_id
    const snap = await db
      .collection("trades")
      .where("monetbil_transaction_id", "==", paymentId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.error("[monetbil/notify] no trade found for paymentId:", paymentId);
      return NextResponse.json({ ok: true });
    }

    const tradeDoc = snap.docs[0];
    const trade = tradeDoc.data();

    if (trade.status !== "pending_payment") {
      console.log("[monetbil/notify] trade already processed, status:", trade.status);
      return NextResponse.json({ ok: true });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));

    await db.collection("trades").doc(tradeDoc.id).update({
      status: "funds_held",
      delivery_deadline: deadline.toISOString(),
      updated_at: new Date().toISOString(),
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId,
      trade_id: tradeDoc.id,
      label: "Payment confirmed",
      detail: `FCFA ${Number(trade.amount).toLocaleString()} locked in escrow vault${phone ? ` (paid from ${phone})` : ""}`,
      type: "success",
      created_at: new Date().toISOString(),
    });

    console.log("[monetbil/notify] ✓ trade updated to funds_held:", tradeDoc.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[monetbil/notify] error:", e.message, e.stack);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
