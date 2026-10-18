import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/mail";
import { notifyTradeMove } from "@/lib/notifications";
import { quote, feePercentLabel, DELIVERY_NOTE } from "@/lib/fees";
import { cleanPhone as normalizePhone, cleanEmail, isEmail } from "@/lib/users";
import { INVITED_BUYER_NAME, INVITED_SELLER_NAME, invitedBuyerId, invitedSellerId, inviteSummary, sendBuyerInvite, sendSellerInvite, sellerInviteSummary } from "@/lib/invites";
import { siteUrl } from "@/lib/support";
import { branchSnapshot } from "@/lib/pickup/deliveries";
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
    if (session.role === "admin")
      return NextResponse.json({ error: "Admin accounts can't create transactions" }, { status: 403 });

    const body = await req.json();
    // Someone who is buying starts the transaction and the seller confirms it
    if (session.role === "buyer") return createAsBuyer(session, body);

    const { title, description, amount, buyerPhone, buyerEmail, deliveryDays, needsDelivery, destBranchId } = body;
    if (!title || !description || !amount || !buyerPhone)
      return NextResponse.json({ error: "Please fill in the item, description, price and the buyer's phone number" }, { status: 400 });

    // Clean phone — strip +237 prefix and non-digits
    const cleanPhone = normalizePhone(buyerPhone);
    if (cleanPhone.length < 8)
      return NextResponse.json({ error: "Enter the buyer's full phone number" }, { status: 400 });

    const db = getDb();

    const vendorDoc = await db.collection("users").doc(session.id).get();
    const vendor    = vendorDoc.data()!;
    if (vendor.phone && vendor.phone === cleanPhone)
      return NextResponse.json({ error: "That's your own number. Enter the buyer's phone number." }, { status: 400 });

    // Find buyer by phone number
    const buyerSnap = await db.collection("users")
      .where("phone", "==", cleanPhone)
      .limit(1)
      .get();

    let buyer: any = null;
    // The buyer has no Zola account yet: they are invited to sign up, then pay
    let invited = false;
    const inviteEmail = cleanEmail(buyerEmail);

    if (!buyerSnap.empty) {
      buyer = buyerSnap.docs[0].data();
      // Any account can buy, whichever side it is using right now
      if (buyer.role === "admin")
        return NextResponse.json({ error: "That number belongs to a Zola staff account. Enter the buyer's own number." }, { status: 400 });
    } else {
      // Nobody on Zola has this number. Ask the seller for the buyer's email so we can invite them.
      if (!inviteEmail)
        return NextResponse.json({
          error: "This buyer isn't on Zola yet. Enter their email and we'll invite them to sign up and pay.",
          code: "buyer_not_found",
        }, { status: 404 });
      if (!isEmail(inviteEmail))
        return NextResponse.json({ error: "Enter a valid email address for the buyer", code: "buyer_email_invalid" }, { status: 400 });
      if (inviteEmail === cleanEmail(vendor.email))
        return NextResponse.json({ error: "That's your own email. Enter the buyer's email.", code: "buyer_email_invalid" }, { status: 400 });

      // The email may already belong to someone on Zola under a different number
      const byEmail = await db.collection("users").where("email", "==", inviteEmail).limit(1).get();
      if (!byEmail.empty) {
        const found = byEmail.docs[0].data();
        if (found.role === "admin" || found.id === session.id)
          return NextResponse.json({ error: "Enter the buyer's own email.", code: "buyer_email_invalid" }, { status: 400 });
        buyer = found;
      } else {
        invited = true;
      }
    }

    // Fee added on top — buyer pays item price + fee, vendor receives full item price
    // Delivery is added unless the seller says there is nothing to deliver (a service, for example)
    const withDelivery = needsDelivery !== false;
    const { fee, deliveryFee, total: buyerTotal } = quote(Number(amount), withDelivery);

    // Goods go by bus agency: the seller picks the branch in the buyer's city.
    // (Required once Zola has agency branches set up.)
    const destBranch = withDelivery ? await branchSnapshot(db, destBranchId) : null;
    if (withDelivery && !destBranch && (await db.collection("agency_branches").where("active", "==", true).limit(1).get()).size > 0)
      return NextResponse.json({ error: "Choose the agency branch you will send it to" }, { status: 400 });

    const id  = randomUUID();
    const now = new Date().toISOString();

    const buyerFields = invited
      ? {
          buyer_id:     invitedBuyerId(cleanPhone),   // placeholder until they sign up
          buyer_name:   INVITED_BUYER_NAME,
          buyer_email:  inviteEmail,
          buyer_avatar: "",
          buyer_phone:  cleanPhone,
          buyer_pending:      true,
          buyer_invite_email: inviteEmail,
          buyer_invited_at:   now,
        }
      : {
          buyer_id:     buyer.id,
          buyer_name:   buyer.name,
          buyer_email:  buyer.email,
          buyer_avatar: buyer.avatar || "",
          buyer_phone:  buyer.phone || cleanPhone,
          buyer_pending: false,
        };

    await db.collection("trades").doc(id).set({
      id, title, description,
      created_by:  "seller",
      ...(destBranch ? { dest_branch: destBranch } : {}),
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
      ...buyerFields,
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
      detail: invited
        ? `${session.name} created this transaction for a buyer who is not on Zola yet`
        : `${session.name} created this transaction for ${buyer.name}`,
      type:   "info", created_at: now,
    });

    const appUrl = siteUrl();

    const tradeForNotice = {
      id, title, amount: Number(amount), fee, buyer_total: buyerTotal,
      needs_delivery: withDelivery, delivery_fee: deliveryFee,
      ...buyerFields,
      vendor_id: session.id, vendor_name: vendor.name,
    };

    // In-app notifications for the buyer and the admin
    await notifyTradeMove("created", tradeForNotice);

    // ── Buyer not on Zola yet: invite them by email and WhatsApp, then stop here ──
    if (invited) {
      notifyAdminTradeCreated({
        vendorName: vendor.name, buyerName: `${INVITED_BUYER_NAME} +237${cleanPhone}`,
        title, amount: buyerTotal, tradeId: id,
      }).catch(console.error);

      // The buyer has no account yet, so the invitation is written in the seller's language
      const result  = await sendBuyerInvite(tradeForNotice, vendor.lang === "fr" ? "fr" : "en");
      const summary = inviteSummary(tradeForNotice, result);
      // Remember which messages actually went out, so the seller is told the truth
      await db.collection("trades").doc(id).update({ buyer_invite_sent: { email: result.email, whatsapp: result.whatsapp } });
      const inviteEventId = randomUUID();
      await db.collection("trade_events").doc(inviteEventId).set({
        id: inviteEventId, trade_id: id, ...summary, created_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true, tradeId: id, invited: true,
        emailSent: result.email, whatsappSent: result.whatsapp,
      });
    }

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

    // Email, in the buyer's language
    const rate = feePercentLabel(Number(amount));
    // A seller Zola has flagged after reports: the buyer is warned before paying
    const warnFr = vendor.flagged ? " Attention : Zola a reçu des signalements sur ce vendeur. Réfléchissez bien avant de payer." : "";
    const warnEn = vendor.flagged ? " Be careful: Zola has received reports about this seller. Think carefully before paying." : "";
    const fmt = (n: number) => `FCFA ${Number(n).toLocaleString("en-US")}`;
    const payUrl = `${appUrl}/trade/${id}`;
    const emailResult = await sendEmail(buyer.lang === "fr" ? {
      to: buyer.email,
      subject: `Zola : ${session.name} a créé une transaction pour vous`,
      text: `Bonjour ${buyer.name},\n\n${session.name} a créé une transaction pour vous sur Zola.\n\nArticle : ${title}\nPrix de l'article : ${fmt(Number(amount))}\nFrais Zola (${rate}) : ${fmt(fee)}${deliveryFee > 0 ? `\nLivraison : ${fmt(deliveryFee)}` : ""}\nTotal à payer : ${fmt(buyerTotal)}\n\nVérifier et payer en sécurité : ${payUrl}\n\nVous payez Zola, pas le vendeur. Nous gardons votre paiement jusqu'à votre confirmation de livraison.${warnFr}\n\nZola\nTransactions sécurisées. Paiements simples.`,
      html: emailLayout({
        lang: "fr",
        heading: `${session.name} a créé une transaction pour vous`,
        intro: `Bonjour ${buyer.name}, vérifiez les détails ci-dessous et payez en sécurité quand vous êtes prêt.`,
        rows: [
          ["Article", title],
          ["Prix de l'article", fmt(Number(amount))],
          [`Frais Zola (${rate})`, fmt(fee)],
          ...(deliveryFee > 0 ? [["Livraison", fmt(deliveryFee)] as [string, string]] : []),
        ],
        totalRow: ["Total à payer", fmt(buyerTotal)],
        cta: { label: "Vérifier et payer en sécurité", url: payUrl },
        note: `Vous payez Zola, pas le vendeur. Nous gardons votre paiement jusqu'à votre confirmation de livraison.${deliveryFee > 0 ? " La livraison standard coûte FCFA 1,000. Si la livraison de votre article coûte plus cher, vous paierez la différence." : ""}${warnFr}`,
      }),
    } : {
      to: buyer.email,
      subject: `Zola: ${session.name} created a transaction for you`,
      text: `Hi ${buyer.name},\n\n${session.name} created a transaction for you on Zola.\n\nItem: ${title}\nItem price: ${fmt(Number(amount))}\nZola fee (${rate}): ${fmt(fee)}${deliveryFee > 0 ? `\nDelivery: ${fmt(deliveryFee)}` : ""}\nTotal to pay: ${fmt(buyerTotal)}\n\nReview and pay securely: ${payUrl}\n\nYou pay Zola, not the seller. We hold your payment until you confirm delivery.${warnEn}\n\nZola\nSecure transactions. Simple payments.`,
      html: emailLayout({
        heading: `${session.name} created a transaction for you`,
        intro: `Hi ${buyer.name}, review the details below and pay securely when you're ready.`,
        rows: [
          ["Item", title],
          ["Item price", fmt(Number(amount))],
          [`Zola fee (${rate})`, fmt(fee)],
          ...(deliveryFee > 0 ? [["Delivery", fmt(deliveryFee)] as [string, string]] : []),
        ],
        totalRow: ["Total to pay", fmt(buyerTotal)],
        cta: { label: "Review and pay securely", url: payUrl },
        note: `You pay Zola, not the seller. We hold your payment until you confirm delivery.${deliveryFee > 0 ? ` ${DELIVERY_NOTE}` : ""}${warnEn}`,
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

/**
 * A buyer starts the transaction. Nothing can be paid until the seller checks
 * the details and confirms (status "awaiting_seller"). If the seller isn't on
 * Zola yet, they are invited by email to sign up and confirm, and the buyer
 * gets a ready-made WhatsApp message to send them too.
 */
async function createAsBuyer(session: { id: string; name: string }, body: any) {
  const { title, description, amount, sellerPhone, sellerEmail, deliveryDays, needsDelivery } = body || {};
  if (!title || !description || !amount || !sellerPhone)
    return NextResponse.json({ error: "Please fill in the item, description, price and the seller's phone number" }, { status: 400 });
  if (!(Number(amount) > 0))
    return NextResponse.json({ error: "Enter the price you agreed" }, { status: 400 });

  const phone = normalizePhone(sellerPhone);
  if (phone.length < 8)
    return NextResponse.json({ error: "Enter the seller's full phone number" }, { status: 400 });

  const db = getDb();
  const me = (await db.collection("users").doc(session.id).get()).data()!;
  if (me.phone && me.phone === phone)
    return NextResponse.json({ error: "That's your own number. Enter the seller's phone number." }, { status: 400 });

  let seller: any = null;
  let invited = false;
  const inviteEmail = cleanEmail(sellerEmail);

  const byPhone = await db.collection("users").where("phone", "==", phone).limit(1).get();
  if (!byPhone.empty) {
    seller = byPhone.docs[0].data();
    if (seller.role === "admin")
      return NextResponse.json({ error: "That number belongs to a Zola staff account. Enter the seller's own number." }, { status: 400 });
  } else {
    if (!inviteEmail)
      return NextResponse.json({
        error: "This seller isn't on Zola yet. Enter their email and we'll invite them to sign up and confirm.",
        code: "seller_not_found",
      }, { status: 404 });
    if (!isEmail(inviteEmail))
      return NextResponse.json({ error: "Enter a valid email address for the seller", code: "seller_email_invalid" }, { status: 400 });
    if (inviteEmail === cleanEmail(me.email))
      return NextResponse.json({ error: "That's your own email. Enter the seller's email.", code: "seller_email_invalid" }, { status: 400 });
    const byEmail = await db.collection("users").where("email", "==", inviteEmail).limit(1).get();
    if (!byEmail.empty) {
      const found = byEmail.docs[0].data();
      if (found.role === "admin")
        return NextResponse.json({ error: "Enter the seller's own email.", code: "seller_email_invalid" }, { status: 400 });
      seller = found;
    } else {
      invited = true;
    }
  }

  const withDelivery = needsDelivery !== false;
  const { fee, deliveryFee, total: buyerTotal } = quote(Number(amount), withDelivery);
  const id  = randomUUID();
  const now = new Date().toISOString();

  const sellerFields = invited
    ? {
        vendor_id:     invitedSellerId(phone),   // placeholder until they sign up
        vendor_name:   INVITED_SELLER_NAME,
        vendor_email:  inviteEmail,
        vendor_avatar: "",
        vendor_phone:  phone,
        vendor_pending:      true,
        vendor_invite_email: inviteEmail,
        vendor_invited_at:   now,
      }
    : {
        vendor_id:     seller.id,
        vendor_name:   seller.name,
        vendor_email:  seller.email,
        vendor_avatar: seller.avatar || "",
        vendor_phone:  seller.phone || phone,
        vendor_pending: false,
      };

  const trade = {
    id, title, description,
    created_by: "buyer",
    amount: Number(amount),
    fee,
    needs_delivery: withDelivery,
    delivery_fee: deliveryFee,
    buyer_total: buyerTotal,
    status: "awaiting_seller",
    delivery_days: deliveryDays || 7,
    delivery_deadline: null,
    tracking_number: null,
    monetbil_transaction_id: null,
    buyer_id:     session.id,
    buyer_name:   me.name,
    buyer_email:  me.email,
    buyer_avatar: me.avatar || "",
    buyer_phone:  me.phone || "",
    buyer_pending: false,
    ...sellerFields,
    created_at: now,
    updated_at: now,
  };
  await db.collection("trades").doc(id).set(trade);

  const eventId = randomUUID();
  await db.collection("trade_events").doc(eventId).set({
    id: eventId, trade_id: id,
    label: "Transaction started by the buyer",
    detail: invited
      ? `${me.name} started this transaction with a seller who is not on Zola yet. The seller confirms the details, then the buyer pays.`
      : `${me.name} started this transaction with ${seller.name}. The seller confirms the details, then the buyer pays.`,
    type: "info", created_at: now,
  });

  await notifyTradeMove("requested", trade as any);

  let emailSent = false;
  if (invited) {
    // The seller has no account yet, so the invitation is written in the buyer's language
    const result = await sendSellerInvite(trade, me.lang === "fr" ? "fr" : "en");
    emailSent = result.email;
    await db.collection("trades").doc(id).update({ vendor_invite_sent: { email: result.email } });
    const inviteEventId = randomUUID();
    await db.collection("trade_events").doc(inviteEventId).set({
      id: inviteEventId, trade_id: id, ...sellerInviteSummary(trade, result), created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true, tradeId: id, invited, emailSent, sellerFlagged: !!seller?.flagged });
}
