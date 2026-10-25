import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/mail";
import { supportLine, prettyPhone, siteUrl } from "@/lib/support";
import { REVIEW_HOURS } from "@/lib/review";

/**
 * Notifications.
 *
 * Every time a transaction moves — created, paid, shipped, delivery
 * confirmed, complaint made, payment released, disputed — the people
 * involved get a notification in the bell at the top of the app AND the same
 * message by email. Withdrawals do the same.
 *
 * In-app: stored in the "notifications" collection, one document per
 * recipient. Admin notifications are addressed to ADMIN_AUDIENCE so every
 * admin sees them.
 *
 * Email: sent through Resend (see lib/mail.ts) to the address on the
 * person's account. Admin notifications go to ADMIN_EMAIL when it is set,
 * otherwise to the email of every admin account.
 *
 * Nothing here ever throws: a notification failing must never block a
 * payment or a status change.
 */

export const ADMIN_AUDIENCE = "admin";

export type NotificationTone = "info" | "success" | "warn" | "danger";

export interface NotificationInput {
  userId: string;
  title: string;
  body: string;
  /** The same message in French, for people who use Zola in French. */
  title_fr?: string;
  body_fr?: string;
  link?: string;
  tone?: NotificationTone;
  tradeId?: string;
  /** Extra words for the email subject, usually the item name. */
  subject?: string;
  /** Set to false when this person already gets a fuller email for the same event. */
  email?: boolean;
}

export type TradeMove =
  | "created"
  | "requested"
  | "seller_joined"
  | "accepted"
  | "declined"
  | "buyer_joined"
  | "edited"
  | "deleted"
  | "paid"
  | "payment_failed"
  | "shipped"
  | "delivered"
  | "complained"
  | "complaint_resolved"
  | "released"
  | "disputed";

/** The audience a signed-in person reads notifications for. */
export function audienceFor(session: { id: string; role: string }): string {
  return session.role === "admin" ? ADMIN_AUDIENCE : session.id;
}

const fcfa = (n: unknown) => `FCFA ${(Number(n) || 0).toLocaleString("en-US")}`;

export async function sendNotifications(list: NotificationInput[]): Promise<void> {
  // "invited:<phone>" stands in for a buyer who has not signed up yet: there is
  // no account to notify, they get the invitation by email and WhatsApp instead.
  const items = list.filter((n) => n.userId && !n.userId.startsWith("invited:"));
  if (!items.length) return;
  // The bell and the inbox are independent: one failing never stops the other.
  await Promise.all([saveInApp(items), sendByEmail(items)]);
}

async function saveInApp(items: NotificationInput[]): Promise<void> {
  try {
    const db = getDb();
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const n of items) {
      const id = randomUUID();
      batch.set(db.collection("notifications").doc(id), {
        id,
        user_id: n.userId,
        title: n.title,
        body: n.body,
        title_fr: n.title_fr || "",
        body_fr: n.body_fr || "",
        link: n.link || "",
        tone: n.tone || "info",
        trade_id: n.tradeId || "",
        read: false,
        created_at: now,
      });
    }
    await batch.commit();
  } catch (e: any) {
    console.error("[notifications] failed to send:", e?.message);
  }
}

/* ── Email copies ────────────────────────────────────────────────────────── */

/** The seeded admin login is not a real mailbox, so nothing is sent to it. */
const PLACEHOLDER_EMAILS = new Set(["admin@safetrade.com"]);

function looksLikeEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Where admin notifications are emailed. */
export async function adminEmails(): Promise<string[]> {
  const configured = (process.env.ADMIN_EMAIL || "")
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(looksLikeEmail);
  if (configured.length) return configured;

  const snap = await getDb().collection("users").where("role", "==", "admin").get();
  return snap.docs
    .map((d) => String(d.data().email || "").trim().toLowerCase())
    .filter((e) => looksLikeEmail(e) && !PLACEHOLDER_EMAILS.has(e));
}

interface Recipient { emails: string[]; lang: "en" | "fr" }

async function recipientFor(userId: string): Promise<Recipient> {
  if (userId === ADMIN_AUDIENCE) return { emails: await adminEmails(), lang: "en" };
  const doc = await getDb().collection("users").doc(userId).get();
  const data = doc.exists ? doc.data() : null;
  const email = String(data?.email || "").trim();
  return { emails: looksLikeEmail(email) ? [email] : [], lang: data?.lang === "fr" ? "fr" : "en" };
}

function buttonLabel(link: string, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  if (link.startsWith("/trade/")) return fr ? "Voir la transaction" : "View transaction";
  if (link.startsWith("/withdraw")) return fr ? "Ouvrir votre portefeuille" : "Open your wallet";
  if (link.startsWith("/admin")) return "Open admin";
  return fr ? "Ouvrir Zola" : "Open Zola";
}

async function sendByEmail(items: NotificationInput[]): Promise<void> {
  try {
    const wanted = items.filter((n) => n.email !== false);
    if (!wanted.length) return;
    if (!process.env.RESEND_API_KEY) {
      console.warn("[notifications] email copies skipped: RESEND_API_KEY is not set.");
      return;
    }

    // Look each recipient up once, even if they get several messages
    const ids = Array.from(new Set(wanted.map((n) => n.userId)));
    const found = await Promise.all(
      ids.map(async (id) => {
        try { return [id, await recipientFor(id)] as const; }
        catch (e: any) { console.error("[notifications] email lookup failed:", e?.message); return [id, { emails: [], lang: "en" } as Recipient] as const; }
      })
    );
    const recipients = new Map<string, Recipient>(found);
    const base = siteUrl();

    const jobs: Promise<unknown>[] = [];
    for (const n of wanted) {
      const r = recipients.get(n.userId);
      if (!r || !r.emails.length) continue;
      const fr = r.lang === "fr" && !!n.title_fr;
      const title = fr ? n.title_fr! : n.title;
      const body  = fr ? n.body_fr || n.body : n.body;
      const lang  = fr ? "fr" : "en";
      const link = n.link || "/dashboard";
      const url  = `${base}${link}`;
      const label = buttonLabel(link, lang);
      const subject = `Zola: ${title}${n.subject ? ` · ${n.subject}` : ""}`;
      const text = `${body}\n\n${label}: ${url}\n\n${supportLine(lang)}\n\nZola\n${lang === "fr" ? "Transactions sécurisées. Paiements simples." : "Secure transactions. Simple payments."}`;
      const html = emailLayout({ heading: title, intro: body, cta: { label, url }, lang });
      for (const to of r.emails) {
        jobs.push(
          sendEmail({ to, subject, text, html }).catch((e: any) =>
            console.error("[notifications] email failed:", e?.message)
          )
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch (e: any) {
    console.error("[notifications] email copies failed:", e?.message);
  }
}

interface TradeLike {
  id: string;
  title: string;
  amount: number;
  buyer_total?: number;
  buyer_id: string;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_pending?: boolean;
  needs_delivery?: boolean;
  delivery_fee?: number;
  vendor_id: string;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_pending?: boolean;
  declined_reason?: string;
}

/**
 * Tell everyone involved that a transaction has moved.
 * `actorId` is the person who caused the move; they aren't notified about
 * their own action unless the message is a useful confirmation.
 */
export async function notifyTradeMove(
  move: TradeMove,
  trade: TradeLike,
  opts: { actorId?: string; actorName?: string; reason?: string; note?: string } = {}
): Promise<void> {
  try {
    const link   = `/trade/${trade.id}`;
    const item   = `“${trade.title}”`;
    const buyer  = trade.buyer_name  || "The buyer";
    const seller = trade.vendor_name || "The seller";
    const price  = fcfa(trade.amount);
    const total  = fcfa(trade.buyer_total || trade.amount);
    const base   = { link, tradeId: trade.id, subject: trade.title };
    const phone  = prettyPhone(trade.buyer_phone);
    // Goods are handed to Zola for delivery; services have nothing to deliver
    const goods  = trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0;
    const out: NotificationInput[] = [];

    // French values used inside the French sentences
    const itemFr   = `« ${trade.title} »`;
    const buyerFr  = trade.buyer_name  || "L'acheteur";
    const sellerFr = trade.vendor_name || "Le vendeur";

    switch (move) {
      case "requested": {
        // A buyer started this: the seller confirms the details before the buyer can pay
        const sellerPhone = prettyPhone(trade.vendor_phone);
        out.push({ ...base, userId: trade.vendor_id, tone: "info",
          title: `${buyer} wants to buy from you`,
          body: `${buyer} started a transaction for ${item} at ${price}. Check the details and confirm, then they pay Zola. You receive your full price.`,
          title_fr: `${buyerFr} veut vous acheter quelque chose`,
          body_fr: `${buyerFr} a lancé une transaction pour ${itemFr} à ${price}. Vérifiez les détails et confirmez : l'acheteur paie ensuite Zola. Vous recevez la totalité de votre prix.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "New transaction started by a buyer",
          body: trade.vendor_pending
            ? `${buyer} started ${item}, ${price}, with a seller who is not on Zola yet${sellerPhone ? ` (${sellerPhone})` : ""}. They have been invited to sign up and confirm.`
            : `${buyer} started ${item} with ${seller}, ${price}. Waiting for the seller to confirm.` });
        break;
      }

      case "seller_joined":
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: "Your seller has joined Zola",
          body: `${seller} created an account and can now confirm ${item}. We'll tell you as soon as they do, so you can pay.`,
          title_fr: "Votre vendeur a rejoint Zola",
          body_fr: `${sellerFr} a créé un compte et peut maintenant confirmer ${itemFr}. Nous vous préviendrons dès que c'est fait, pour que vous puissiez payer.` });
        break;

      case "accepted":
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: `${seller} confirmed your transaction`,
          body: `${item} is ready for payment. Pay ${total} to Zola and we hold it until your order arrives.`,
          title_fr: `${sellerFr} a confirmé votre transaction`,
          body_fr: `${itemFr} est prêt à être payé. Payez ${total} à Zola : nous gardons l'argent jusqu'à l'arrivée de votre commande.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "Seller confirmed a buyer's transaction",
          body: `${seller} confirmed ${item} for ${buyer}, ${price}. Waiting for the buyer to pay.` });
        break;

      case "declined": {
        const why = trade.declined_reason ? ` They said: “${trade.declined_reason}”` : "";
        const whyFr = trade.declined_reason ? ` Raison : « ${trade.declined_reason} »` : "";
        out.push({ ...base, userId: trade.buyer_id, tone: "warn",
          title: `${seller} declined your transaction`,
          body: `${seller} did not confirm ${item}, so it has been cancelled. Nothing was paid.${why}`,
          title_fr: `${sellerFr} a refusé votre transaction`,
          body_fr: `${sellerFr} n'a pas confirmé ${itemFr}, la transaction est donc annulée. Rien n'a été payé.${whyFr}` });
        break;
      }

      case "created":
        // The buyer already gets a fuller email (with the price breakdown) from the create step
        out.push({ ...base, userId: trade.buyer_id, tone: "info", email: false,
          title: `New transaction from ${seller}`,
          body: `${item} is waiting for your payment. Pay ${total} to Zola and we hold it until your order arrives.`,
          title_fr: `Nouvelle transaction de ${sellerFr}`,
          body_fr: `${itemFr} attend votre paiement. Payez ${total} à Zola : nous gardons l'argent jusqu'à l'arrivée de votre commande.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "New transaction created",
          body: trade.buyer_pending
            ? `${seller} created ${item}, ${price}, for a buyer who is not on Zola yet${phone ? ` (${phone})` : ""}. They have been invited to sign up and pay.`
            : `${seller} created ${item} for ${buyer}, ${price}.` });
        break;

      case "buyer_joined":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Your buyer has joined Zola",
          body: `${buyer} created an account and can now pay ${total} for ${item}. We'll tell you as soon as the payment is held.`,
          title_fr: "Votre acheteur a rejoint Zola",
          body_fr: `${buyerFr} a créé un compte et peut maintenant payer ${total} pour ${itemFr}. Nous vous préviendrons dès que le paiement sera sécurisé.` });
        // They are looking at the transaction right after signing up, so no email
        out.push({ ...base, userId: trade.buyer_id, tone: "info", email: false,
          title: `A transaction from ${seller} is waiting`,
          body: `${item} is waiting for your payment. Pay ${total} to Zola and we hold it until your order arrives.`,
          title_fr: `Une transaction de ${sellerFr} vous attend`,
          body_fr: `${itemFr} attend votre paiement. Payez ${total} à Zola : nous gardons l'argent jusqu'à l'arrivée de votre commande.` });
        break;

      case "edited":
        if (opts.actorId && opts.actorId === trade.buyer_id) {
          // The buyer changed a transaction they started, before the seller confirmed
          out.push({ ...base, userId: trade.vendor_id, tone: "info",
            title: "Transaction details changed",
            body: `${buyer} updated ${item}. Your price is now ${price}. Check the details before you confirm.`,
            title_fr: "Détails de la transaction modifiés",
            body_fr: `${buyerFr} a modifié ${itemFr}. Votre prix est maintenant de ${price}. Vérifiez les détails avant de confirmer.` });
          break;
        }
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Transaction details changed",
          body: `${seller} updated ${item}. The total to pay is now ${total}. Review the details before paying.`,
          title_fr: "Détails de la transaction modifiés",
          body_fr: `${sellerFr} a modifié ${itemFr}. Le total à payer est maintenant de ${total}. Vérifiez les détails avant de payer.` });
        break;

      case "deleted":
        if (opts.actorId && opts.actorId === trade.buyer_id) {
          out.push({ userId: trade.vendor_id, tone: "warn", link: "/dashboard",
            title: "Transaction cancelled by the buyer",
            body: `${buyer} cancelled ${item} before paying. Nothing was charged.`,
            title_fr: "Transaction annulée par l'acheteur",
            body_fr: `${buyerFr} a annulé ${itemFr} avant de payer. Rien n'a été prélevé.` });
          break;
        }
        out.push({ userId: trade.buyer_id, tone: "warn", link: "/dashboard",
          title: "Transaction removed by the seller",
          body: `${seller} deleted ${item} before payment. Nothing was charged.`,
          title_fr: "Transaction supprimée par le vendeur",
          body_fr: `${sellerFr} a supprimé ${itemFr} avant le paiement. Rien n'a été prélevé.` });
        break;

      case "paid":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Payment secured",
          body: goods
            ? `${buyer} paid for ${item}. Zola is holding ${price} for you. Now send the item to Zola: we deliver it to the buyer, and the buyer has already paid for delivery.`
            : `${buyer} paid for ${item}. Zola is holding ${price} for you. Complete the work to receive it.`,
          title_fr: "Paiement sécurisé",
          body_fr: goods
            ? `${buyerFr} a payé ${itemFr}. Zola garde ${price} pour vous. Remettez maintenant l'article à Zola : nous le livrons à l'acheteur, qui a déjà payé la livraison.`
            : `${buyerFr} a payé ${itemFr}. Zola garde ${price} pour vous. Réalisez le travail pour le recevoir.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: "Payment received",
          body: goods
            ? `Zola is holding your payment for ${item}. The seller now sends it to Zola, and Zola delivers it to you.`
            : `Zola is holding your payment for ${item} until you confirm it has been delivered.`,
          title_fr: "Paiement reçu",
          body_fr: goods
            ? `Zola garde votre paiement pour ${itemFr}. Le vendeur remet maintenant l'article à Zola, qui vous le livre.`
            : `Zola garde votre paiement pour ${itemFr} jusqu'à votre confirmation de livraison.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "info",
          title: "Payment received",
          body: `${buyer} paid ${total} for ${item}. Zola is holding ${price} for ${seller}.` });
        break;

      case "payment_failed":
        out.push({ ...base, userId: trade.buyer_id, tone: "warn",
          title: "Payment not completed",
          body: `Your payment for ${item} was cancelled or timed out. No money was taken. You can try again.`,
          title_fr: "Paiement non abouti",
          body_fr: `Votre paiement pour ${itemFr} a été annulé ou a expiré. Aucun argent n'a été prélevé. Vous pouvez réessayer.` });
        break;

      case "shipped":
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Your order is on its way",
          body: goods
            ? `${seller} has handed ${item} to Zola for delivery. Confirm delivery once it arrives so the seller can be paid.`
            : `${seller} marked ${item} as delivered. Confirm delivery once you have it so the seller can be paid.`,
          title_fr: "Votre commande est en route",
          body_fr: goods
            ? `${sellerFr} a remis ${itemFr} à Zola pour la livraison. Confirmez la livraison dès réception pour que le vendeur soit payé.`
            : `${sellerFr} a indiqué ${itemFr} comme livré. Confirmez la livraison une fois reçu pour que le vendeur soit payé.` });
        // Sent through an agency to a Pickup rider: the rider delivers it, not the admin
        if ((trade as any).dest_branch || (trade as any).origin) break;
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: goods ? "warn" : "info",
          title: goods ? "Item handed over for delivery" : "Order marked as delivered",
          body: goods
            ? `${seller} marked ${item} as sent to Zola. Deliver it to ${buyer}${phone ? ` (${phone})` : ""}.`
            : `${seller} marked ${item} as delivered to ${buyer}.` });
        break;

      case "delivered":
        out.push({ ...base, userId: trade.vendor_id, tone: "success",
          title: "Delivery confirmed, now under review",
          body: `${buyer} confirmed delivery of ${item}. Zola reviews every delivery for ${REVIEW_HOURS} hours, then releases ${price} to you.`,
          title_fr: "Livraison confirmée, en vérification",
          body_fr: `${buyerFr} a confirmé la livraison de ${itemFr}. Zola vérifie chaque livraison pendant ${REVIEW_HOURS} heures, puis vous verse ${price}.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Thanks for confirming delivery",
          body: `${item} is now under review for ${REVIEW_HOURS} hours. If anything is wrong with your order, make a complaint from the transaction page before the review ends. Zola may call or text you to check. After that, the seller is paid.`,
          title_fr: "Merci d'avoir confirmé la livraison",
          body_fr: `${itemFr} est maintenant en vérification pendant ${REVIEW_HOURS} heures. En cas de problème avec votre commande, faites une réclamation depuis la page de la transaction avant la fin de la vérification. Zola peut vous appeler ou vous écrire pour vérifier. Ensuite, le vendeur est payé.` });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "warn",
          title: "Review started: call or text the buyer",
          body: `${buyer} confirmed delivery of ${item}. Call or text them${phone ? ` on ${phone}` : ""} to check, then release ${price} to ${seller} once the ${REVIEW_HOURS}-hour review is over.` });
        break;

      case "complained": {
        const said = opts.reason ? ` They said: “${opts.reason}”` : "";
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "danger",
          title: "Complaint to review",
          body: `${buyer} made a complaint about ${item}.${said} Call or text them${phone ? ` on ${phone}` : ""}. ${price} stays on hold for ${seller} until you mark it as resolved.` });
        out.push({ ...base, userId: trade.vendor_id, tone: "warn",
          title: "The buyer reported a problem",
          body: `${buyer} made a complaint about ${item}. Your payment of ${price} stays held by Zola while we look into it. We may call or text you.`,
          title_fr: "L'acheteur a signalé un problème",
          body_fr: `${buyerFr} a fait une réclamation sur ${itemFr}. Votre paiement de ${price} reste bloqué chez Zola pendant que nous examinons la situation. Nous pourrions vous appeler ou vous écrire.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "We've received your complaint",
          body: `Zola is looking into your complaint about ${item} and will call or text you. The seller is not paid until it is settled.`,
          title_fr: "Nous avons reçu votre réclamation",
          body_fr: `Zola examine votre réclamation sur ${itemFr} et vous appellera ou vous écrira. Le vendeur n'est pas payé tant que ce n'est pas réglé.` });
        break;
      }

      case "complaint_resolved": {
        const note = opts.note ? ` Note from Zola: “${opts.note}”` : "";
        const noteFr = opts.note ? ` Note de Zola : « ${opts.note} »` : "";
        out.push({ ...base, userId: trade.buyer_id, tone: "info",
          title: "Your complaint has been resolved",
          body: `Zola has closed your complaint about ${item}.${note}`,
          title_fr: "Votre réclamation a été résolue",
          body_fr: `Zola a clôturé votre réclamation sur ${itemFr}.${noteFr}` });
        out.push({ ...base, userId: trade.vendor_id, tone: "info",
          title: "Complaint resolved",
          body: `The buyer's complaint about ${item} has been closed.${note}`,
          title_fr: "Réclamation résolue",
          body_fr: `La réclamation de l'acheteur sur ${itemFr} a été clôturée.${noteFr}` });
        break;
      }

      case "released":
        out.push({ ...base, userId: trade.vendor_id, tone: "success", link: "/withdraw",
          title: "You've been paid",
          body: `${price} for ${item} is now in your Zola wallet, ready to withdraw.`,
          title_fr: "Vous avez été payé",
          body_fr: `${price} pour ${itemFr} sont maintenant dans votre portefeuille Zola, prêts à être retirés.` });
        out.push({ ...base, userId: trade.buyer_id, tone: "success",
          title: "Transaction completed",
          body: `Zola released your payment for ${item} to ${seller}.`,
          title_fr: "Transaction terminée",
          body_fr: `Zola a versé votre paiement pour ${itemFr} à ${sellerFr}.` });
        break;

      case "disputed": {
        const who = opts.actorName || "Someone";
        const text = `${who} opened a dispute on ${item}. The payment stays held by Zola while it is reviewed.`;
        const textFr = `${opts.actorName || "Quelqu'un"} a ouvert un litige sur ${itemFr}. Le paiement reste bloqué chez Zola pendant l'examen.`;
        if (opts.actorId !== trade.vendor_id)
          out.push({ ...base, userId: trade.vendor_id, tone: "danger", title: "Dispute opened", body: text, title_fr: "Litige ouvert", body_fr: textFr });
        if (opts.actorId !== trade.buyer_id)
          out.push({ ...base, userId: trade.buyer_id, tone: "danger", title: "Dispute opened", body: text, title_fr: "Litige ouvert", body_fr: textFr });
        out.push({ ...base, userId: ADMIN_AUDIENCE, tone: "danger",
          title: "Dispute to review",
          body: `${who} opened a dispute on ${item} (${buyer} and ${seller}). ${price} is on hold.` });
        break;
      }
    }

    await sendNotifications(out);
  } catch (e: any) {
    console.error("[notifications] trade move failed:", e?.message);
  }
}

/** A seller asked to withdraw: tell the admin there is a payout to send. */
export async function notifyWithdrawalRequested(w: {
  vendor_name?: string; amount: number; phone: string; network: string;
}): Promise<void> {
  await sendNotifications([{
    userId: ADMIN_AUDIENCE, tone: "warn", link: "/admin",
    title: "Withdrawal requested",
    body: `${w.vendor_name || "A seller"} asked to withdraw ${fcfa(w.amount)} to ${w.network}, +237${w.phone}.`,
  }]);
}

/** The admin sent a withdrawal: tell the seller the money is on its way. */
export async function notifyWithdrawalSent(w: {
  vendor_id: string; amount: number; phone: string; network: string;
}): Promise<void> {
  await sendNotifications([{
    userId: w.vendor_id, tone: "success", link: "/withdraw",
    title: "Withdrawal sent",
    body: `${fcfa(w.amount)} was sent to your ${w.network} number, +237${w.phone}.`,
    title_fr: "Retrait envoyé",
    body_fr: `${fcfa(w.amount)} ont été envoyés à votre numéro ${w.network}, +237${w.phone}.`,
  }]);
}

/** A buyer reported a seller: the admin reviews it. The seller is not told who reported them. */
export async function notifySellerReported(r: {
  reporter_id: string; reporter_name: string; vendor_name: string; trade_id: string; trade_title: string; reason_label: string; details: string;
}): Promise<void> {
  await sendNotifications([
    { userId: ADMIN_AUDIENCE, tone: "danger", link: "/admin?tab=reports", tradeId: r.trade_id, subject: r.vendor_name,
      title: "Seller reported",
      body: `${r.reporter_name} reported ${r.vendor_name} (“${r.trade_title}”): ${r.reason_label}. “${r.details.slice(0, 300)}” Review it in the Reports tab, and flag the seller if other buyers should be careful.` },
    { userId: r.reporter_id, tone: "info", link: `/trade/${r.trade_id}`, tradeId: r.trade_id, email: false,
      title: "We've received your report",
      body: `Thanks for telling us about ${r.vendor_name}. Zola reviews every report and may contact you. The seller is not told who reported them.`,
      title_fr: "Nous avons reçu votre signalement",
      body_fr: `Merci de nous avoir signalé ${r.vendor_name}. Zola examine chaque signalement et peut vous contacter. Le vendeur ne sait pas qui l'a signalé.` },
  ]);
}

/** The admin flagged (or un-flagged) a seller. */
export async function notifySellerFlag(userId: string, flagged: boolean): Promise<void> {
  await sendNotifications([flagged ? {
    userId, tone: "danger", link: "/dashboard",
    title: "Your seller account has been flagged",
    body: "After reports from buyers, Zola has flagged your account. Buyers now see a warning on transactions with you. Contact Zola customer service if you'd like to talk about it.",
    title_fr: "Votre compte vendeur a été signalé",
    body_fr: "Suite à des signalements d'acheteurs, Zola a signalé votre compte. Les acheteurs voient maintenant un avertissement sur les transactions avec vous. Contactez le service client de Zola si vous souhaitez en parler.",
  } : {
    userId, tone: "success", link: "/dashboard",
    title: "The flag on your account has been removed",
    body: "Zola has removed the flag from your seller account. Buyers no longer see a warning on your transactions.",
    title_fr: "Le signalement de votre compte a été retiré",
    body_fr: "Zola a retiré le signalement de votre compte vendeur. Les acheteurs ne voient plus d'avertissement sur vos transactions.",
  }]);
}

/** A buyer is waiting for the seller to confirm: send the seller a reminder. */
export async function notifySellerReminder(trade: TradeLike): Promise<void> {
  const item = `“${trade.title}”`;
  const buyer = trade.buyer_name || "The buyer";
  await sendNotifications([{
    userId: trade.vendor_id, tone: "info", link: `/trade/${trade.id}`, tradeId: trade.id, subject: trade.title,
    title: "A buyer is waiting for you to confirm",
    body: `${buyer} is waiting for you to confirm ${item} at ${fcfa(trade.amount)}. Check the details and confirm so they can pay.`,
    title_fr: "Un acheteur attend votre confirmation",
    body_fr: `${trade.buyer_name || "L'acheteur"} attend que vous confirmiez « ${trade.title} » à ${fcfa(trade.amount)}. Vérifiez les détails et confirmez pour qu'il puisse payer.`,
  }]);
}
