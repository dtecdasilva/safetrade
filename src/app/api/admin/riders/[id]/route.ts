import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { moveRiderMoney, retryWaiting } from "@/lib/pickup/deliveries";
import { sendEmail, emailLayout } from "@/lib/mail";
import { pickupUrl } from "@/lib/pickup/config";
import { makeSetupLink } from "@/lib/pickup/setup";

/**
 * Admin: approve or suspend a rider, change their balance (for example to
 * charge them for a lost or damaged parcel), turn "no limit" on or off, or
 * make a new link for them to set their password. Every change is written to the
 * rider's history.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await getSession();
    if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const db: any = getDb();
    const ref = db.collection("riders").doc(params.id);
    const r = (await ref.get()).data();
    if (!r) return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    const { action, amount, note, noLimit } = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    if (action === "approve") {
      await ref.update({ status: "approved", approved_at: now, approved_by: s.name, updated_at: now });
      if (r.email) {
        const fr = r.lang === "fr";
        await sendEmail({
          to: r.email,
          subject: fr ? "Pickup : votre compte est approuvé" : "Pickup: your account is approved",
          text: fr ? `Bonjour ${r.name}, votre compte livreur est approuvé. Rechargez votre solde et passez en disponible pour recevoir des livraisons : ${pickupUrl()}/app`
                   : `Hi ${r.name}, your rider account is approved. Top up your balance and switch to available to get deliveries: ${pickupUrl()}/app`,
          html: emailLayout({ lang: fr ? "fr" : "en",
            heading: fr ? "Votre compte est approuvé" : "Your account is approved",
            intro: fr ? "Rechargez votre solde et passez en disponible pour recevoir des livraisons." : "Top up your balance and switch to available to get deliveries.",
            cta: { label: fr ? "Ouvrir Pickup" : "Open Pickup", url: `${pickupUrl()}/app` } }),
        }).catch(() => {});
      }
      return NextResponse.json({ success: true });
    }
    if (action === "suspend") {
      if (r.active_trade) return NextResponse.json({ error: "This rider has a delivery. Move it to another rider first." }, { status: 400 });
      await ref.update({ status: "suspended", available: false, suspended_at: now, updated_at: now });
      return NextResponse.json({ success: true });
    }
    if (action === "adjust") {
      const delta = Math.round(Number(amount));
      const why = String(note || "").trim().slice(0, 200);
      if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: "Enter an amount, with a minus sign to take money off" }, { status: 400 });
      if (!why) return NextResponse.json({ error: "Say why, for the rider's history" }, { status: 400 });
      try {
        const balance = await moveRiderMoney(db, params.id, delta, { type: delta < 0 ? "deduction" : "credit", note: `${why} (by ${s.name})` });
        if (delta > 0) await retryWaiting(db, r.city);
        return NextResponse.json({ success: true, balance });
      } catch (e: any) {
        if (e.message === "NEGATIVE_BALANCE") return NextResponse.json({ error: "That would take the balance below zero" }, { status: 400 });
        throw e;
      }
    }
    if (action === "limit") {
      // No limit: they get any parcel, whatever their balance
      await ref.update({ no_limit: !!noLimit, updated_at: now });
      if (noLimit) await retryWaiting(db, r.city);
      return NextResponse.json({ success: true });
    }
    if (action === "setup_link") {
      // A new link to set (or reset) their password; the old link stops working
      return NextResponse.json({ success: true, link: await makeSetupLink(db, params.id), name: r.name, phone: r.phone });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
