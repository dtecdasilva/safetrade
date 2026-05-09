import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
    const { phoneNumber } = body;
    if (!phoneNumber?.trim())
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

    const monetbilServiceKey = process.env.MONETBIL_SERVICE_KEY;
    if (!monetbilServiceKey) {
      console.error("[pay] MONETBIL_SERVICE_KEY is not set in .env.local");
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL 
  ? process.env.NEXT_PUBLIC_APP_URL 
  : process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000";

    const payload = {
      amount: trade.amount,
      currency: "XAF",
      country: "CM",
      locale: "en",
      phone: `237${phoneNumber.trim()}`,
      phone_lock: false,
      item_ref: params.id,
      payment_ref: params.id,
      notify_url: `${appUrl}/api/trades/${params.id}/monetbil-webhook`,
      return_url: `${appUrl}/trade/${params.id}`,
    };

    console.log("[pay] Monetbil request payload:", JSON.stringify(payload));
    console.log("[pay] Monetbil service key (first 8 chars):", monetbilServiceKey.slice(0, 8));

    const response = await fetch(
      `https://api.monetbil.com/widget/v2.1/${monetbilServiceKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    console.log("[pay] Monetbil HTTP status:", response.status);
    console.log("[pay] Monetbil raw response:", responseText);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Payment service unavailable", details: responseText },
        { status: 500 }
      );
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (err: any) {
      console.error("[pay] Failed to parse Monetbil JSON:", err.message);
      return NextResponse.json(
        { error: "Invalid payment service response", details: responseText },
        { status: 502 }
      );
    }

    console.log("[pay] Monetbil parsed response:", JSON.stringify(data));

    const paymentId =
      data.paymentId || data.payment_id || data.transaction_id || data.id;

    if (paymentId) {
      await db.collection("trades").doc(params.id).update({
        monetbil_transaction_id: paymentId,
      });
    }

    // Return everything so the client can open the payment URL if present
    return NextResponse.json({
      ...data,
      ...(paymentId ? { paymentId } : {}),
    });
  } catch (e: any) {
    console.error("[pay] Unexpected error:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}