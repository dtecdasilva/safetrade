import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { agencySpots } from "@/lib/pickup/agencies";

export const dynamic = "force-dynamic";

/** Admin: the agency offices senders have marked, to tidy up the suggestions. */
export async function GET() {
  if ((await getSession())?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  return NextResponse.json({ spots: await agencySpots(getDb(), undefined, true) });
}

/** { id, hidden: true|false } hides a wrong suggestion (or shows it again). */
export async function POST(req: NextRequest) {
  if ((await getSession())?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const { id, hidden } = await req.json().catch(() => ({}));
  const ref = getDb().collection("agency_spots").doc(String(id || ""));
  if (!id || !(await ref.get()).exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await ref.update({ hidden: !!hidden, updated_at: new Date().toISOString() });
  return NextResponse.json({ success: true });
}
