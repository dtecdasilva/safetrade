import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isPoint, quoteDelivery } from "@/lib/pickup/config";
import { getPickupSettings } from "@/lib/pickup/settings";
import { branchSnapshot } from "@/lib/pickup/deliveries";
import { findCity } from "@/lib/pickup/cities";

/** The price for a delivery, before booking: from a spot, a city centre (parcels from another city) or an agency branch, to a spot. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const db: any = getDb();
  let from: any = null;
  if (b.destCity) { const c = await findCity(db, b.destCity); if (c) from = { lat: c.lat, lng: c.lng }; }
  else if (b.destBranchId) { const br = await branchSnapshot(db, b.destBranchId); if (br) from = { lat: br.lat, lng: br.lng }; }
  else if (isPoint({ lat: b.originLat, lng: b.originLng })) from = { lat: Number(b.originLat), lng: Number(b.originLng) };
  const to = { lat: Number(b.destLat), lng: Number(b.destLng) };
  if (!from || !isPoint(to)) return NextResponse.json({ error: "Mark both places on the map" }, { status: 400 });
  return NextResponse.json(quoteDelivery(from, to, await getPickupSettings(db)));
}
