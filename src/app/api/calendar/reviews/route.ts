import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { feedAllowed } from "@/lib/calendarFeed";
import { reviewState } from "@/lib/review";
import { buildIcs, payoutEvent } from "@/lib/calendar";
import { siteUrl } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * The admin's calendar subscription (no sign-in: calendar apps can't sign in,
 * so the private link's key is checked instead). Every transaction under
 * review appears as "Time to pay the vendor" when its 24 hours end.
 */
export async function GET(req: NextRequest) {
  const db: any = getDb();
  if (!(await feedAllowed(db, req.nextUrl.searchParams.get("t")))) return new NextResponse("Not found", { status: 404 });
  const snap = await db.collection("trades").where("status", "==", "pending_release").get();
  const events = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))
    .map((t: any) => ({ t, r: reviewState(t) }))
    .filter(({ r }: any) => r.endsAt)
    .map(({ t, r }: any) => payoutEvent(t, r.endsAt, siteUrl()));
  return new NextResponse(buildIcs(events, "Zola: payments to release"), { headers: {
    "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store",
  } });
}
