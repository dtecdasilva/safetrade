import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRider, SIGNED_OUT } from "@/lib/pickup/auth";
import { isPoint } from "@/lib/pickup/config";

/**
 * The rider's phone reports where it is, every half-minute or so while the
 * Pickup app is open. Used to find the closest rider, and to show the buyer
 * the parcel moving on the map once it has been collected.
 */
export async function POST(req: NextRequest) {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    const { lat, lng, accuracy } = await req.json().catch(() => ({}));
    if (!isPoint({ lat, lng })) return NextResponse.json({ error: "Location not valid" }, { status: 400 });
    const db: any = getDb();
    const now = new Date().toISOString();
    const at = { lat: Number(lat), lng: Number(lng), at: now, ...(Number.isFinite(Number(accuracy)) ? { accuracy: Math.round(Number(accuracy)) } : {}) };
    await db.collection("riders").doc(rider.id).update({ loc_lat: at.lat, loc_lng: at.lng, loc_at: now });
    if (rider.active_trade) {
      const ref = db.collection("deliveries").doc(rider.active_trade);
      const d = (await ref.get()).data();
      if (d && d.rider_id === rider.id && d.status === "collected") await ref.update({ rider_loc: at });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
