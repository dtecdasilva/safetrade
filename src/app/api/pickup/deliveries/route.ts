import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { cleanPhone, phoneInUse } from "@/lib/users";
import { createDirect, readBooking } from "@/lib/pickup/direct";
import { DELIVERY_STATUS, DeliveryStatus } from "@/lib/pickup/config";
import { getLang } from "@/lib/i18n/server";

/** The signed-in sender's deliveries, newest first. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in to see your deliveries" }, { status: 401 });
  const snap = await (getDb() as any).collection("deliveries").where("sender_id", "==", s.id).get();
  const deliveries = snap.docs.map((x: any) => {
    const d = x.data();
    return {
      id: d.id, title: d.title, status: d.status, label: DELIVERY_STATUS[d.status as DeliveryStatus]?.label || d.status,
      fee: d.fee, km: d.km, recipient: d.recipient?.name || "", dest: d.dest?.landmark || "", city: d.city,
      rider_name: d.rider_name || "", created_at: d.created_at, path: `/d/${d.id}?k=${d.manage_key}`,
    };
  }).sort((a: any, b: any) => (b.created_at > a.created_at ? 1 : -1));
  return NextResponse.json({ deliveries });
}

/**
 * Anyone books a delivery on Pickup, with or without an account. They pay on
 * the next page. Signed-in senders don't type their details, and the delivery
 * shows up in their My deliveries.
 */
export async function POST(req: NextRequest) {
  try {
    const s = await getSession();
    const db: any = getDb();
    const body = await req.json().catch(() => ({}));
    const user = s ? (await db.collection("users").doc(s.id).get()).data() : null;
    let booking = body;
    if (user) {
      // A phone typed here is used only if the account has none
      const phone = user.phone || cleanPhone(body.senderPhone);
      booking = { ...body, senderName: user.name, senderPhone: phone, senderEmail: user.email || "" };
    }
    const r = await readBooking(db, booking);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    if (user && !user.phone && booking.senderPhone && !(await phoneInUse(db, booking.senderPhone, user.id)))
      await db.collection("users").doc(user.id).update({ phone: booking.senderPhone }).catch(() => {});
    const d = await createDirect(db, r.value, { by: "public", senderId: user ? user.id : undefined, lang: body.lang || user?.lang || getLang() });
    return NextResponse.json({ success: true, id: d.id, key: d.manage_key, fee: d.fee, km: d.km });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
