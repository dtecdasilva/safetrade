import { NextRequest, NextResponse } from "next/server";
import { confirmPayment } from "@/lib/payments";
import { confirmTopup, TOPUP_PREFIX } from "@/lib/pickup/topups";
import { confirmDirectPayment, DIRECT_PREFIX } from "@/lib/pickup/direct";

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

    // A delivery booked on Pickup
    if (String(tradeId).startsWith(DIRECT_PREFIX)) {
      const { result } = await confirmDirectPayment(String(tradeId), String(transId));
      console.log("[fapshi-webhook] pickup delivery", tradeId, "->", result);
      return NextResponse.json({ ok: true });
    }

    // A Pickup rider topping up their balance
    if (String(tradeId).startsWith(TOPUP_PREFIX)) {
      const { result } = await confirmTopup(String(tradeId), String(transId));
      console.log("[fapshi-webhook] top-up", tradeId, "->", result);
      return NextResponse.json({ ok: true });
    }

    // Ask Fapshi directly rather than trusting the payload, then apply the same
    // rules as the buyer's "Check payment" button (see lib/payments.ts)
    const { result, detail } = await confirmPayment(String(tradeId), String(transId));
    console.log("[fapshi-webhook]", tradeId, "->", result, detail || "");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[fapshi-webhook] error:", e.message, e.stack);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
