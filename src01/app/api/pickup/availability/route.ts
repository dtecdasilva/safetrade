import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRider, SIGNED_OUT } from "@/lib/pickup/auth";
import { retryWaiting } from "@/lib/pickup/deliveries";
import { isPoint } from "@/lib/pickup/config";

/** A rider says they are free to take deliveries (or stops). */
export async function POST(req: NextRequest) {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    if (rider.status !== "approved")
      return NextResponse.json({ error: "Zola has to approve your account before you can take deliveries" }, { status: 403 });
    const { available, lat, lng } = await req.json().catch(() => ({}));
    const db: any = getDb();
    const now = new Date().toISOString();
    await db.collection("riders").doc(rider.id).update({
      available: available === true,
      ...(isPoint({ lat, lng }) ? { loc_lat: Number(lat), loc_lng: Number(lng), loc_at: now } : {}),
      updated_at: now,
    });
    let assigned = 0;
    if (available === true && !rider.active_trade) assigned = await retryWaiting(db, rider.city);
    return NextResponse.json({ success: true, available: available === true, assigned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
