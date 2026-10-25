import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chargeMobileMoney } from "@/lib/fapshi";
import { cleanPhone } from "@/lib/users";

/** Send the mobile money prompt for the delivery fee. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { k, phone, network } = await req.json().catch(() => ({}));
    const db: any = getDb();
    const ref = db.collection("deliveries").doc(params.id);
    const d = (await ref.get()).data();
    if (!d || d.kind !== "direct" || k !== d.manage_key) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (d.status !== "awaiting_payment") return NextResponse.json({ error: "This delivery is already paid" }, { status: 400 });
    const p = cleanPhone(phone);
    if (p.length < 9) return NextResponse.json({ error: "Enter your mobile money number" }, { status: 400 });
    if (network !== "mtn" && network !== "orange") return NextResponse.json({ error: "Choose a network" }, { status: 400 });
    const r = await chargeMobileMoney({ ref: params.id, amount: d.fee, phone: p, network, description: `Pickup delivery: ${d.title}` });
    if (!r.success) return NextResponse.json({ error: r.error || "The payment could not be started. Please try again." }, { status: 502 });
    await ref.update({ fapshi_ref: r.transId || "", payment_started_at: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
