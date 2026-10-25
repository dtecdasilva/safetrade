import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifySellerFlag } from "@/lib/notifications";

/**
 * Admin: flag a seller so buyers are warned on every transaction with them,
 * or remove the flag. The note is for admins only; buyers see a standard warning.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    const { flagged, note } = await req.json().catch(() => ({}));
    const db  = getDb();
    const ref = db.collection("users").doc(params.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (doc.data()?.role === "admin")
      return NextResponse.json({ error: "Admin accounts can't be flagged" }, { status: 400 });

    const now  = new Date().toISOString();
    const on   = flagged === true;
    const was  = !!doc.data()?.flagged;
    if (on) {
      await ref.update({
        flagged: true,
        flag_note: String(note || "").trim().slice(0, 500),
        flagged_at: now,
        flagged_by: session.name,
      });
    } else {
      await ref.update({ flagged: false, flag_note: "", unflagged_at: now, unflagged_by: session.name });
    }
    // Only tell the seller when something actually changed
    if (on !== was) await notifySellerFlag(params.id, on);

    return NextResponse.json({ success: true, flagged: on });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
