import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyTradeMove } from "@/lib/notifications";
import { reviewState } from "@/lib/review";

/**
 * Admin steps during the 24-hour review that follows "Confirm delivery".
 *
 *   { action: "contacted", note? }  the admin called or texted the buyer
 *   { action: "resolve",   note  }  the buyer's complaint has been settled
 *
 * Releasing the payment itself stays in /api/admin/release/[id].
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const note = String(body.note || "").replace(/\s+/g, " ").trim().slice(0, 500);

    const db = getDb();
    const ref = db.collection("trades").doc(params.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    const trade = doc.data()!;

    if (trade.status !== "pending_release")
      return NextResponse.json({ error: "This transaction isn't under review" }, { status: 400 });

    const now = new Date().toISOString();
    const addEvent = async (label: string, detail: string, type = "info") => {
      const id = randomUUID();
      await db.collection("trade_events").doc(id).set({
        id, trade_id: params.id, label, detail, type, created_at: now,
      });
    };

    const review = reviewState(trade as any);

    if (action === "contacted") {
      await ref.update({
        review_contacted_at: now,
        review_contacted_by: session.name,
        review_contact_note: note,
        updated_at: now,
      });
      await addEvent(
        "Buyer contacted",
        `Zola called or texted the buyer to check on this order.${note ? ` Note: ${note}` : ""}`,
        "info"
      );
      return NextResponse.json({ success: true });
    }

    if (action === "resolve") {
      if (!review.complaintOpen)
        return NextResponse.json({ error: "There is no open complaint on this transaction" }, { status: 400 });
      if (!note)
        return NextResponse.json({ error: "Add a short note on how the complaint was settled" }, { status: 400 });

      await ref.update({
        complaint_status: "resolved",
        complaint_resolved_at: now,
        complaint_resolved_by: session.name,
        complaint_resolution: note,
        // Settling a complaint means the buyer was spoken to
        ...(trade.review_contacted_at ? {} : { review_contacted_at: now, review_contacted_by: session.name }),
        updated_at: now,
      });
      await addEvent("Complaint resolved", `Zola closed the buyer's complaint. Note: ${note}`, "success");
      await notifyTradeMove("complaint_resolved", { ...(trade as any), id: params.id }, { note });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
