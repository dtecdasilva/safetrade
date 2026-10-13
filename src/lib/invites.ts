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

/** Minutes a seller must wait before sending the same invitation again. */
export const INVITE_RESEND_MINUTES = 5;

export function invitedBuyerId(phone: string): string {
  return `${INVITED_PREFIX}${phone}`;
}

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
 * Attach waiting transactions to someone who has just created a buyer account.
 * Matches on their phone number, their email, or the invitation link they came from.
 * Returns the ids of the transactions that are now theirs.
 */
export async function claimInvitedTrades(
  db: any,
  user: { id: string; name: string; email: string; phone?: string; avatar?: string; role: string },
  inviteId?: string
): Promise<string[]> {
  if (user.role !== "buyer") return [];
  try {
    const found = new Map<string, any>();
    const add = (d: any) => { const t = d.data(); if (t && t.buyer_pending && t.status === "pending_payment") found.set(t.id || d.id, t); };

    if (user.phone) {
      const snap = await db.collection("trades").where("buyer_id", "==", invitedBuyerId(user.phone)).get();
      snap.docs.forEach(add);
    }
    if (user.email) {
      const snap = await db.collection("trades").where("buyer_invite_email", "==", user.email).get();
      snap.docs.forEach(add);
    }
    if (inviteId && /^[\w-]{8,64}$/.test(inviteId)) {
      const doc = await db.collection("trades").doc(inviteId).get();
      if (doc.exists) add(doc);
    }

    const now = new Date().toISOString();
    const claimed: string[] = [];
    for (const [id, trade] of Array.from(found.entries())) {
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
      const eventId = randomUUID();
      await db.collection("trade_events").doc(eventId).set({
        id: eventId, trade_id: id, label: "Buyer joined Zola",
        detail: `${user.name} created an account and can now pay for this transaction.`,
        type: "success", created_at: now,
      });
      await notifyTradeMove("buyer_joined", { ...trade, ...fields, id });
      claimed.push(id);
    }
    return claimed;
  } catch (e: any) {
    // Signing up must never fail because of this
    console.error("[invites] could not attach invited transactions:", e?.message);
    return [];
  }
}
