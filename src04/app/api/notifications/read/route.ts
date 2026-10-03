import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { audienceFor } from "@/lib/notifications";

/** Mark one notification ({ id }) or all of them ({ all: true }) as read. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const { id, all } = await req.json().catch(() => ({} as any));
    const audience = audienceFor(session);
    const db = getDb();

    if (id) {
      const ref = db.collection("notifications").doc(String(id));
      const doc = await ref.get();
      if (!doc.exists || doc.data()!.user_id !== audience)
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
      await ref.update({ read: true });
      return NextResponse.json({ success: true });
    }

    if (all) {
      const snap = await db.collection("notifications").where("user_id", "==", audience).get();
      const unread = snap.docs.filter((d) => !d.data().read).slice(0, 400);
      if (unread.length) {
        const batch = db.batch();
        unread.forEach((d) => batch.update(d.ref, { read: true }));
        await batch.commit();
      }
      return NextResponse.json({ success: true, updated: unread.length });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
