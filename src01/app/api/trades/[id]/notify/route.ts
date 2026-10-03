import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (session.role !== "vendor" || session.id !== trade.vendor_id)
      return NextResponse.json({ error: "Only the vendor that created the trade can resend notifications" }, { status: 403 });

    const emailResult = await sendEmail({
      to: trade.buyer_email,
      subject: `SafeTrade: Reminder — trade created by ${session.name}`,
      text: `Hi ${trade.buyer_name},\n\nThis is a reminder that ${session.name} created a trade for you on SafeTrade.\n\nTitle: ${trade.title}\nAmount: FCFA ${trade.amount.toLocaleString()}\n\nVisit: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/trade/${trade.id} to review and pay.\n\nThanks,\nSafeTrade`,
      html: `<p>Hi ${trade.buyer_name},</p><p>This is a reminder that <strong>${session.name}</strong> created a trade for you on SafeTrade.</p><ul><li><strong>Title</strong>: ${trade.title}</li><li><strong>Amount</strong>: FCFA ${trade.amount.toLocaleString()}</li></ul><p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/trade/${trade.id}">Click here to review and pay</a>.</p><p>Thanks,<br/>SafeTrade</p>`,
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId,
      trade_id: trade.id,
      label: emailResult.success ? "Notification resent" : "Notification resend failed",
      detail: emailResult.success ? `Reminder sent to ${trade.buyer_email}` : `Reminder failed: ${emailResult.error}`,
      type: emailResult.success ? "success" : "warn",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, emailSent: emailResult.success, emailError: emailResult.error });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}