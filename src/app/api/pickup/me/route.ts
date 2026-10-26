import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRider, publicRider, SIGNED_OUT } from "@/lib/pickup/auth";
import { maxPackageValue, originOf } from "@/lib/pickup/config";

export const dynamic = "force-dynamic";

/**
 * Everything the rider's app shows: their account, what they can carry, the
 * delivery they have now, and their money history. The buyer's phone and
 * address are only shown once the rider has collected the parcel.
 */
export async function GET() {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    const db: any = getDb();

    let job: any = null;
    if (rider.active_trade) {
      const d = (await db.collection("deliveries").doc(rider.active_trade).get()).data();
      if (d && d.rider_id === rider.id) {
        const withBuyer = d.status === "collected";
        job = {
          trade_id: d.trade_id, status: d.status, title: d.title, amount: d.amount, rider_pay: d.rider_pay,
          branch: d.branch || null, sent_agency: d.sent_agency || "", origin: originOf(d), mode: d.mode || (d.branch ? "out_of_town" : "same_city"),
          receipt_no: d.receipt_no || "", seller_name: d.seller_name,
          // Same city: the rider calls the seller to collect it
          seller_phone: (d.mode === "same_city") ? d.seller_phone || "" : "",
          assigned_at: d.assigned_at, sent_at: d.sent_at || "", collected_at: d.collected_at || "",
          buyer_name: d.buyer_name,
          buyer_phone: withBuyer ? d.buyer_phone : "",
          dest: withBuyer ? d.dest : null,
          track_code: d.track_code,
        };
      }
    }

    const [ledgerSnap, wSnap, doneSnap] = await Promise.all([
      db.collection("rider_ledger").where("rider_id", "==", rider.id).get(),
      db.collection("rider_withdrawals").where("rider_id", "==", rider.id).get(),
      db.collection("deliveries").where("rider_id", "==", rider.id).get(),
    ]);
    const byDate = (a: any, b: any) => (b.created_at > a.created_at ? 1 : -1);
    const ledger = ledgerSnap.docs.map((d: any) => d.data()).sort(byDate).slice(0, 30);
    const withdrawals = wSnap.docs.map((d: any) => d.data()).sort(byDate).slice(0, 10);
    const done = doneSnap.docs.map((d: any) => d.data()).filter((d: any) => d.status === "delivered")
      .sort((a: any, b: any) => (b.delivered_at > a.delivered_at ? 1 : -1)).slice(0, 10)
      .map((d: any) => ({ trade_id: d.trade_id, title: d.title, delivered_at: d.delivered_at, rider_pay: d.rider_pay, city: originOf(d)?.city || d.city }));

    return NextResponse.json({ rider: publicRider(rider), maxValue: maxPackageValue(rider.balance), noLimit: !!rider.no_limit, job, ledger, withdrawals, done });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
