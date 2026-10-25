import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPoint } from "@/lib/pickup/config";
import { pickupPrice, tradeOrigin } from "@/lib/pickup/tradeDelivery";

/**
 * The buyer says where the rider should bring the parcel: a map pin and a
 * landmark. Before payment this also sets the delivery fee, from the
 * distance between the pickup point and this spot. After payment the price
 * is fixed, so the spot can only be set if it wasn't before.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
    const db: any = getDb();
    const tRef = db.collection("trades").doc(params.id);
    const trade = (await tRef.get()).data();
    if (!trade) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    if (trade.buyer_id !== session.id) return NextResponse.json({ error: "Only the buyer can set where to deliver" }, { status: 403 });
    const { lat, lng, landmark } = await req.json().catch(() => ({}));
    if (!isPoint({ lat, lng }) || (Number(lat) === 0 && Number(lng) === 0)) return NextResponse.json({ error: "Put your delivery spot on the map" }, { status: 400 });
    const text = String(landmark || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (text.length < 3) return NextResponse.json({ error: "Describe the place so the rider finds you, for example: behind Total Bonamoussadi, blue gate" }, { status: 400 });

    const dRef = db.collection("deliveries").doc(params.id);
    const d = (await dRef.get()).data();
    if (d && d.status === "delivered") return NextResponse.json({ error: "This parcel has already been delivered" }, { status: 400 });

    const beforePayment = ["awaiting_seller", "pending_payment"].includes(trade.status);
    const hadSpot = isPoint({ lat: trade.delivery_lat, lng: trade.delivery_lng });
    if (!beforePayment && hadSpot && !trade.delivery_pending)
      return NextResponse.json({ error: "The delivery price was set from your spot when you paid, so it can't be moved now. Call the rider or Zola customer service if you need to meet somewhere else." }, { status: 400 });
    if (beforePayment && trade.payment_started_at && Date.now() - Date.parse(trade.payment_started_at) < 10 * 60000)
      return NextResponse.json({ error: "You're paying for this right now, so it can't be changed. Try again in a few minutes." }, { status: 409 });

    const dest = { lat: Number(lat), lng: Number(lng), landmark: text };
    const fields: any = { delivery_lat: dest.lat, delivery_lng: dest.lng, delivery_landmark: text, updated_at: new Date().toISOString() };
    let price: any = null;
    const origin = tradeOrigin(trade);
    if (beforePayment && origin) {
      price = await pickupPrice(db, Number(trade.amount), origin, dest);
      Object.assign(fields, { delivery_fee: price.delivery_fee, delivery_km: price.delivery_km, delivery_pending: false, buyer_total: price.buyer_total });
    }
    await tRef.update(fields);
    if (d) await dRef.update({ dest });
    return NextResponse.json({ success: true, dest, ...(price ? { deliveryFee: price.delivery_fee, km: price.delivery_km, total: price.buyer_total } : {}) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
