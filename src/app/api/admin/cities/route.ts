import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPoint } from "@/lib/pickup/config";
import { cityId, listCities } from "@/lib/pickup/cities";

export const dynamic = "force-dynamic";

const admin = async () => (await getSession())?.role === "admin";
const DENIED = () => NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

/** Admin: the towns and cities Zola delivers in (with switched-off ones). */
export async function GET() {
  if (!(await admin())) return DENIED();
  return NextResponse.json({ cities: await listCities(getDb(), true) });
}

/**
 * Admin: add a city, or change one.
 *   { name, lat, lng }            add (or update the centre of) a city
 *   { id, active: true|false }    switch a city on or off
 */
export async function POST(req: NextRequest) {
  if (!(await admin())) return DENIED();
  const db: any = getDb();
  const b = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  if (b.id && typeof b.active === "boolean") {
    const ref = db.collection("pickup_cities").doc(String(b.id));
    if (!(await ref.get()).exists) return NextResponse.json({ error: "City not found" }, { status: 404 });
    await ref.update({ active: b.active, updated_at: now });
    return NextResponse.json({ success: true });
  }
  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (name.length < 2) return NextResponse.json({ error: "Enter the city's name" }, { status: 400 });
  const pt = { lat: Number(b.lat), lng: Number(b.lng) };
  if (!isPoint(pt) || (pt.lat === 0 && pt.lng === 0)) return NextResponse.json({ error: "Search the city or tap its centre on the map" }, { status: 400 });
  const id = cityId(name);
  if (!id) return NextResponse.json({ error: "Enter the city's name" }, { status: 400 });
  const ref = db.collection("pickup_cities").doc(id);
  const existing = (await ref.get()).data();
  // Same city typed differently ("douala"): keep the name as first written
  const keepName = existing && String(existing.name).toLowerCase() === name.toLowerCase() ? existing.name : name;
  await ref.set({ ...(existing || { created_at: now }), id, name: keepName, lat: pt.lat, lng: pt.lng, active: true, updated_at: now });
  return NextResponse.json({ success: true, id, updated: !!existing });
}
