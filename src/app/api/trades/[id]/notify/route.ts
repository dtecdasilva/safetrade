import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/mail";
import { INVITE_RESEND_MINUTES, inviteSummary, sendBuyerInvite } from "@/lib/invites";

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

    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: "The buyer has already paid for this transaction" }, { status: 400 });

    // Buyer not on Zola yet: the reminder is the invitation, sent again by email and WhatsApp
    if (trade.buyer_pending) {
      const last = trade.buyer_invited_at ? Date.parse(trade.buyer_invited_at) : 0;
      if (Date.now() - last < INVITE_RESEND_MINUTES * 60000)
        return NextResponse.json({ error: `An invitation was sent a moment ago. You can send another in ${INVITE_RESEND_MINUTES} minutes.` }, { status: 429 });

      const result  = await sendBuyerInvite({ ...trade, id: params.id });
      const summary = inviteSummary({ ...trade, id: params.id }, result);
      const now = new Date().toISOString();
      await db.collection("trades").doc(params.id).update({
        buyer_invited_at: now, updated_at: now,
        buyer_invite_sent: { email: result.email, whatsapp: result.whatsapp },
      });
      const inviteEventId = randomUUID();
      await db.collection("trade_events").doc(inviteEventId).set({
        id: inviteEventId, trade_id: params.id,
        ...summary, label: result.email || result.whatsapp ? "Invitation sent again" : summary.label,
        created_at: now,
      });
      return NextResponse.json({
        success: true, invited: true,
        emailSent: result.email, whatsappSent: result.whatsapp,
        emailError: result.email || result.whatsapp ? undefined : "The invitation could not be sent",
      });
    }

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