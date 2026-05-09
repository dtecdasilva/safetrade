import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";

export async function GET() {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    let snap;

    if (session.role === "admin") {
      snap = await db.collection("trades").orderBy("created_at", "desc").get();
    } else if (session.role === "vendor") {
      snap = await db.collection("trades")
        .where("vendor_id", "==", session.id)
        .orderBy("created_at", "desc")
        .get();
    } else {
      snap = await db.collection("trades")
        .where("buyer_id", "==", session.id)
        .orderBy("created_at", "desc")
        .get();
    }

    const trades = snap.docs.map(d => d.data());
    return NextResponse.json({ trades });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "vendor")
      return NextResponse.json({ error: "Only vendors can create trades" }, { status: 403 });

    const { title, description, amount, buyerEmail, deliveryDays } = await req.json();
    if (!title || !description || !amount || !buyerEmail)
      return NextResponse.json({ error: "All fields required" }, { status: 400 });

    const db = getDb();
    const buyerSnap = await db.collection("users")
      .where("email", "==", buyerEmail.toLowerCase())
      .where("role", "==", "buyer")
      .limit(1)
      .get();

    if (buyerSnap.empty)
      return NextResponse.json({ error: "Buyer not found" }, { status: 404 });

    const buyer = buyerSnap.docs[0].data();
    const fee = parseFloat((amount * 0.015).toFixed(2));
    const id = randomUUID();
    const now = new Date().toISOString();

    // Fetch vendor info for denormalized fields
    const vendorDoc = await db.collection("users").doc(session.id).get();
    const vendor = vendorDoc.data()!;

    await db.collection("trades").doc(id).set({
      id,
      title,
      description,
      amount,
      fee,
      status: "pending_payment",
      delivery_days: deliveryDays || 7,
      delivery_deadline: null,
      tracking_number: null,
      monetbil_transaction_id: null,
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      buyer_email: buyer.email,
      buyer_avatar: buyer.avatar,
      vendor_id: session.id,
      vendor_name: vendor.name,
      vendor_email: vendor.email,
      vendor_avatar: vendor.avatar,
      created_at: now,
      updated_at: now,
    });

    const eventId1 = randomUUID();
    await db.collection("trade_events").doc(eventId1).set({
      id: eventId1,
      trade_id: id,
      label: "Trade created",
      detail: `${session.name} created the trade for ${buyer.name}`,
      type: "info",
      created_at: now,
    });

    const emailResult = await sendEmail({
      to: buyer.email,
      subject: `SafeTrade: New transaction created by ${session.name}`,
      text: `Hi ${buyer.name},\n\n${session.name} created a new trade for you on SafeTrade.\n\nTitle: ${title}\nAmount: FCFA ${amount.toLocaleString()}\n\nVisit: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/trade/${id}\n\nPlease log in to review and pay to activate escrow.\n\nThanks,\nSafeTrade`,
      html: `<p>Hi ${buyer.name},</p><p><strong>${session.name}</strong> created a new trade for you on SafeTrade.</p><ul><li><strong>Title</strong>: ${title}</li><li><strong>Amount</strong>: FCFA ${amount.toLocaleString()}</li></ul><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/trade/${id}">Click here to review and pay</a>.</p><p>Thanks,<br/>SafeTrade</p>`,
    });

    const eventId2 = randomUUID();
    await db.collection("trade_events").doc(eventId2).set({
      id: eventId2,
      trade_id: id,
      label: emailResult.success ? "Buyer notified" : "Buyer notification failed",
      detail: emailResult.success ? `Notification sent to ${buyer.email}` : `Notification failed: ${emailResult.error}`,
      type: emailResult.success ? "success" : "warn",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, tradeId: id, emailSent: emailResult.success, emailError: emailResult.error });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}