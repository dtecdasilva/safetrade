import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { adminChoices, assignRider, releaseRider } from "@/lib/pickup/deliveries";

/**
 * Admin: who could take this delivery (GET), or
 *   { action: "auto" }                  find the best free rider again
 *   { action: "assign", riderId }       give it to a chosen rider, even if their balance is too low for its value
 *   { action: "unassign" }              take it back from the rider (before it is sent)
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const db: any = getDb();
  const d = (await db.collection("deliveries").doc(params.id).get()).data();
  if (!d) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  return NextResponse.json({ amount: Number(d.amount || 0), candidates: await adminChoices(db, { ...d, id: params.id }) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await getSession();
    if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const db: any = getDb();
    const ref = db.collection("deliveries").doc(params.id);
    const d = (await ref.get()).data();
    if (!d) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    const { action, riderId } = await req.json().catch(() => ({}));

    if (!["waiting_rider", "assigned"].includes(d.status))
      return NextResponse.json({ error: "The seller has already sent the parcel to the current rider, so it can't be moved here. Sort it out by phone with the rider and the agency." }, { status: 400 });

    if (action === "unassign") {
      if (d.rider_id) await releaseRider(db, d.rider_id, params.id);
      await ref.update({ status: "waiting_rider", rider_id: null, rider_name: "", rider_phone: "", waiting_notified: true, updated_at: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }
    if (action === "auto") {
      const r = await assignRider(db, params.id);
      return NextResponse.json({ success: true, rider: r ? { id: r.id, name: r.name } : null });
    }
    if (action === "assign") {
      try {
        const r = await assignRider(db, params.id, { riderId: String(riderId || ""), by: s.name });
        if (!r) return NextResponse.json({ error: "That rider couldn't be assigned" }, { status: 400 });
        return NextResponse.json({ success: true, rider: { id: r.id, name: r.name } });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
