import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Admin: mark a report as reviewed (or open it again), with a private note. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    const { action, note } = await req.json().catch(() => ({}));
    const db  = getDb();
    const ref = db.collection("reports").doc(params.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const now = new Date().toISOString();
    if (action === "reviewed") {
      await ref.update({
        status: "reviewed",
        reviewed_at: now,
        reviewed_by: session.name,
        review_note: String(note || "").trim().slice(0, 500),
      });
    } else if (action === "reopen") {
      await ref.update({ status: "open", reopened_at: now });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
