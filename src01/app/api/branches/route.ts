import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The bus agency branches sellers can send to, grouped by city on the screen. */
export async function GET() {
  try {
    const snap = await (getDb() as any).collection("agency_branches").where("active", "==", true).get();
    const branches = snap.docs.map((d: any) => {
      const b = d.data();
      return { id: b.id, agency: b.agency, name: b.name, city: b.city, address: b.address || "" };
    }).sort((a: any, b: any) => (a.city + a.agency + a.name).localeCompare(b.city + b.agency + b.name));
    return NextResponse.json({ branches });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
