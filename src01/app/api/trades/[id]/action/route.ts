import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyTradeMove } from "@/lib/notifications";
import { COMPLAINT_MAX, COMPLAINT_MIN, REVIEW_HOURS, reviewEnd, reviewState } from "@/lib/review";
import {
  notifyVendorPaymentReceived,
  notifyBuyerItemShipped,
  notifyVendorDeliveryConfirmed,
  notifyAdminReleaseNeeded,
} from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const { action, trackingNumber, reason } = await req.json();
    const db = getDb();

    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    const trade = tradeDoc.data()!;

    const addEvent = async (label: string, detail: string, type = "info") => {
      const id = randomUUID();
      await db.collection("trade_events").doc(id).set({
        id, trade_id: params.id, label, detail, type,
        created_at: new Date().toISOString(),
      });
    };

    const updateTrade = async (fields: Record<string, any>) => {
      await db.collection("trades").doc(params.id).update({
        ...fields, updated_at: new Date().toISOString(),
      });
    };

    // Fetch buyer and vendor docs for their phone numbers
    const [buyerDoc, vendorDoc] = await Promise.all([
      db.collection("users").doc(trade.buyer_id).get(),
      db.collection("users").doc(trade.vendor_id).get(),
    ]);
    const buyer  = buyerDoc.data()  || {};
    const vendor = vendorDoc.data() || {};

    switch (action) {
      case "pay": {
        if (session.id !== trade.buyer_id)
          return NextResponse.json({ error: "Only the buyer can pay" }, { status: 403 });
        // This marks a transaction as paid WITHOUT taking any money. It is a leftover
        // testing shortcut: real payments go through /api/trades/[id]/pay and are
        // confirmed by the mobile money provider. It only works when
        // ALLOW_TEST_PAYMENTS=true is set, which must never be the case on the live site.
        if (process.env.ALLOW_TEST_PAYMENTS !== "true")
          return NextResponse.json({ error: "Payments are made with mobile money. Use Pay securely on the transaction page." }, { status: 400 });
        if (trade.status !== "pending_payment")
          return NextResponse.json({ error: "This transaction has already been paid" }, { status: 400 });
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));
        await updateTrade({ status: "funds_held", delivery_deadline: deadline.toISOString() });
        await addEvent("Payment confirmed", `FCFA ${trade.amount.toLocaleString()} safely held by Zola`, "success");
        await notifyTradeMove("paid", { ...(trade as any), id: params.id });
        // Notify vendor
        if (vendor.phone) {
          notifyVendorPaymentReceived({
            vendorPhone: vendor.phone, vendorName: trade.vendor_name,
            buyerName: trade.buyer_name, title: trade.title,
            amount: trade.amount, tradeId: params.id,
          }).catch(console.error);
        }
        break;
      }

      case "ship": {
        if (session.id !== trade.vendor_id)
          return NextResponse.json({ error: "Only the seller can mark this as shipped" }, { status: 403 });
        if (trade.status !== "funds_held")
          return NextResponse.json({ error: "The buyer hasn't paid yet" }, { status: 400 });
        await updateTrade({ status: "shipped", tracking_number: trackingNumber || "" });
        const goods = trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0;
        await addEvent(
          goods ? "Item sent to Zola" : "Marked as delivered",
          goods ? "The seller handed the item to Zola for delivery to the buyer" : "The seller marked the work as delivered",
          "info"
        );
        await notifyTradeMove("shipped", { ...(trade as any), id: params.id });
        // Notify buyer
        if (buyer.phone) {
          notifyBuyerItemShipped({
            buyerPhone: buyer.phone, buyerName: trade.buyer_name,
            vendorName: trade.vendor_name, title: trade.title,
            tradeId: params.id,
          }).catch(console.error);
        }
        break;
      }

      case "confirm": {
        if (session.id !== trade.buyer_id)
          return NextResponse.json({ error: "Only the buyer can confirm delivery" }, { status: 403 });
        if (!["shipped", "funds_held"].includes(trade.status))
          return NextResponse.json({ error: "Delivery can't be confirmed at this stage" }, { status: 400 });
        // Confirming starts a 24-hour review. The payment is released after it,
        // unless the buyer makes a complaint in that time.
        const confirmedAt = new Date().toISOString();
        await updateTrade({
          status: "pending_release",
          confirmed_at: confirmedAt,
          review_ends_at: reviewEnd(confirmedAt),
        });
        await addEvent(
          "Delivery confirmed, under review",
          `The buyer confirmed delivery. Zola reviews this for ${REVIEW_HOURS} hours before releasing the payment to the seller.`,
          "success"
        );
        await notifyTradeMove("delivered", { ...(trade as any), id: params.id });
        // Notify vendor + admin
        if (vendor.phone) {
          notifyVendorDeliveryConfirmed({
            vendorPhone: vendor.phone, vendorName: trade.vendor_name,
            buyerName: trade.buyer_name, title: trade.title,
            amount: trade.amount, tradeId: params.id,
          }).catch(console.error);
        }
        notifyAdminReleaseNeeded({
          buyerName: trade.buyer_name, vendorName: trade.vendor_name,
          title: trade.title, amount: trade.amount, tradeId: params.id,
        }).catch(console.error);
        break;
      }

      // After confirming, the buyer has 24 hours to say something is wrong.
      // This is a complaint, not a dispute: the transaction stays under review
      // and Zola calls or texts the buyer.
      case "complain": {
        if (session.id !== trade.buyer_id)
          return NextResponse.json({ error: "Only the buyer can make a complaint" }, { status: 403 });
        if (trade.status !== "pending_release")
          return NextResponse.json({ error: "A complaint can only be made after you confirm delivery, while the transaction is under review" }, { status: 400 });

        const review = reviewState(trade as any);
        if (review.hasComplaint)
          return NextResponse.json({ error: "You've already made a complaint on this transaction. Zola will call or text you about it." }, { status: 400 });
        if (!review.windowOpen)
          return NextResponse.json({ error: `The ${REVIEW_HOURS}-hour review has ended, so a complaint can no longer be made here. Contact Zola customer service instead.` }, { status: 400 });

        const text = String(reason || "").replace(/\s+/g, " ").trim().slice(0, COMPLAINT_MAX);
        if (text.length < COMPLAINT_MIN)
          return NextResponse.json({ error: "Tell us what went wrong, in a sentence or two" }, { status: 400 });

        await updateTrade({
          complaint_text: text,
          complaint_at: new Date().toISOString(),
          complaint_status: "open",
          complaint_by: session.id,
        });
        await addEvent("Complaint made", `${session.name} reported a problem: “${text}” The payment stays held while Zola looks into it.`, "warn");
        await notifyTradeMove("complained", { ...(trade as any), id: params.id }, { actorId: session.id, actorName: session.name, reason: text });
        break;
      }

      case "dispute": {
        if (session.id !== trade.buyer_id && session.id !== trade.vendor_id)
          return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
        if (!["shipped", "funds_held"].includes(trade.status))
          return NextResponse.json({ error: "A dispute can't be opened at this stage" }, { status: 400 });
        await updateTrade({ status: "disputed" });
        await addEvent("Dispute opened", `${session.name} opened a dispute. Zola is reviewing this transaction.`, "danger");
        await notifyTradeMove("disputed", { ...(trade as any), id: params.id }, { actorId: session.id, actorName: session.name });
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
