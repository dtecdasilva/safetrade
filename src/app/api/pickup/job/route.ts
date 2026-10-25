import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRider, SIGNED_OUT } from "@/lib/pickup/auth";
import {
  assignRider, moveRiderMoney, notifyCollected, notifyDelivered, releaseRider, retryWaiting,
} from "@/lib/pickup/deliveries";

const now = () => new Date().toISOString();

/**
 * The rider moves their delivery along:
 *   decline    can't take it (only before the seller sends it in their name)
 *   collected  picked it up at the agency branch
 *   delivered  handed it to the buyer, who gave the 4-digit code
 */
export async function POST(req: NextRequest) {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    const { action, code } = await req.json().catch(() => ({}));
    if (!rider.active_trade) return NextResponse.json({ error: "You don't have a delivery right now" }, { status: 400 });

    const db: any = getDb();
    const ref = db.collection("deliveries").doc(rider.active_trade);
    const d = (await ref.get()).data();
    if (!d || d.rider_id !== rider.id) return NextResponse.json({ error: "You don't have a delivery right now" }, { status: 400 });
    const hist = (status: string) => [...(d.history || []), { status, at: now() }];

    if (action === "decline") {
      if (d.status !== "assigned")
        return NextResponse.json({ error: "The seller has already sent the parcel in your name. Call Zola if you can't collect it." }, { status: 400 });
      await ref.update({ status: "waiting_rider", rider_id: null, rider_name: "", rider_phone: "", declined: [...(d.declined || []), rider.id], history: hist("declined"), updated_at: now() });
      await releaseRider(db, rider.id, d.id);
      // Offer it to the next rider (they and the seller are told)
      await assignRider(db, d.id);
      return NextResponse.json({ success: true });
    }

    if (action === "collected") {
      if (!["assigned", "sent"].includes(d.status))
        return NextResponse.json({ error: "This parcel can't be marked as collected now" }, { status: 400 });
      await ref.update({ status: "collected", collected_at: now(), history: hist("collected"), updated_at: now(),
        ...(Number.isFinite(rider.loc_lat) ? { rider_loc: { lat: rider.loc_lat, lng: rider.loc_lng, at: rider.loc_at } } : {}) });
      await notifyCollected(db, d);
      return NextResponse.json({ success: true });
    }

    if (action === "delivered") {
      if (d.status !== "collected")
        return NextResponse.json({ error: "Collect the parcel first" }, { status: 400 });
      if (String(code || "").trim() !== String(d.handover_code))
        return NextResponse.json({ error: "That code is wrong. Ask the buyer for the 4-digit code on their Zola transaction." }, { status: 400 });
      const claimed: boolean = await db.runTransaction(async (tx: any) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists || fresh.data().status !== "collected") return false;
        tx.update(ref, { status: "delivered", delivered_at: now(), history: hist("delivered"), updated_at: now() });
        return true;
      });
      if (!claimed) return NextResponse.json({ error: "This delivery is already finished" }, { status: 400 });
      await releaseRider(db, rider.id, d.id);
      await db.collection("riders").doc(rider.id).update({ deliveries_done: (Number(rider.deliveries_done) || 0) + 1 });
      if (Number(d.rider_pay) > 0)
        await moveRiderMoney(db, rider.id, Number(d.rider_pay), { type: "earning", note: `Delivery: ${d.title}`, trade_id: d.trade_id });
      await notifyDelivered(db, d);
      // This rider is free again: give them (or someone) the next waiting parcel
      await retryWaiting(db, rider.city);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
