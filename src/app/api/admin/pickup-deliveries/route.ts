import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createDirect, manageUrl, readBooking } from "@/lib/pickup/direct";
import { originOf } from "@/lib/pickup/config";

export const dynamic = "force-dynamic";

/** Admin: every Pickup delivery (booked on Pickup, created by an admin, or from Zola). */
export async function GET() {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const snap = await (getDb() as any).collection("deliveries").get();
  const deliveries = snap.docs.map((x: any) => {
    const d = x.data();
    return {
      id: d.id, kind: d.kind || "zola", trade_id: d.trade_id || null, status: d.status, title: d.title, amount: d.amount, fee: d.fee || 0,
      city: originOf(d)?.city || d.city, mode: d.mode || (d.branch ? "out_of_town" : "same_city"),
      sender: d.sender?.name || d.seller_name, recipient: d.recipient?.name || d.buyer_name,
      rider_name: d.rider_name || "", over_limit: !!d.over_limit && !!d.rider_id, created_at: d.created_at, created_by: d.created_by || "zola",
      link: d.kind === "direct" ? manageUrl(d) : "",
    };
  }).sort((a: any, b: any) => (b.created_at > a.created_at ? 1 : -1));
  return NextResponse.json({ deliveries });
}

/**
 * Admin: create a delivery for a client and (optionally) choose the rider.
 * The client gets a link to pay the delivery fee; once paid, the rider is sent.
 */
export async function POST(req: NextRequest) {
  try {
    const s = await getSession();
    if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const db: any = getDb();
    const b = await req.json().catch(() => ({}));
    const r = await readBooking(db, b);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    let preferred = "";
    if (b.riderId) {
      const rider = (await db.collection("riders").doc(String(b.riderId)).get()).data();
      if (!rider || rider.status !== "approved") return NextResponse.json({ error: "Choose an approved rider" }, { status: 400 });
      preferred = rider.id;
    }
    const fee = b.fee ? Math.round(Number(b.fee)) : 0;
    if (b.fee && (!Number.isFinite(fee) || fee < 100)) return NextResponse.json({ error: "The price must be at least FCFA 100" }, { status: 400 });
    const d = await createDirect(db, r.value, { by: "admin", adminName: s.name, preferredRider: preferred, fee, lang: b.lang });
    return NextResponse.json({ success: true, id: d.id, link: manageUrl(d), fee: d.fee, km: d.km });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
