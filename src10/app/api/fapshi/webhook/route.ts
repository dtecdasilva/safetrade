import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getPaymentStatus } from "@/lib/fapshi";
import { notifyTradeMove } from "@/lib/notifications";

/**
 * Fapshi sends one static webhook URL per service (set in the Fapshi
 * dashboard) — unlike Monetbil's per-trade URL. We use `externalId`
 * (set to the trade id when we called direct-pay) to find the trade.
 *
 * Fapshi doesn't sign webhook payloads, so we treat the POST body only
 * as a "check now" signal and re-fetch the authoritative status via
 * GET /payment-status/{transId} before trusting it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[fapshi-webhook] payload:", JSON.stringify(body));

    const tradeId = body.externalId;
    const transId = body.transId;

    if (!tradeId || !transId) {
      console.error("[fapshi-webhook] missing externalId/transId in payload");
      return NextResponse.json({ ok: true });
    }

    // Re-fetch status from Fapshi directly rather than trusting the payload
    const check = await getPaymentStatus(transId);
    if (!check.success) {
      console.error("[fapshi-webhook] could not verify status:", check.error);
      return NextResponse.json({ ok: true });
    }

    const status = check.data?.status;
    console.log("[fapshi-webhook] verified status:", status, "trade:", tradeId);

    if (status !== "SUCCESSFUL") {
      console.log("[fapshi-webhook] payment not successful, status was:", status);
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(tradeId).get();

    if (!tradeDoc.exists) {
      console.error("[fapshi-webhook] trade not found:", tradeId);
      return NextResponse.json({ ok: true });
    }

    const trade = tradeDoc.data()!;

    if (trade.status !== "pending_payment") {
      console.log("[fapshi-webhook] trade already processed, status:", trade.status);
      return NextResponse.json({ ok: true });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));

    await db.collection("trades").doc(tradeId).update({
      status:             "funds_held",
      delivery_deadline:  deadline.toISOString(),
      fapshi_ref:         transId,
      updated_at:         new Date().toISOString(),
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id:         eventId,
      trade_id:   tradeId,
      label:      "Payment confirmed",
      detail:     `FCFA ${Number(trade.amount).toLocaleString()} safely held by Zola`,
      type:       "success",
      created_at: new Date().toISOString(),
    });

    await notifyTradeMove("paid", { ...(trade as any), id: tradeId });

    console.log("[fapshi-webhook] ✓ trade updated to funds_held:", tradeId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[fapshi-webhook] error:", e.message, e.stack);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
