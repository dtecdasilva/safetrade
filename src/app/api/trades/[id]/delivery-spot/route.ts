import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPoint } from "@/lib/pickup/config";

/** The buyer says where the rider should bring the parcel: a map pin and a landmark. */
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

    const dest = { lat: Number(lat), lng: Number(lng), landmark: text };
    await tRef.update({ delivery_lat: dest.lat, delivery_lng: dest.lng, delivery_landmark: text, updated_at: new Date().toISOString() });
    if (d) await dRef.update({ dest });
    return NextResponse.json({ success: true, dest });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
