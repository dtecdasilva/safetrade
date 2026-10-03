import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/mail";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (session.role !== "vendor" || session.id !== trade.vendor_id)
      return NextResponse.json({ error: "Only the seller who created this transaction can send reminders" }, { status: 403 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emailResult = await sendEmail({
      to: trade.buyer_email,
      subject: `Zola: Reminder to pay for "${trade.title}"`,
      text: `Hi ${trade.buyer_name},\n\nThis is a reminder that ${session.name} created a transaction for you on Zola.\n\nItem: ${trade.title}\nItem price: FCFA ${trade.amount.toLocaleString()}\n\nReview and pay securely: ${appUrl}/trade/${trade.id}\n\nYou pay Zola, not the seller. We hold your payment until you confirm delivery.\n\nZola\nSecure transactions. Simple payments.`,
      html: emailLayout({
        heading: "A transaction is waiting for your payment",
        intro: `Hi ${trade.buyer_name}, this is a reminder that ${session.name} created a transaction for you on Zola.`,
        rows: [
          ["Item", trade.title],
          ["Item price", `FCFA ${trade.amount.toLocaleString()}`],
        ],
        cta: { label: "Review and pay securely", url: `${appUrl}/trade/${trade.id}` },
        note: "You pay Zola, not the seller. We hold your payment until you confirm delivery.",
      }),
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId,
      trade_id: trade.id,
      label: emailResult.success ? "Reminder sent" : "Reminder could not be sent",
      detail: emailResult.success ? `Reminder sent to ${trade.buyer_email}` : `Reminder failed: ${emailResult.error}`,
      type: emailResult.success ? "success" : "warn",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, emailSent: emailResult.success, emailError: emailResult.error });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}