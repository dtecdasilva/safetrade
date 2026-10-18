/**
 * Inviting a buyer who is not on Zola yet.
 *
 * A seller can create a transaction for a phone number that has no account.
 * Zola asks the seller for the buyer's email, creates the transaction, and
 * invites the buyer by email and WhatsApp to sign up so they can pay.
 *
 * Until the buyer signs up, the transaction's buyer_id is a placeholder
 * ("invited:<phone>") and buyer_pending is true. When someone registers as a
 * buyer with that phone number, that email, or from the invitation link, the
 * transaction is attached to their new account.
 */
import { randomUUID } from "crypto";
import { sendEmail, emailLayout } from "@/lib/mail";
import { notifyBuyerInvite } from "@/lib/whatsapp";
import { notifyTradeMove } from "@/lib/notifications";
import { feePercentOf, DELIVERY_NOTE } from "@/lib/fees";
import { supportLine, prettyPhone, siteUrl } from "@/lib/support";

const INVITED_PREFIX = "invited:";
export const INVITED_BUYER_NAME = "Invited buyer";
export const INVITED_SELLER_NAME = "Invited seller";

/** Minutes a seller must wait before sending the same invitation again. */
export const INVITE_RESEND_MINUTES = 5;

export function invitedBuyerId(phone: string): string {
  return `${INVITED_PREFIX}${phone}`;
}

/** Placeholder seller id for a transaction a buyer started with someone not on Zola yet. */
export const invitedSellerId = invitedBuyerId;

export function isInvitedBuyer(id: unknown): boolean {
  return typeof id === "string" && id.startsWith(INVITED_PREFIX);
}

/** The link in the invitation: signup with this transaction waiting at the end. */
export function inviteUrl(tradeId: string): string {
  return `${siteUrl()}/auth/register?invite=${tradeId}`;
}

const fcfa = (n: unknown) => `FCFA ${(Number(n) || 0).toLocaleString("en-US")}`;

export interface InviteResult { email: boolean; whatsapp: boolean; emailError?: string }

/** Email and WhatsApp the buyer, asking them to sign up so they can pay. */
export async function sendBuyerInvite(trade: any, lang: "en" | "fr" = "en"): Promise<InviteResult> {
  const url      = inviteUrl(trade.id);
  const seller   = trade.vendor_name || "A seller";
  const total    = fcfa(trade.buyer_total || trade.amount);
  const delivery = Number(trade.delivery_fee) || 0;

  const fr = lang === "fr";
  const rows: [string, string][] = [
    [fr ? "Article" : "Item", trade.title],
    [fr ? "Prix de l'article" : "Item price", fcfa(trade.amount)],
    [`${fr ? "Frais Zola" : "Zola fee"} (${feePercentOf(trade)})`, fcfa(trade.fee)],
    ...(delivery > 0 ? [[fr ? "Livraison" : "Delivery", fcfa(delivery)] as [string, string]] : []),
  ];
  const note = fr
    ? "Zola est un moyen sûr d'acheter à quelqu'un en ligne. Vous payez Zola, pas le vendeur, et nous gardons votre paiement jusqu'à ce que vous confirmiez l'arrivée de votre commande." +
      (delivery > 0 ? " La livraison standard coûte FCFA 1,000. Si la livraison de votre article coûte plus cher, vous paierez la différence." : "")
    : "Zola is a secure way to buy from someone online. You pay Zola, not the seller, and we hold your payment until you confirm your order has arrived." +
      (delivery > 0 ? ` ${DELIVERY_NOTE}` : "");

  const [emailRes, waRes] = await Promise.all([
    trade.buyer_email
      ? sendEmail(fr ? {
          to: trade.buyer_email,
          subject: `${seller} vous invite à payer en sécurité avec Zola · ${trade.title}`,
          text:
            `Bonjour,\n\n${seller} a créé une transaction pour vous sur Zola : ${trade.title}, ${total} au total.\n\n` +
            `Vous n'avez pas encore de compte Zola. Créez-en un (cela prend environ une minute), puis vous pourrez payer :\n${url}\n\n` +
            `Inscrivez-vous avec ce numéro pour que la transaction vous attende : ${prettyPhone(trade.buyer_phone)}\n\n` +
            `${note}\n\n${supportLine("fr")}\n\nZola\nTransactions sécurisées. Paiements simples.`,
          html: emailLayout({
            lang: "fr",
            heading: `${seller} vous invite à payer en sécurité avec Zola`,
            intro: `${seller} a créé une transaction pour vous. Vous n'avez pas encore de compte Zola : créez-en un d'abord (cela prend environ une minute). Ensuite, vous pourrez la vérifier et payer.`,
            rows,
            totalRow: ["Total à payer", total],
            cta: { label: "Créer mon compte pour payer", url },
            note,
          }),
        } : {
          to: trade.buyer_email,
          subject: `${seller} wants you to pay safely with Zola · ${trade.title}`,
          text:
            `Hello,\n\n${seller} created a transaction for you on Zola: ${trade.title}, ${total} in total.\n\n` +
            `You don't have a Zola account yet. Create one (it takes about a minute), then you can pay:\n${url}\n\n` +
            `Sign up with this phone number so the transaction is waiting for you: ${prettyPhone(trade.buyer_phone)}\n\n` +
            `${note}\n\n${supportLine("en")}\n\nZola\nSecure transactions. Simple payments.`,
          html: emailLayout({
            heading: `${seller} wants you to pay safely with Zola`,
            intro: `${seller} created a transaction for you. You don't have a Zola account yet, so create one first (it takes about a minute). Then you can review it and pay.`,
            rows,
            totalRow: ["Total to pay", total],
            cta: { label: "Create your account to pay", url },
            note,
          }),
        }).catch((e: any) => ({ success: false, error: e?.message as string }))
      : Promise.resolve({ success: false, error: "No email address" }),
    trade.buyer_phone
      ? notifyBuyerInvite({
          buyerPhone: trade.buyer_phone, vendorName: seller,
          title: trade.title, amount: Number(trade.buyer_total || trade.amount), url,
        }).catch(() => ({ success: false }))
      : Promise.resolve({ success: false }),
  ]);

  return { email: !!emailRes.success, whatsapp: !!waRes.success, emailError: (emailRes as any).error };
}

/** One line for the activity timeline saying where the invitation went. */
export function inviteSummary(trade: any, r: InviteResult): { label: string; detail: string; type: string } {
  const sent: string[] = [];
  if (r.email)    sent.push(`by email to ${trade.buyer_email}`);
  if (r.whatsapp) sent.push(`on WhatsApp to ${prettyPhone(trade.buyer_phone)}`);
  if (sent.length)
    return { label: "Buyer invited", detail: `Invitation to sign up and pay sent ${sent.join(" and ")}.`, type: "success" };
  return {
    label: "Invitation could not be sent",
    detail: `Neither the email nor the WhatsApp message went through. Share this link with the buyer yourself: ${inviteUrl(trade.id)}`,
    type: "warn",
  };
}

/**
 * Email a seller who is not on Zola yet: a buyer started a transaction with
 * them and wants to pay through Zola. There is no approved WhatsApp template
 * for this, so the buyer also gets a ready-made WhatsApp message to send.
 */
export async function sendSellerInvite(trade: any, lang: "en" | "fr" = "en"): Promise<InviteResult> {
  if (!trade.vendor_invite_email) return { email: false, whatsapp: false, emailError: "No email address" };
  const url   = inviteUrl(trade.id);
  const buyer = trade.buyer_name || (lang === "fr" ? "Un acheteur" : "A buyer");
  const fr    = lang === "fr";
  const rows: [string, string][] = [
    [fr ? "Article" : "Item", trade.title],
    [fr ? "Votre prix" : "Your price", fcfa(trade.amount)],
  ];
  const note = fr
    ? "Avec Zola, l'acheteur paie Zola, pas vous directement. Nous gardons l'argent et vous le versons dès que la livraison est confirmée. Vous recevez la totalité de votre prix : l'acheteur paie les frais Zola et la livraison."
    : "With Zola, the buyer pays Zola, not you directly. We hold the money and pay it to you once delivery is confirmed. You receive your full price: the buyer pays the Zola fee and delivery.";
  const res = await sendEmail(fr ? {
    to: trade.vendor_invite_email,
    subject: `${buyer} veut vous acheter « ${trade.title} » avec Zola`,
    text:
      `Bonjour,\n\n${buyer} veut vous acheter « ${trade.title} » pour ${fcfa(trade.amount)}, et payer en sécurité avec Zola.\n\n` +
      `Créez votre compte Zola (cela prend environ une minute), vérifiez les détails et confirmez. L'acheteur paie ensuite :\n${url}\n\n` +
      `${note}\n\n${supportLine("fr")}\n\nZola\nTransactions sécurisées. Paiements simples.`,
    html: emailLayout({
      lang: "fr",
      heading: `${buyer} veut vous acheter quelque chose avec Zola`,
      intro: `${buyer} a lancé une transaction avec vous. Vous n'avez pas encore de compte Zola : créez-en un, vérifiez les détails et confirmez. Ensuite, l'acheteur paie.`,
      rows,
      cta: { label: "Créer mon compte et confirmer", url },
      note,
    }),
  } : {
    to: trade.vendor_invite_email,
    subject: `${buyer} wants to buy "${trade.title}" from you with Zola`,
    text:
      `Hello,\n\n${buyer} wants to buy "${trade.title}" from you for ${fcfa(trade.amount)}, and pay safely through Zola.\n\n` +
      `Create your Zola account (it takes about a minute), check the details and confirm. Then the buyer pays:\n${url}\n\n` +
      `${note}\n\n${supportLine("en")}\n\nZola\nSecure transactions. Simple payments.`,
    html: emailLayout({
      heading: `${buyer} wants to buy from you with Zola`,
      intro: `${buyer} started a transaction with you. You don't have a Zola account yet, so create one, check the details and confirm. Then the buyer pays.`,
      rows,
      cta: { label: "Create your account and confirm", url },
      note,
    }),
  }).catch((e: any) => ({ success: false, error: e?.message as string }));
  return { email: !!res.success, whatsapp: false, emailError: (res as any).error };
}

/** One line for the activity timeline saying whether the seller's invitation went out. */
export function sellerInviteSummary(trade: any, r: InviteResult): { label: string; detail: string; type: string } {
  if (r.email)
    return { label: "Seller invited", detail: `Invitation to sign up and confirm sent by email to ${trade.vendor_invite_email}.`, type: "success" };
  return {
    label: "Invitation could not be sent",
    detail: `The email to the seller didn't go through. Send them the link yourself: ${inviteUrl(trade.id)}`,
    type: "warn",
  };
}

/**
 * Attach waiting transactions to someone who has just created an account.
 *
 * Buyer side: transactions a seller created for them (status pending_payment).
 * Seller side: transactions a buyer started with them (status awaiting_seller).
 * Either side matches on their phone number, their email, or the invitation
 * link they came from. Returns the ids of the transactions that are now theirs.
 */
export async function claimInvitedTrades(
  db: any,
  user: { id: string; name: string; email: string; phone?: string; avatar?: string; role: string },
  inviteId?: string
): Promise<string[]> {
  if (user.role === "admin") return [];
  try {
    const asBuyer  = new Map<string, any>();
    const asSeller = new Map<string, any>();
    const add = (d: any) => {
      const t = d.data();
      if (!t) return;
      const id = t.id || d.id;
      if (t.buyer_pending && t.status === "pending_payment") asBuyer.set(id, t);
      if (t.vendor_pending && t.status === "awaiting_seller") asSeller.set(id, t);
    };

    if (user.phone) {
      const placeholder = invitedBuyerId(user.phone);
      const [b, v] = await Promise.all([
        db.collection("trades").where("buyer_id", "==", placeholder).get(),
        db.collection("trades").where("vendor_id", "==", placeholder).get(),
      ]);
      b.docs.forEach(add); v.docs.forEach(add);
    }
    if (user.email) {
      const [b, v] = await Promise.all([
        db.collection("trades").where("buyer_invite_email", "==", user.email).get(),
        db.collection("trades").where("vendor_invite_email", "==", user.email).get(),
      ]);
      b.docs.forEach(add); v.docs.forEach(add);
    }
    if (inviteId && /^[\w-]{8,64}$/.test(inviteId)) {
      const doc = await db.collection("trades").doc(inviteId).get();
      if (doc.exists) add(doc);
    }

    const now = new Date().toISOString();
    const claimed: string[] = [];
    const event = async (tradeId: string, label: string, detail: string) => {
      const eventId = randomUUID();
      await db.collection("trade_events").doc(eventId).set({ id: eventId, trade_id: tradeId, label, detail, type: "success", created_at: now });
    };

    for (const [id, trade] of Array.from(asBuyer.entries())) {
      // A seller can't become the buyer of their own transaction
      if (trade.vendor_id === user.id) continue;
      const fields = {
        buyer_id: user.id,
        buyer_name: user.name,
        buyer_email: user.email,
        buyer_avatar: user.avatar || "",
        buyer_phone: user.phone || trade.buyer_phone || "",
        buyer_pending: false,
        buyer_joined_at: now,
        updated_at: now,
      };
      await db.collection("trades").doc(id).update(fields);
      await event(id, "Buyer joined Zola", `${user.name} created an account and can now pay for this transaction.`);
      await notifyTradeMove("buyer_joined", { ...trade, ...fields, id });
      claimed.push(id);
    }

    for (const [id, trade] of Array.from(asSeller.entries())) {
      // A buyer can't become the seller of their own transaction
      if (trade.buyer_id === user.id) continue;
      const fields = {
        vendor_id: user.id,
        vendor_name: user.name,
        vendor_email: user.email,
        vendor_avatar: user.avatar || "",
        vendor_phone: user.phone || trade.vendor_phone || "",
        vendor_pending: false,
        vendor_joined_at: now,
        updated_at: now,
      };
      await db.collection("trades").doc(id).update(fields);
      await event(id, "Seller joined Zola", `${user.name} created an account and can now confirm this transaction.`);
      await notifyTradeMove("seller_joined", { ...trade, ...fields, id });
      claimed.push(id);
    }
    return claimed;
  } catch (e: any) {
    // Signing up must never fail because of this
    console.error("[invites] could not attach invited transactions:", e?.message);
    return [];
  }
}
