import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/mail";
import { notifyTradeMove } from "@/lib/notifications";
import { quote, FEE_PERCENT_LABEL, DELIVERY_NOTE } from "@/lib/fees";
import {
  notifyBuyerTradeCreated,
  notifyAdminTradeCreated,
} from "@/lib/whatsapp";

function sortByDate(arr: any[]) {
  return arr.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
}

export async function GET() {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    let snap;
    if (session.role === "admin") {
      snap = await db.collection("trades").get();
    } else if (session.role === "vendor") {
      snap = await db.collection("trades").where("vendor_id", "==", session.id).get();
    } else {
      snap = await db.collection("trades").where("buyer_id", "==", session.id).get();
    }

    const trades = sortByDate(snap.docs.map(d => d.data()));
    return NextResponse.json({ trades });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
    if (session.role !== "vendor")
      return NextResponse.json({ error: "Only seller accounts can create transactions" }, { status: 403 });

    const { title, description, amount, buyerPhone, deliveryDays, needsDelivery } = await req.json();
    if (!title || !description || !amount || !buyerPhone)
      return NextResponse.json({ error: "Please fill in the item, description, price and the buyer's phone number" }, { status: 400 });

    // Clean phone — strip +237 prefix and non-digits
    const cleanPhone = buyerPhone.replace(/\D/g, "").replace(/^237/, "");

    const db = getDb();

    // Find buyer by phone number
    const buyerSnap = await db.collection("users")
      .where("phone", "==", cleanPhone)
      .limit(1)
      .get();

    if (buyerSnap.empty)
      return NextResponse.json({ error: "We couldn't find a Zola account with that phone number. Ask the buyer to create one first." }, { status: 404 });

    const buyer = buyerSnap.docs[0].data();
    if (buyer.role !== "buyer")
      return NextResponse.json({ error: "That number isn't registered to a buyer account" }, { status: 400 });

    // Fee added on top — buyer pays item price + fee, vendor receives full item price
    // Delivery is added unless the seller says there is nothing to deliver (a service, for example)
    const withDelivery = needsDelivery !== false;
    const { fee, deliveryFee, total: buyerTotal } = quote(Number(amount), withDelivery);

    const id  = randomUUID();
    const now = new Date().toISOString();

    const vendorDoc = await db.collection("users").doc(session.id).get();
    const vendor    = vendorDoc.data()!;

    await db.collection("trades").doc(id).set({
      id, title, description,
      amount:      Number(amount),  // vendor receives this in full
      fee,                           // Zola fee paid by buyer
      needs_delivery: withDelivery,  // false for services and other things with nothing to deliver
      delivery_fee: deliveryFee,     // standard delivery, paid by buyer (0 when not needed)
      buyer_total: buyerTotal,       // total buyer pays (item + fee + delivery)
      status:            "pending_payment",
      delivery_days:     deliveryDays || 7,
      delivery_deadline: null,
      tracking_number:   null,
      monetbil_transaction_id: null,
      buyer_id:     buyer.id,
      buyer_name:   buyer.name,
      buyer_email:  buyer.email,
      buyer_avatar: buyer.avatar || "",
      buyer_phone:  cleanPhone,
      vendor_id:     session.id,
      vendor_name:   vendor.name,
      vendor_email:  vendor.email,
      vendor_avatar: vendor.avatar || "",
      created_at: now,
      updated_at: now,
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId, trade_id: id,
      label:  "Transaction created",
      detail: `${session.name} created this transaction for ${buyer.name}`,
      type:   "info", created_at: now,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";

    // In-app notifications for the buyer and the admin
    await notifyTradeMove("created", {
      id, title, amount: Number(amount), buyer_total: buyerTotal,
      buyer_id: buyer.id, buyer_name: buyer.name,
      vendor_id: session.id, vendor_name: vendor.name,
    });

    // WhatsApp notifications (fire and forget)
    if (buyer.phone) {
      notifyBuyerTradeCreated({
        buyerPhone: buyer.phone, buyerName: buyer.name,
        vendorName: vendor.name, title,
        amount: buyerTotal, tradeId: id,
      }).catch(console.error);
    }
    notifyAdminTradeCreated({
      vendorName: vendor.name, buyerName: buyer.name,
      title, amount: buyerTotal, tradeId: id,
    }).catch(console.error);

    // Email fallback
    const emailResult = await sendEmail({
      to: buyer.email,
      subject: `Zola: ${session.name} created a transaction for you`,
      text: `Hi ${buyer.name},\n\n${session.name} created a transaction for you on Zola.\n\nItem: ${title}\nItem price: FCFA ${Number(amount).toLocaleString()}\nZola fee (${FEE_PERCENT_LABEL}): FCFA ${fee.toLocaleString()}${deliveryFee > 0 ? `\nDelivery: FCFA ${deliveryFee.toLocaleString()}` : ""}\nTotal to pay: FCFA ${buyerTotal.toLocaleString()}\n\nReview and pay securely: ${appUrl}/trade/${id}\n\nYou pay Zola, not the seller. We hold your payment until you confirm delivery.\n\nZola\nSecure transactions. Simple payments.`,
      html: emailLayout({
        heading: `${session.name} created a transaction for you`,
        intro: `Hi ${buyer.name}, review the details below and pay securely when you're ready.`,
        rows: [
          ["Item", title],
          ["Item price", `FCFA ${Number(amount).toLocaleString()}`],
          [`Zola fee (${FEE_PERCENT_LABEL})`, `FCFA ${fee.toLocaleString()}`],
          ...(deliveryFee > 0 ? [["Delivery", `FCFA ${deliveryFee.toLocaleString()}`] as [string, string]] : []),
        ],
        totalRow: ["Total to pay", `FCFA ${buyerTotal.toLocaleString()}`],
        cta: { label: "Review and pay securely", url: `${appUrl}/trade/${id}` },
        note: `You pay Zola, not the seller. We hold your payment until you confirm delivery.${deliveryFee > 0 ? ` ${DELIVERY_NOTE}` : ""}`,
      }),
    });

    const eventId2 = randomUUID();
    await db.collection("trade_events").doc(eventId2).set({
      id: eventId2, trade_id: id,
      label:  emailResult.success ? "Buyer notified" : "Buyer notification failed",
      detail: emailResult.success ? `Notification sent to ${buyer.email}` : `Email failed: ${emailResult.error}`,
      type:   emailResult.success ? "success" : "warn",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, tradeId: id, emailSent: emailResult.success });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
