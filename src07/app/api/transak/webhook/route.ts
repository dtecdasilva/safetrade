import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getTranzak } from "@/lib/tranzak";
import { notifyVendorPaymentReceived } from "@/lib/whatsapp";
import { notifyTradeMove } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[tranzak/webhook] raw body:", JSON.stringify(body));

    const client = getTranzak();

    // Register listeners before processing
    let handled = false;

    client.webhook.addListener("payment.collection.completed", async (tx: any) => {
      handled = true;
      console.log("[tranzak/webhook] payment.collection.completed:", JSON.stringify(tx?.data));

      const ref     = tx?.data?.mchTransactionRef || tx?.data?.requestId;
      const amount  = tx?.data?.amount;

      if (!ref) { console.error("[tranzak/webhook] no ref found"); return; }

      const db = getDb();

      // Find trade by ID (we used trade ID as mchTransactionRef)
      let tradeDoc = await db.collection("trades").doc(ref).get();

      if (!tradeDoc.exists) {
        // Try by tranzak_ref field
        const snap = await db.collection("trades").where("tranzak_ref", "==", ref).limit(1).get();
        if (snap.empty) { console.error("[tranzak/webhook] trade not found for ref:", ref); return; }
        tradeDoc = snap.docs[0] as any;
      }

      const trade   = tradeDoc.data()!;
      const tradeId = trade.id || tradeDoc.id;

      if (trade.status !== "pending_payment") {
        console.log("[tranzak/webhook] trade already processed:", trade.status);
        return;
      }

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));

      await db.collection("trades").doc(tradeId).update({
        status:            "funds_held",
        delivery_deadline: deadline.toISOString(),
        updated_at:        new Date().toISOString(),
      });

      const eventId = randomUUID();
      await db.collection("trade_events").doc(eventId).set({
        id:         eventId,
        trade_id:   tradeId,
        label:      "Payment confirmed",
        detail:     `FCFA ${Number(trade.buyer_total || trade.amount).toLocaleString()} received and safely held by Zola`,
        type:       "success",
        created_at: new Date().toISOString(),
      });

      // Notify vendor on WhatsApp
      const vendorDoc = await db.collection("users").doc(trade.vendor_id).get();
      const vendor    = vendorDoc.data();
      if (vendor?.phone) {
        notifyVendorPaymentReceived({
          vendorPhone: vendor.phone,
          vendorName:  trade.vendor_name,
          buyerName:   trade.buyer_name,
          title:       trade.title,
          amount:      trade.amount,
          tradeId,
        }).catch(console.error);
      }

      await notifyTradeMove("paid", { ...(trade as any), id: tradeId });

      console.log("[tranzak/webhook] trade updated to funds_held:", tradeId);
    });

    client.webhook.addListener("payment.collection.canceled", async (tx: any) => {
      handled = true;
      console.log("[tranzak/webhook] payment.collection.canceled:", JSON.stringify(tx?.data));

      const ref = tx?.data?.mchTransactionRef || tx?.data?.requestId;
      if (!ref) return;

      const db = getDb();
      let tradeDoc = await db.collection("trades").doc(ref).get();
      if (!tradeDoc.exists) {
        const snap = await db.collection("trades").where("tranzak_ref", "==", ref).limit(1).get();
        if (snap.empty) return;
        tradeDoc = snap.docs[0] as any;
      }

      const trade   = tradeDoc.data()!;
      const tradeId = trade.id || tradeDoc.id;

      const eventId = randomUUID();
      await db.collection("trade_events").doc(eventId).set({
        id:         eventId,
        trade_id:   tradeId,
        label:      "Payment cancelled",
        detail:     "The buyer cancelled or the payment timed out. They can try again.",
        type:       "warn",
        created_at: new Date().toISOString(),
      });

      await notifyTradeMove("payment_failed", { ...(trade as any), id: tradeId });

      console.log("[tranzak/webhook] payment cancelled for trade:", tradeId);
    });

    // Process the webhook — returns true if valid, false if fake
    const valid = await client.webhook.process(body);

    if (!valid) {
      console.warn("[tranzak/webhook] invalid/fake webhook received");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[tranzak/webhook] error:", e.message, e.stack);
    return NextResponse.json({ ok: true }); // always 200 to prevent retries
  }
}
