import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/mail";
import { INVITE_RESEND_MINUTES, inviteSummary, sendBuyerInvite, sendSellerInvite, sellerInviteSummary } from "@/lib/invites";
import { notifySellerReminder } from "@/lib/notifications";
import { siteUrl } from "@/lib/support";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const trade = tradeDoc.data()!;

    // A buyer waiting for the seller to confirm a transaction they started
    if (trade.status === "awaiting_seller") {
      if (session.id !== trade.buyer_id)
        return NextResponse.json({ error: "Only the buyer who started this transaction can send reminders" }, { status: 403 });
      const last = Date.parse(trade.vendor_invited_at || trade.seller_reminded_at || "") || 0;
      if (Date.now() - last < INVITE_RESEND_MINUTES * 60000)
        return NextResponse.json({ error: `A message was sent a moment ago. You can send another in ${INVITE_RESEND_MINUTES} minutes.` }, { status: 429 });
      const now = new Date().toISOString();

      if (trade.vendor_pending) {
        const buyer  = (await db.collection("users").doc(trade.buyer_id).get()).data();
        const result = await sendSellerInvite({ ...trade, id: params.id }, buyer?.lang === "fr" ? "fr" : "en");
        await db.collection("trades").doc(params.id).update({ vendor_invited_at: now, updated_at: now, vendor_invite_sent: { email: result.email } });
        const summary = sellerInviteSummary({ ...trade, id: params.id }, result);
        const evId = randomUUID();
        await db.collection("trade_events").doc(evId).set({
          id: evId, trade_id: params.id, ...summary, label: result.email ? "Invitation sent again" : summary.label, created_at: now,
        });
        return NextResponse.json({ success: true, invited: true, emailSent: result.email, whatsappSent: false });
      }

      await notifySellerReminder({ ...(trade as any), id: params.id });
      await db.collection("trades").doc(params.id).update({ seller_reminded_at: now, updated_at: now });
      const evId = randomUUID();
      await db.collection("trade_events").doc(evId).set({
        id: evId, trade_id: params.id, label: "Reminder sent", detail: `Reminder sent to ${trade.vendor_name} to confirm the details`, type: "success", created_at: now,
      });
      return NextResponse.json({ success: true, emailSent: true });
    }

    if (session.id !== trade.vendor_id)
      return NextResponse.json({ error: "Only the seller who created this transaction can send reminders" }, { status: 403 });

    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: "The buyer has already paid for this transaction" }, { status: 400 });

    // Buyer not on Zola yet: the reminder is the invitation, sent again by email and WhatsApp
    if (trade.buyer_pending) {
      const last = trade.buyer_invited_at ? Date.parse(trade.buyer_invited_at) : 0;
      if (Date.now() - last < INVITE_RESEND_MINUTES * 60000)
        return NextResponse.json({ error: `An invitation was sent a moment ago. You can send another in ${INVITE_RESEND_MINUTES} minutes.` }, { status: 429 });

      const seller  = (await db.collection("users").doc(trade.vendor_id).get()).data();
      const result  = await sendBuyerInvite({ ...trade, id: params.id }, seller?.lang === "fr" ? "fr" : "en");
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

    const appUrl = siteUrl();
    const buyerDoc = await db.collection("users").doc(trade.buyer_id).get();
    const fr = buyerDoc.data()?.lang === "fr";
    const payUrl = `${appUrl}/trade/${trade.id}`;
    const price = `FCFA ${Number(trade.amount).toLocaleString("en-US")}`;
    const emailResult = await sendEmail(fr ? {
      to: trade.buyer_email,
      subject: `Zola : rappel de paiement pour « ${trade.title} »`,
      text: `Bonjour ${trade.buyer_name},\n\nPetit rappel : ${session.name} a créé une transaction pour vous sur Zola.\n\nArticle : ${trade.title}\nPrix de l'article : ${price}\n\nVérifier et payer en sécurité : ${payUrl}\n\nVous payez Zola, pas le vendeur. Nous gardons votre paiement jusqu'à votre confirmation de livraison.\n\nZola\nTransactions sécurisées. Paiements simples.`,
      html: emailLayout({
        lang: "fr",
        heading: "Une transaction attend votre paiement",
        intro: `Bonjour ${trade.buyer_name}, petit rappel : ${session.name} a créé une transaction pour vous sur Zola.`,
        rows: [["Article", trade.title], ["Prix de l'article", price]],
        cta: { label: "Vérifier et payer en sécurité", url: payUrl },
        note: "Vous payez Zola, pas le vendeur. Nous gardons votre paiement jusqu'à votre confirmation de livraison.",
      }),
    } : {
      to: trade.buyer_email,
      subject: `Zola: Reminder to pay for "${trade.title}"`,
      text: `Hi ${trade.buyer_name},\n\nThis is a reminder that ${session.name} created a transaction for you on Zola.\n\nItem: ${trade.title}\nItem price: ${price}\n\nReview and pay securely: ${payUrl}\n\nYou pay Zola, not the seller. We hold your payment until you confirm delivery.\n\nZola\nSecure transactions. Simple payments.`,
      html: emailLayout({
        heading: "A transaction is waiting for your payment",
        intro: `Hi ${trade.buyer_name}, this is a reminder that ${session.name} created a transaction for you on Zola.`,
        rows: [["Item", trade.title], ["Item price", price]],
        cta: { label: "Review and pay securely", url: payUrl },
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