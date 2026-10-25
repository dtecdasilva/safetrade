import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPickupSettings } from "@/lib/pickup/settings";

/** Admin: Pickup on/off and its prices. */
export async function GET() {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  return NextResponse.json({ settings: await getPickupSettings(getDb() as any) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const n = (v: any, min: number, max: number) => { const x = Number(v); return Number.isFinite(x) && x >= min && x <= max ? x : null; };
  const settings = {
    enabled: b.enabled === true,
    base: n(b.base, 0, 100000), per_km: n(b.per_km, 0, 100000), min: n(b.min, 0, 100000),
    road_factor: n(b.road_factor, 1, 3), rider_share: n(b.rider_share, 0, 1), max_value: n(b.max_value, 0, 100000000),
  };
  if (Object.values(settings).some((v) => v === null)) return NextResponse.json({ error: "Check the numbers: the road factor is between 1 and 3, and the rider's share between 0 and 100%." }, { status: 400 });
  await (getDb() as any).collection("settings").doc("pickup").set({ ...settings, updated_at: new Date().toISOString(), updated_by: s.name });
  return NextResponse.json({ success: true, settings });
}
