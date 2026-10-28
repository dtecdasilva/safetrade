import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agencySpots } from "@/lib/pickup/agencies";

export const dynamic = "force-dynamic";

/** Agency offices senders have used in a city, most used first (for the form's suggestions). */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") || "";
  if (!city) return NextResponse.json({ agencies: [] });
  const list = await agencySpots(getDb(), city);
  return NextResponse.json({ agencies: list.slice(0, 30).map((s: any) => ({ id: s.id, agency: s.agency, quarter: s.quarter, lat: s.lat, lng: s.lng })) });
}
