import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isPoint, originOf } from "@/lib/pickup/config";

export const dynamic = "force-dynamic";

/**
 * Public tracking: anyone with the 10-character code sees where the parcel
 * is. No phone numbers, and the rider only by first name.
 */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const code = String(params.code || "").toUpperCase();
    if (!/^[A-Z0-9]{6,20}$/.test(code)) return NextResponse.json({ error: "Tracking code not found" }, { status: 404 });
    const snap = await (getDb() as any).collection("deliveries").where("track_code", "==", code).limit(1).get();
    if (snap.empty) return NextResponse.json({ error: "Tracking code not found" }, { status: 404 });
    const d = snap.docs[0].data();
    const moving = d.status === "collected" && isPoint(d.rider_loc);
    return NextResponse.json({
      title: d.title,
      status: d.status,
      mode: d.mode || (d.branch ? "out_of_town" : "same_city"),
      paid: d.status !== "awaiting_payment",
      branch: d.branch ? { agency: d.branch.agency, name: d.branch.name, city: d.branch.city } : null,
      // Same city: show the area, not the sender's exact door
      origin: (() => { const o = originOf(d)!; return d.branch ? { lat: o.lat, lng: o.lng, label: o.label, city: o.city } : { lat: Math.round(o.lat * 200) / 200, lng: Math.round(o.lng * 200) / 200, label: o.city, city: o.city }; })(),
      rider: d.rider_name ? String(d.rider_name).split(" ")[0] : "",
      rider_loc: moving ? d.rider_loc : null,
      dest: d.status !== "delivered" && isPoint(d.dest) ? { lat: d.dest.lat, lng: d.dest.lng } : null,
      history: (d.history || []).filter((h: any) => h.status !== "declined").map((h: any) => ({ status: h.status, at: h.at })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
