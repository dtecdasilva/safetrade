import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { feedUrl } from "@/lib/calendarFeed";

export const dynamic = "force-dynamic";

/** Admin: the private link to subscribe to (GET), or a new one that cancels the old (POST). */
export async function GET() {
  if ((await getSession())?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  return NextResponse.json({ url: await feedUrl(getDb()) });
}
export async function POST(_req: NextRequest) {
  if ((await getSession())?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  return NextResponse.json({ url: await feedUrl(getDb(), true) });
}
