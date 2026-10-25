import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPickupSettings, pickupCities } from "@/lib/pickup/settings";

export const dynamic = "force-dynamic";

/** Where Pickup delivers, whether it's on, and how prices work (for forms). */
export async function GET() {
  const db: any = getDb();
  const s = await getPickupSettings(db);
  return NextResponse.json({ enabled: s.enabled, cities: await pickupCities(db), pricing: { base: s.base, per_km: s.per_km, min: s.min }, max_value: s.max_value });
}
