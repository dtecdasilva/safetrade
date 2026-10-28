import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { reviewState } from "@/lib/review";
import { buildIcs, payoutEvent } from "@/lib/calendar";
import { siteUrl } from "@/lib/support";

export const dynamic = "force-dynamic";

/** Admin: a calendar invite for when this transaction's 24-hour review ends ("Time to pay the vendor"). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if ((await getSession())?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const t = (await (getDb() as any).collection("trades").doc(params.id).get()).data();
  if (!t) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  const r = reviewState(t);
  if (!r.inReview || !r.endsAt) return NextResponse.json({ error: "This transaction isn't under review" }, { status: 400 });
  const ics = buildIcs([payoutEvent({ ...t, id: params.id }, r.endsAt, siteUrl())], "Zola: payments to release");
  return new NextResponse(ics, { headers: {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="zola-pay-vendor-${params.id.slice(0, 8)}.ics"`,
  } });
}
