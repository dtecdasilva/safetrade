/**
 * Deliveries on Pickup, and how riders are matched to them.
 *
 * One delivery per Zola transaction ("deliveries/<tradeId>"). It is created
 * when the buyer pays, for goods sent to an agency branch, and a rider is
 * assigned straight away if one is free.
 *
 * Matching, in order:
 *   1. only approved riders who are available, in the branch's city;
 *   2. only riders with no package already (one package at a time);
 *   3. only riders whose balance covers the package (VALUE_RATIO);
 *   4. then the closest to the branch, by their live location if it is
 *      recent, otherwise their home base.
 * If nobody fits, the delivery waits ("waiting_rider") and is offered again
 * whenever a rider in that city becomes free, tops up or comes online.
 */
import { randomUUID, randomInt } from "crypto";
import { getDb } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/mail";
import { sendNotifications, ADMIN_AUDIENCE } from "@/lib/notifications";
import { prettyPhone, siteUrl } from "@/lib/support";
import {
  LOCATION_FRESH_MINUTES, Origin, Point, branchOrigin, distanceKm, isPoint, maxPackageValue, originOf, riderMax, pickupUrl, riderPayFor,
} from "@/lib/pickup/config";
import { getPickupSettings } from "@/lib/pickup/settings";

const fcfa = (n: unknown) => `FCFA ${(Number(n) || 0).toLocaleString("en-US")}`;
const nowIso = () => new Date().toISOString();

/* ── Small helpers ───────────────────────────────────────────────────────── */

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function trackCode(): string {
  let s = "";
  for (let i = 0; i < 10; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return s;
}
export function handoverCode(): string {
  return String(randomInt(1000, 10000));
}

export function goodsOf(trade: any): boolean {
  return trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0;
}

/** Where a rider is for matching: live location if recent, otherwise their home base. */
export function riderPosition(r: any, now = Date.now()): Point | null {
  const fresh = r.loc_at && now - Date.parse(r.loc_at) < LOCATION_FRESH_MINUTES * 60000;
  if (fresh && isPoint({ lat: r.loc_lat, lng: r.loc_lng })) return { lat: Number(r.loc_lat), lng: Number(r.loc_lng) };
  if (isPoint({ lat: r.base_lat, lng: r.base_lng })) return { lat: Number(r.base_lat), lng: Number(r.base_lng) };
  return null;
}

export const sameCity = (a: unknown, b: unknown) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** An agency branch as stored on a transaction and a delivery. */
export async function branchSnapshot(db: any, branchId: unknown) {
  if (!branchId || typeof branchId !== "string") return null;
  const doc = await db.collection("agency_branches").doc(branchId).get();
  if (!doc.exists) return null;
  const b = doc.data();
  if (b.active === false) return null;
  return { id: b.id, agency: b.agency, name: b.name, city: b.city, address: b.address || "", lat: Number(b.lat), lng: Number(b.lng) };
}

/** Where the rider collects a Zola transaction's parcel: the seller's spot (same city) or the agency branch. */
export function tradeOrigin(trade: any): Origin | null {
  if (trade?.origin && isPoint(trade.origin)) return trade.origin;
  if (trade?.dest_branch && isPoint(trade.dest_branch)) return branchOrigin(trade.dest_branch);
  return null;
}

/** A Zola transaction delivered by Pickup (goods, with a pickup spot or an agency branch). */
export function isPickupTrade(trade: any): boolean {
  return goodsOf(trade) && !!tradeOrigin(trade);
}

/** "Touristique Express, Akwa (Douala)" or "Bonamoussadi (Douala)". */
export function originText(o: Origin | null): string {
  if (!o) return "";
  return `${o.label} (${o.city})`;
}

/**
 * Where a parcel from another city arrives, in words: the chosen branch (older
 * deliveries), the agency the sender used, or just "a bus agency in <city>".
 */
export function arrivalPlace(d: any, fr = false): string {
  const b = d?.branch;
  const city = b?.city || originOf(d)?.city || d?.city || "";
  if (b) return fr ? `${b.agency}, agence de ${b.name}, ${b.city}` : `${b.agency}, ${b.name} branch, ${b.city}`;
  const o = originOf(d);
  const agency = d?.sent_agency || o?.agency || "";
  const quarter = o?.kind === "agency" && o.landmark ? o.landmark : "";
  if (agency && quarter) return fr ? `l'agence ${agency} de ${quarter}, ${city}` : `the ${agency} office in ${quarter}, ${city}`;
  if (agency) return fr ? `l'agence ${agency} à ${city}` : `the ${agency} office in ${city}`;
  return fr ? `une agence de voyage à ${city}` : `a bus agency in ${city}`;
}

export function branchLabel(b: any): string {
  if (!b) return "";
  return `${b.agency}, ${b.name} (${b.city})`;
}

async function tradeEvent(db: any, tradeId: string, label: string, detail: string, type = "info") {
  const id = randomUUID();
  await db.collection("trade_events").doc(id).set({ id, trade_id: tradeId, label, detail, type, created_at: nowIso() });
}

function history(d: any, status: string, note = "") {
  return [...(d.history || []), { status, at: nowIso(), ...(note ? { note } : {}) }];
}

/** Change a rider's balance and keep a line in their history, all at once. */
export async function moveRiderMoney(db: any, riderId: string, delta: number, entry: { type: string; note: string; trade_id?: string; ref?: string }) {
  const ref = db.collection("riders").doc(riderId);
  const id  = randomUUID();
  return db.runTransaction(async (tx: any) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new Error("Rider not found");
    const balance = Math.round((Number(doc.data().balance) || 0) + delta);
    if (balance < 0) throw new Error("NEGATIVE_BALANCE");
    tx.update(ref, { balance, updated_at: nowIso() });
    tx.set(db.collection("rider_ledger").doc(id), { id, rider_id: riderId, amount: Math.round(delta), balance_after: balance, ...entry, created_at: nowIso() });
    return balance;
  });
}

/* ── Creating a delivery when the buyer pays ─────────────────────────────── */

/** Called once a transaction is paid. Does nothing for services or transactions with no agency branch. */
export async function startDelivery(tradeId: string): Promise<void> {
  try {
    const db: any = getDb();
    const tDoc = await db.collection("trades").doc(tradeId).get();
    if (!tDoc.exists) return;
    const trade = tDoc.data();
    const origin = tradeOrigin(trade);
    if (!origin || !goodsOf(trade)) return;
    const settings = await getPickupSettings(db);

    const ref = db.collection("deliveries").doc(tradeId);
    if ((await ref.get()).exists) return;

    const [buyer, seller] = await Promise.all([
      db.collection("users").doc(trade.buyer_id).get(),
      db.collection("users").doc(trade.vendor_id).get(),
    ]);
    const b = buyer.data() || {};
    await ref.set({
      id: tradeId,
      trade_id: tradeId,
      track_code: trackCode(),
      handover_code: handoverCode(),
      status: "waiting_rider",
      kind: "zola",
      mode: trade.delivery_mode || (trade.dest_branch ? "out_of_town" : "same_city"),
      origin,
      ...(trade.dest_branch ? { branch: trade.dest_branch } : {}),
      city: origin.city,
      title: trade.title,
      amount: Number(trade.amount) || 0,
      fee: Number(trade.delivery_fee) || 0,
      km: Number(trade.delivery_km) || 0,
      rider_pay: riderPayFor(trade, settings.rider_share),
      buyer_name: trade.buyer_name,
      buyer_phone: b.phone || trade.buyer_phone || "",
      seller_name: trade.vendor_name,
      seller_phone: (seller.data() || {}).phone || "",
      dest: isPoint({ lat: trade.delivery_lat, lng: trade.delivery_lng })
        ? { lat: Number(trade.delivery_lat), lng: Number(trade.delivery_lng), landmark: trade.delivery_landmark || "" }
        : null,
      declined: [],
      history: [{ status: "waiting_rider", at: nowIso() }],
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    await assignRider(db, tradeId);
  } catch (e: any) {
    // A delivery problem must never undo or block a payment
    console.error("[pickup] could not start delivery for", tradeId, e?.message);
  }
}

/* ── Matching ────────────────────────────────────────────────────────────── */

export interface Candidate { rider: any; km: number | null }

/** Riders who could take this delivery right now, best first. */
export async function candidatesFor(db: any, d: any): Promise<Candidate[]> {
  const snap = await db.collection("riders").where("status", "==", "approved").get();
  const o = originOf(d);
  if (!o) return [];
  const branch: Point = { lat: Number(o.lat), lng: Number(o.lng) };
  const out: Candidate[] = [];
  for (const doc of snap.docs) {
    const r = doc.data();
    if (!r.available) continue;                                   // switched off
    if (!sameCity(r.city, o.city)) continue;                      // another city
    if (r.active_trade) continue;                                 // already has a package
    if ((d.declined || []).includes(r.id)) continue;              // said no to this one
    if (riderMax(r) < Number(d.amount)) continue;                 // balance too low for its value (no-limit riders always pass)
    const pos = riderPosition(r);
    out.push({ rider: r, km: pos && isPoint(branch) ? distanceKm(pos, branch) : null });
  }
  // Closest first; riders with no known position go last
  return out.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
}

/**
 * Give the delivery to the best free rider (or to `riderId` when the admin
 * picks one). Returns the rider, or null if it has to wait.
 */
/**
 * Every approved rider, for the admin to choose from: free riders who can carry
 * it first (closest first), then free riders whose balance is too low, then busy ones.
 * The admin can give a parcel to a rider whose balance is too low.
 */
export async function adminChoices(db: any, d: any) {
  const snap = await db.collection("riders").where("status", "==", "approved").get();
  const o = originOf(d);
  const out = snap.docs.map((doc: any) => {
    const r = doc.data();
    const pos = riderPosition(r);
    const km = pos && o ? Math.round(distanceKm(pos, o) * 10) / 10 : null;
    const busy = !!r.active_trade && r.active_trade !== d.id;
    return {
      id: r.id, name: r.name, city: r.city, km, busy, available: !!r.available,
      same_city: o ? sameCity(r.city, o.city) : true,
      max_value: maxPackageValue(r.balance), no_limit: !!r.no_limit,
      can_carry: riderMax(r) >= Number(d.amount || 0),
    };
  });
  const rank = (c: any) => (c.busy ? 4 : 0) + (c.same_city ? 0 : 2) + (c.can_carry ? 0 : 1);
  return out.sort((a: any, b: any) => rank(a) - rank(b) || (a.km ?? 1e9) - (b.km ?? 1e9));
}

export async function assignRider(db: any, tradeId: string, opts: { riderId?: string; by?: string; prefer?: string } = {}): Promise<any | null> {
  const dRef = db.collection("deliveries").doc(tradeId);
  const dDoc = await dRef.get();
  if (!dDoc.exists) return null;
  const d = dDoc.data();
  // Once the seller has sent the parcel, it is addressed to that rider
  if (!["waiting_rider", "assigned"].includes(d.status)) return null;
  if (d.status === "assigned" && !opts.riderId) return null;

  let list: any[];
  if (opts.riderId) {
    const r = (await db.collection("riders").doc(opts.riderId).get()).data();
    if (!r) throw new Error("Rider not found");
    if (r.status !== "approved") throw new Error("This rider isn't approved");
    if (r.active_trade && r.active_trade !== tradeId) throw new Error("This rider already has a package");
    // The admin may give it to a rider whose balance is too low (marked over_limit)
    list = [r];
  } else {
    list = (await candidatesFor(db, d)).map((c) => c.rider);
    // The admin chose a rider when creating it: try them first, if they are free and can carry it
    const prefer = opts.prefer || d.preferred_rider;
    if (prefer) {
      if (list.some((r) => r.id === prefer)) list = [...list.filter((r) => r.id === prefer), ...list.filter((r) => r.id !== prefer)];
      else {
        // The admin's choice goes first even if their balance is too low, as long as they're free
        const p = (await db.collection("riders").doc(prefer).get()).data();
        if (p && p.status === "approved" && (!p.active_trade || p.active_trade === tradeId)) list = [p, ...list];
      }
    }
  }

  for (const r of list) {
    const rRef = db.collection("riders").doc(r.id);
    const ok: boolean = await db.runTransaction(async (tx: any) => {
      const [fr, fd] = [await tx.get(rRef), await tx.get(dRef)];
      if (!fr.exists || !fd.exists) return false;
      const rider = fr.data(), del = fd.data();
      if (rider.active_trade && rider.active_trade !== tradeId) return false;
      if (!["waiting_rider", "assigned"].includes(del.status)) return false;
      // Hand back the previous rider when the admin moves it to someone else
      if (del.rider_id && del.rider_id !== rider.id) tx.update(db.collection("riders").doc(del.rider_id), { active_trade: null });
      tx.update(rRef, { active_trade: tradeId, updated_at: nowIso() });
      tx.update(dRef, {
        status: "assigned",
        rider_id: rider.id,
        rider_name: rider.name,
        rider_phone: rider.phone,
        assigned_at: nowIso(),
        assigned_by: opts.by || "auto",
        over_limit: riderMax(rider) < Number(del.amount || 0),
        waiting_notified: false,
        history: history(del, "assigned", rider.name),
        updated_at: nowIso(),
      });
      return true;
    });
    if (!ok) continue;
    await onAssigned(db, { ...d, rider_id: r.id, rider_name: r.name, rider_phone: r.phone }, r);
    return r;
  }

  // Nobody can take it yet
  if (d.status !== "waiting_rider" || !d.waiting_notified) {
    await dRef.update({ status: "waiting_rider", waiting_notified: true, updated_at: nowIso() });
    await sendNotifications([{
      userId: ADMIN_AUDIENCE, tone: "warn", link: d.trade_id ? `/trade/${tradeId}` : "/admin?tab=deliveries", ...(d.trade_id ? { tradeId } : {}), subject: d.title,
      title: "No rider free yet",
      body: `No available rider in ${originOf(d)?.city || d.city} can take “${d.title}” (${fcfa(d.amount)}) right now. Pickup offers it again as soon as a rider is free, or you can assign one from ${d.trade_id ? "the transaction page" : "Admin, Deliveries"}.`,
    }]);
  }
  return null;
}

/** Offer waiting deliveries in a city to riders who have just become free. */
export async function retryWaiting(db: any, city?: string): Promise<number> {
  try {
    const snap = await db.collection("deliveries").where("status", "==", "waiting_rider").get();
    const waiting = snap.docs.map((d: any) => d.data())
      .filter((d: any) => !city || sameCity(originOf(d)?.city, city))
      .sort((a: any, b: any) => (a.created_at > b.created_at ? 1 : -1));
    let n = 0;
    for (const d of waiting) if (await assignRider(db, d.id)) n++;
    return n;
  } catch (e: any) {
    console.error("[pickup] retry failed:", e?.message);
    return 0;
  }
}

/** Free a rider's slot (after a delivery, a refusal or an admin change). */
export async function releaseRider(db: any, riderId: string, tradeId: string) {
  const ref = db.collection("riders").doc(riderId);
  await db.runTransaction(async (tx: any) => {
    const doc = await tx.get(ref);
    if (doc.exists && doc.data().active_trade === tradeId) tx.update(ref, { active_trade: null, updated_at: nowIso() });
  });
}

/* ── Telling people ──────────────────────────────────────────────────────── */

/** Email someone who booked a delivery directly on Pickup (no Zola account). */
async function emailSender(d: any, subjectEn: string, subjectFr: string, introEn: string, introFr: string, rows: [string, string][] = []) {
  const to = d.sender?.email;
  if (!to) return;
  const fr = d.lang === "fr";
  const url = `${pickupUrl()}/d/${d.id}?k=${d.manage_key}`;
  await sendEmail({
    to,
    subject: `Pickup: ${fr ? subjectFr : subjectEn}`,
    text: `${fr ? introFr : introEn}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${fr ? "Suivre la livraison" : "Follow the delivery"}: ${url}`,
    html: emailLayout({ lang: fr ? "fr" : "en", heading: fr ? subjectFr : subjectEn, intro: fr ? introFr : introEn, rows,
      cta: { label: fr ? "Suivre la livraison" : "Follow the delivery", url } }),
  }).catch(() => {});
}

async function onAssigned(db: any, d: any, rider: any) {
  const o = originOf(d)!;
  const b = d.branch;
  const phone = prettyPhone(rider.phone);
  const sameCityMode = d.mode === "same_city";

  if (d.trade_id) {
    const trade = (await db.collection("trades").doc(d.trade_id).get()).data() || {};
    await tradeEvent(db, d.trade_id, "Rider assigned", sameCityMode
      ? `${rider.name} (Pickup) will collect the parcel from the seller in ${o.city}.`
      : `${rider.name} (Pickup) will collect the parcel at ${arrivalPlace(d)} once the seller sends it.`, "info");
    await sendNotifications([
      sameCityMode
        ? { userId: trade.vendor_id, tone: "success", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, subject: d.title,
            title: `${rider.name} will collect “${d.title}”`,
            body: `${rider.name} (${phone}) from Pickup is coming to your pickup spot to collect the parcel. Have it packed and ready, and hand it over only to this rider.`,
            title_fr: `${rider.name} va récupérer « ${d.title} »`,
            body_fr: `${rider.name} (${phone}), de Pickup, vient à votre point de retrait pour récupérer le colis. Préparez-le et remettez-le uniquement à ce livreur.` }
        : { userId: trade.vendor_id, tone: "success", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, subject: d.title,
            title: `Send “${d.title}” to ${rider.name}`,
            body: b
              ? `Send the parcel through ${b.agency} to the ${b.name} branch in ${b.city}. Write this recipient on it: ${rider.name}, ${phone}. Then enter the agency receipt number on the transaction.`
              : o.agency
                ? `Send the parcel through ${o.agency} to ${o.landmark ? `${o.landmark}, ` : ""}${o.city}. Write this recipient on it: ${rider.name}, ${phone}. Then enter the receipt number on the transaction.`
                : `Send the parcel to ${o.city} by any bus agency. Write this recipient on it: ${rider.name}, ${phone}. Then enter the agency's name and the receipt number on the transaction.`,
            title_fr: `Envoyez « ${d.title} » à ${rider.name}`,
            body_fr: b
              ? `Envoyez le colis par ${b.agency} à l'agence de ${b.name}, ${b.city}. Écrivez ce destinataire dessus : ${rider.name}, ${phone}. Ensuite, indiquez le numéro du reçu de l'agence sur la transaction.`
              : o.agency
                ? `Envoyez le colis par ${o.agency} vers ${o.landmark ? `${o.landmark}, ` : ""}${o.city}. Écrivez ce destinataire dessus : ${rider.name}, ${phone}. Ensuite, indiquez le numéro du reçu sur la transaction.`
                : `Envoyez le colis à ${o.city} par n'importe quelle agence de voyage. Écrivez ce destinataire dessus : ${rider.name}, ${phone}. Ensuite, indiquez le nom de l'agence et le numéro du reçu sur la transaction.` },
      { userId: trade.buyer_id, tone: "info", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, subject: d.title, email: false,
        title: "A rider will bring your order",
        body: `${rider.name} from Pickup will collect “${d.title}” and bring it to you. You can follow it on a map from the transaction page.`,
        title_fr: "Un livreur vous apportera votre commande",
        body_fr: `${rider.name}, de Pickup, récupérera « ${d.title} » et vous l'apportera. Vous pourrez la suivre sur une carte depuis la page de la transaction.` },
    ]);
  } else {
    await emailSender(d,
      sameCityMode ? `${rider.name} is coming to collect your parcel` : `Send your parcel to ${rider.name}`,
      sameCityMode ? `${rider.name} vient récupérer votre colis` : `Envoyez votre colis à ${rider.name}`,
      sameCityMode
        ? `${rider.name} (${phone}) is coming to collect "${d.title}". Hand it over only to this rider.`
        : b ? `Send "${d.title}" through ${b.agency} to the ${b.name} branch in ${b.city}, with this recipient: ${rider.name}, ${phone}. Then enter the receipt number on your delivery page.`
            : o.agency ? `Send "${d.title}" through ${o.agency} to ${o.landmark ? `${o.landmark}, ` : ""}${o.city}, with this recipient: ${rider.name}, ${phone}. Then enter the receipt number on your delivery page.`
            : `Send "${d.title}" to ${o.city} by any bus agency, with this recipient: ${rider.name}, ${phone}. Then enter the agency's name and the receipt number on your delivery page.`,
      sameCityMode
        ? `${rider.name} (${phone}) vient récupérer « ${d.title} ». Remettez-le uniquement à ce livreur.`
        : b ? `Envoyez « ${d.title} » par ${b.agency} à l'agence de ${b.name}, ${b.city}, avec ce destinataire : ${rider.name}, ${phone}. Ensuite, indiquez le numéro du reçu sur votre page de livraison.`
            : o.agency ? `Envoyez « ${d.title} » par ${o.agency} vers ${o.landmark ? `${o.landmark}, ` : ""}${o.city}, avec ce destinataire : ${rider.name}, ${phone}. Ensuite, indiquez le numéro du reçu sur votre page de livraison.`
            : `Envoyez « ${d.title} » à ${o.city} par n'importe quelle agence de voyage, avec ce destinataire : ${rider.name}, ${phone}. Ensuite, indiquez le nom de l'agence et le numéro du reçu sur votre page de livraison.`);
  }

  // The rider: email, in their language (they also see it in the Pickup app)
  if (rider.email) {
    const fr = rider.lang === "fr";
    const url = `${pickupUrl()}/app`;
    const where = sameCityMode ? `${o.label}, ${o.city}` : arrivalPlace(d, fr);
    await sendEmail({
      to: rider.email,
      subject: fr ? `Pickup : nouvelle livraison à ${o.city}` : `Pickup: new delivery in ${o.city}`,
      text: fr
        ? `Bonjour ${rider.name},\n\nUne livraison vous a été attribuée : « ${d.title} », valeur ${fcfa(d.amount)}.\nÀ récupérer : ${where}.\n\nOuvrir Pickup : ${url}`
        : `Hi ${rider.name},\n\nYou have a new delivery: "${d.title}", worth ${fcfa(d.amount)}.\nCollect it at: ${where}.\n\nOpen Pickup: ${url}`,
      html: emailLayout({
        lang: fr ? "fr" : "en",
        heading: fr ? "Nouvelle livraison pour vous" : "You have a new delivery",
        intro: sameCityMode
          ? (fr ? "Allez récupérer le colis auprès de l'expéditeur, puis livrez-le." : "Go and collect the parcel from the sender, then deliver it.")
          : b ? (fr ? `Le colis est envoyé à votre nom par ${b.agency}. Nous vous dirons quand il est parti.` : `The parcel is being sent in your name through ${b.agency}. We'll tell you when it has left.`)
              : o.agency
                ? (fr ? `Le colis est envoyé à votre nom par ${o.agency}. Nous vous dirons quand il est parti.` : `The parcel is being sent in your name through ${o.agency}. We'll tell you when it has left.`)
                : (fr ? `Le colis est envoyé à votre nom par une agence de voyage vers ${o.city}. Nous vous dirons laquelle dès qu'il est parti.` : `The parcel is being sent to ${o.city} in your name by bus. We'll tell you which agency as soon as it has left.`),
        rows: [
          [fr ? "Colis" : "Parcel", d.title],
          [fr ? "Valeur" : "Value", fcfa(d.amount)],
          [fr ? "À récupérer" : "Collect at", where],
          [fr ? "Vous gagnez" : "You earn", fcfa(d.rider_pay)],
        ],
        cta: { label: fr ? "Ouvrir Pickup" : "Open Pickup", url },
      }),
    }).catch(() => {});
  }
}

/** The sender sent the parcel through the agency (out of town). */
export async function markSent(db: any, deliveryId: string, receipt: string, agency = "") {
  const ref = db.collection("deliveries").doc(deliveryId);
  const d0 = (await ref.get()).data();
  if (!d0 || d0.status !== "assigned") return;
  const sentAgency = String(agency || "").replace(/\s+/g, " ").trim().slice(0, 80) || originOf(d0)?.agency || d0.branch?.agency || "";
  await ref.update({ status: "sent", receipt_no: receipt, sent_agency: sentAgency, sent_at: nowIso(), history: history(d0, "sent"), updated_at: nowIso() });
  const d = { ...d0, sent_agency: sentAgency };
  const r = (await db.collection("riders").doc(d.rider_id).get()).data();
  if (r?.email && !d.branch) {
    const fr = r.lang === "fr";
    const where = arrivalPlace(d, fr);
    await sendEmail({
      to: r.email,
      subject: fr ? `Pickup : le colis « ${d.title} » est parti` : `Pickup: "${d.title}" is on its way`,
      text: fr ? `L'expéditeur a envoyé le colis à votre nom. Récupérez-le à ${where} dès son arrivée. Reçu : ${receipt}.\n\n${pickupUrl()}/app`
               : `The sender sent the parcel in your name. Collect it at ${where} as soon as it arrives. Receipt: ${receipt}.\n\n${pickupUrl()}/app`,
      html: emailLayout({
        lang: fr ? "fr" : "en",
        heading: fr ? "Le colis est en route" : "The parcel is on its way",
        intro: fr ? `« ${d.title} » a été envoyé à votre nom. Récupérez-le à ${where} dès son arrivée.` : `"${d.title}" was sent in your name. Collect it at ${where} as soon as it arrives.`,
        rows: [[fr ? "Agence" : "Agency", sentAgency || "—"], [fr ? "Reçu de l'agence" : "Agency receipt", receipt]],
        cta: { label: fr ? "Ouvrir Pickup" : "Open Pickup", url: `${pickupUrl()}/app` },
      }),
    }).catch(() => {});
  }
  if (r?.email && d.branch) {
    const fr = r.lang === "fr";
    await sendEmail({
      to: r.email,
      subject: fr ? `Pickup : le colis « ${d.title} » est parti` : `Pickup: "${d.title}" is on its way`,
      text: fr
        ? `L'expéditeur a envoyé le colis par ${d.branch.agency}. Reçu : ${receipt}. Récupérez-le à l'agence de ${d.branch.name} dès son arrivée.\n\n${pickupUrl()}/app`
        : `The sender sent the parcel through ${d.branch.agency}. Receipt: ${receipt}. Collect it at the ${d.branch.name} branch as soon as it arrives.\n\n${pickupUrl()}/app`,
      html: emailLayout({
        lang: fr ? "fr" : "en",
        heading: fr ? "Le colis est en route" : "The parcel is on its way",
        intro: fr
          ? `« ${d.title} » a été envoyé par ${d.branch.agency}. Récupérez-le à l'agence de ${d.branch.name} dès son arrivée.`
          : `"${d.title}" was sent through ${d.branch.agency}. Collect it at the ${d.branch.name} branch as soon as it arrives.`,
        rows: [[fr ? "Reçu de l'agence" : "Agency receipt", receipt]],
        cta: { label: fr ? "Ouvrir Pickup" : "Open Pickup", url: `${pickupUrl()}/app` },
      }),
    }).catch(() => {});
  }
}

/** Links to follow a delivery on the map. */
export function trackUrl(code: string): string {
  return `${pickupUrl()}/track/${code}`;
}

export async function notifyCollected(db: any, d: any) {
  const o = originOf(d);
  if (!d.trade_id) {
    await emailSender(d, "Your parcel is with the rider", "Votre colis est avec le livreur",
      `${d.rider_name} has collected "${d.title}" and is taking it to ${d.buyer_name}. Follow it on the map: ${trackUrl(d.track_code)}`,
      `${d.rider_name} a récupéré « ${d.title} » et l'apporte à ${d.buyer_name}. Suivez-le sur la carte : ${trackUrl(d.track_code)}`);
    return;
  }
  const trade = (await db.collection("trades").doc(d.trade_id).get()).data() || {};
  // Same city: the rider collected it from the seller, so the order is now on its way
  if (trade.status === "funds_held") {
    await db.collection("trades").doc(d.trade_id).update({ status: "shipped", updated_at: nowIso() });
  }
  await tradeEvent(db, d.trade_id, "Collected by the rider", `${d.rider_name} collected the parcel at ${o?.label || "the pickup point"} and is bringing it to the buyer.`, "info");
  await sendNotifications([
    { userId: trade.buyer_id, tone: "success", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, subject: d.title,
      title: "Your parcel is with the rider",
      body: `${d.rider_name} has collected “${d.title}” and is bringing it to you. Follow it on the map: ${trackUrl(d.track_code)}. Give the rider your delivery code only once you have checked your order.`,
      title_fr: "Votre colis est avec le livreur",
      body_fr: `${d.rider_name} a récupéré « ${d.title} » et vous l'apporte. Suivez-le sur la carte : ${trackUrl(d.track_code)}. Ne donnez votre code de livraison qu'après avoir vérifié votre commande.` },
    { userId: trade.vendor_id, tone: "info", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, email: false,
      title: "The rider has your parcel",
      body: `${d.rider_name} collected “${d.title}” and is delivering it to the buyer.`,
      title_fr: "Le livreur a votre colis",
      body_fr: `${d.rider_name} a récupéré « ${d.title} » et le livre à l'acheteur.` },
  ]);
}

export async function notifyDelivered(db: any, d: any) {
  if (!d.trade_id) {
    await emailSender(d, "Your parcel was delivered", "Votre colis a été livré",
      `${d.rider_name} handed "${d.title}" to ${d.buyer_name}, who gave the delivery code.`,
      `${d.rider_name} a remis « ${d.title} » à ${d.buyer_name}, qui a donné le code de livraison.`);
    return;
  }
  const trade = (await db.collection("trades").doc(d.trade_id).get()).data() || {};
  await tradeEvent(db, d.trade_id, "Delivered by the rider", `${d.rider_name} handed the parcel to the buyer, who gave the delivery code.`, "success");
  await sendNotifications([
    { userId: trade.buyer_id, tone: "success", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, subject: d.title,
      title: "Delivered: now confirm on Zola",
      body: `The rider delivered “${d.title}”. If everything is as agreed, press Confirm delivery on the transaction so the seller can be paid. If not, open a dispute.`,
      title_fr: "Livré : confirmez maintenant sur Zola",
      body_fr: `Le livreur a livré « ${d.title} ». Si tout est conforme, appuyez sur Confirmer la livraison sur la transaction pour que le vendeur soit payé. Sinon, ouvrez un litige.` },
    { userId: trade.vendor_id, tone: "success", link: `/trade/${d.trade_id}`, tradeId: d.trade_id, email: false,
      title: "Your parcel was delivered",
      body: `The rider handed “${d.title}” to the buyer. Once the buyer confirms, the 24-hour review starts.`,
      title_fr: "Votre colis a été livré",
      body_fr: `Le livreur a remis « ${d.title} » à l'acheteur. Dès que l'acheteur confirme, la vérification de 24 heures commence.` },
  ]);
}

/** Who the seller should address the parcel to, for the transaction page. */
export function deliveryForViewer(d: any, viewer: "buyer" | "seller" | "admin") {
  if (!d) return null;
  const base = {
    status: d.status, branch: d.branch || null, sent_agency: d.sent_agency || "", origin: originOf(d), mode: d.mode || (d.branch ? "out_of_town" : "same_city"), track_code: d.track_code,
    rider_name: d.rider_name || "", receipt_no: d.receipt_no || "",
    assigned_at: d.assigned_at || "", sent_at: d.sent_at || "", collected_at: d.collected_at || "", delivered_at: d.delivered_at || "",
  };
  if (viewer === "buyer") return { ...base, rider_phone: ["collected"].includes(d.status) ? d.rider_phone : "", handover_code: d.handover_code, dest: d.dest || null };
  if (viewer === "seller") return { ...base, rider_phone: d.rider_phone || "" };
  return { ...d, ...base, rider_phone: d.rider_phone || "" };
}

export { siteUrl };
