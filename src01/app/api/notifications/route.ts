import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { audienceFor } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** The signed-in person's latest notifications, newest first. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    // Single-field filter, sorted in memory, so no composite index is needed
    const snap = await db.collection("notifications").where("user_id", "==", audienceFor(session)).get();
    const all = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

    return NextResponse.json({
      notifications: all.slice(0, 30),
      unread: all.filter((n) => !n.read).length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
