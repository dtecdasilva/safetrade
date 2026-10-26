/**
 * Deliveries booked straight on Pickup, with no Zola transaction: by anyone
 * with a Pickup account on pickup.zolahq.com/send, or by a Zola admin for a
 * client (the client needs no account: they pay through the link).
 *
 * The person booking (or the client) pays the delivery fee by mobile money.
 * Until then the delivery waits as "awaiting_payment" and no rider is used.
 * Once paid it is matched to a rider like any other delivery (the admin's
 * chosen rider first, if they are free and can carry it).
 *
 * The sender gets a private page, /d/<id>?k=<key>, with the payment, the
 * rider, the map and the 4-digit code to give to whoever receives it.
 */
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { getPaymentStatus } from "@/lib/fapshi";
import { sendEmail, emailLayout } from "@/lib/mail";
import { cleanEmail, cleanPhone, isEmail } from "@/lib/users";
import { isPoint, pickupUrl, quoteDelivery, riderPayFor } from "@/lib/pickup/config";
import { getPickupSettings } from "@/lib/pickup/settings";
import { assignRider, handoverCode, trackCode } from "@/lib/pickup/deliveries";
import { originFromBody } from "@/lib/pickup/tradeDelivery";
import { sendNotifications, ADMIN_AUDIENCE } from "@/lib/notifications";

export const DIRECT_PREFIX = "pkd_";
const nowIso = () => new Date().toISOString();
const fcfa = (n: unknown) => `FCFA ${(Number(n) || 0).toLocaleString("en-US")}`;

export function manageUrl(d: { id: string; manage_key: string }): string {
  return `${pickupUrl()}/d/${d.id}?k=${d.manage_key}`;
}

/** Check a booking form and work out the price. */
export async function readBooking(db: any, b: any): Promise<{ error?: string; value?: any }> {
  const settings = await getPickupSettings(db);
  if (!settings.enabled) return { error: "Pickup isn't taking deliveries yet" };
  const title = String(b.title || "").trim().slice(0, 120);
  if (title.length < 2) return { error: "Say what you're sending" };
  const value = Math.round(Number(b.value));
  if (!Number.isFinite(value) || value < 0) return { error: "Enter what the parcel is worth" };
  if (settings.max_value > 0 && value > settings.max_value) return { error: `Pickup carries parcels worth up to ${fcfa(settings.max_value)} for now` };

  const choice = await originFromBody(db, b);
  if (choice.error) return { error: choice.error };
  const dest = { lat: Number(b.destLat), lng: Number(b.destLng) };
  if (!isPoint(dest) || (dest.lat === 0 && dest.lng === 0)) return { error: "Mark where it should be delivered" };
  const destLandmark = String(b.destLandmark || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (destLandmark.length < 3) return { error: "Describe the delivery place so the rider finds it" };

  const recipientName = String(b.recipientName || "").trim().slice(0, 80);
  const recipientPhone = cleanPhone(b.recipientPhone);
  if (recipientName.length < 2) return { error: "Enter the name of the person receiving it" };
  if (recipientPhone.length < 9) return { error: "Enter the receiver's phone number" };
  const senderName = String(b.senderName || "").trim().slice(0, 80);
  const senderPhone = cleanPhone(b.senderPhone);
  const senderEmail = cleanEmail(b.senderEmail);
  if (senderName.length < 2) return { error: "Enter your name" };
  if (senderPhone.length < 9) return { error: "Enter your phone number" };
  if (senderEmail && !isEmail(senderEmail)) return { error: "Enter a valid email address" };

  const q = quoteDelivery(choice.origin!, dest, settings);
  return {
    value: {
      title, amount: value, mode: choice.mode, origin: choice.origin, branch: choice.branch || null,
      dest: { ...dest, landmark: destLandmark },
      recipient: { name: recipientName, phone: recipientPhone },
      sender: { name: senderName, phone: senderPhone, email: senderEmail },
      km: q.km, fee: q.fee, rider_share: settings.rider_share,
    },
  };
}

/** Save a booking. It waits for payment before any rider is involved. */
export async function createDirect(db: any, v: any, opts: { by: "public" | "admin"; adminName?: string; preferredRider?: string; fee?: number; lang?: string; senderId?: string }) {
  const id = `${DIRECT_PREFIX}${randomBytes(12).toString("hex")}`;
  const fee = opts.fee && opts.fee > 0 ? Math.round(opts.fee) : v.fee;
  const d = {
    id,
    kind: "direct",
    trade_id: null,
    created_by: opts.by,
    // The Pickup account that booked it (admin-made deliveries for clients have none)
    sender_id: opts.senderId || null,
    ...(opts.adminName ? { created_by_admin: opts.adminName } : {}),
    manage_key: randomBytes(16).toString("hex"),
    track_code: trackCode(),
    handover_code: handoverCode(),
    status: "awaiting_payment",
    mode: v.mode,
    origin: v.origin,
    ...(v.branch ? { branch: v.branch } : {}),
    city: v.origin.city,
    title: v.title,
    amount: v.amount,
    fee,
    km: v.km,
    rider_pay: riderPayFor({ delivery_fee: fee }, v.rider_share),
    dest: v.dest,
    sender: v.sender,
    recipient: v.recipient,
    // Same fields as Zola deliveries, so the rider's app reads both alike
    buyer_name: v.recipient.name, buyer_phone: v.recipient.phone,
    seller_name: v.sender.name, seller_phone: v.sender.phone,
    preferred_rider: opts.preferredRider || null,
    lang: opts.lang === "fr" ? "fr" : "en",
    declined: [],
    history: [{ status: "awaiting_payment", at: nowIso() }],
    created_at: nowIso(), updated_at: nowIso(),
  };
  await db.collection("deliveries").doc(id).set(d);

  if (d.sender.email) {
    const fr = d.lang === "fr";
    const url = manageUrl(d);
    await sendEmail({
      to: d.sender.email,
      subject: fr ? `Pickup : payez ${fcfa(fee)} pour envoyer « ${d.title} »` : `Pickup: pay ${fcfa(fee)} to send "${d.title}"`,
      text: fr
        ? `Bonjour ${d.sender.name},\n\nVotre livraison « ${d.title} » vers ${d.recipient.name} coûte ${fcfa(fee)} (${d.km} km). Payez par Mobile Money et un livreur Pickup est envoyé :\n${url}`
        : `Hi ${d.sender.name},\n\nYour delivery of "${d.title}" to ${d.recipient.name} costs ${fcfa(fee)} (${d.km} km). Pay by mobile money and a Pickup rider is sent:\n${url}`,
      html: emailLayout({
        lang: fr ? "fr" : "en",
        heading: fr ? "Payez pour lancer la livraison" : "Pay to start your delivery",
        intro: fr ? `Un livreur Pickup est envoyé dès que le paiement est reçu.` : `A Pickup rider is sent as soon as the payment is received.`,
        rows: [[fr ? "Colis" : "Parcel", d.title], [fr ? "Pour" : "To", d.recipient.name], [fr ? "Distance" : "Distance", `${d.km} km`]],
        totalRow: [fr ? "À payer" : "To pay", fcfa(fee)],
        cta: { label: fr ? "Payer et suivre" : "Pay and follow", url },
      }),
    }).catch(() => {});
  }
  return d;
}

export type DirectCheck = "paid" | "already_paid" | "pending" | "failed" | "mismatch" | "unknown";

/** Ask Fapshi whether the delivery fee was paid; if so, find a rider. */
export async function confirmDirectPayment(id: string, transId?: string): Promise<{ result: DirectCheck }> {
  const db: any = getDb();
  const ref = db.collection("deliveries").doc(id);
  const d = (await ref.get()).data();
  if (!d || d.kind !== "direct") return { result: "mismatch" };
  if (d.status !== "awaiting_payment") return { result: "already_paid" };
  const ref2 = transId || d.fapshi_ref;
  if (!ref2) return { result: "pending" };
  const check = await getPaymentStatus(ref2);
  if (!check.success) return { result: "unknown" };
  const data = check.data || {};
  if (data.externalId && String(data.externalId) !== id) return { result: "mismatch" };
  const status = String(data.status || "").toUpperCase();
  if (status === "FAILED" || status === "EXPIRED") { await ref.update({ payment_started_at: null }); return { result: "failed" }; }
  if (status !== "SUCCESSFUL") return { result: "pending" };
  if (data.amount !== undefined && Number(data.amount) < Number(d.fee)) return { result: "mismatch" };

  const marked: boolean = await db.runTransaction(async (tx: any) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || fresh.data().status !== "awaiting_payment") return false;
    tx.update(ref, { status: "waiting_rider", paid_at: nowIso(), fapshi_ref: ref2, history: [...(fresh.data().history || []), { status: "paid", at: nowIso() }], updated_at: nowIso() });
    return true;
  });
  if (!marked) return { result: "already_paid" };

  await sendNotifications([{ userId: ADMIN_AUDIENCE, tone: "info", link: "/admin?tab=deliveries",
    title: "Pickup delivery paid",
    body: `${d.sender.name} paid ${fcfa(d.fee)} to send “${d.title}” to ${d.recipient.name} in ${d.city}.` }]);
  await assignRider(db, id);
  return { result: "paid" };
}

/** What the sender's private page shows. */
export function directView(d: any) {
  const paid = d.status !== "awaiting_payment";
  return {
    id: d.id, status: d.status, mode: d.mode, title: d.title, amount: d.amount, fee: d.fee, km: d.km,
    origin: d.origin, branch: d.branch || null, dest: d.dest, sender: d.sender, recipient: d.recipient,
    rider_name: d.rider_name || "", rider_phone: d.rider_phone || "",
    receipt_no: d.receipt_no || "", track_code: d.track_code,
    handover_code: paid ? d.handover_code : "",
    rider_loc: d.status === "collected" ? d.rider_loc || null : null,
    history: (d.history || []).filter((h: any) => h.status !== "declined"),
    created_by: d.created_by, payment_started_at: d.payment_started_at || "",
  };
}
