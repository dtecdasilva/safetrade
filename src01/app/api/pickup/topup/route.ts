import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getRider, SIGNED_OUT } from "@/lib/pickup/auth";
import { chargeMobileMoney } from "@/lib/fapshi";
import { MIN_TOPUP } from "@/lib/pickup/config";
import { TOPUP_PREFIX } from "@/lib/pickup/topups";
import { cleanPhone } from "@/lib/users";

/** Start a top-up: a mobile money prompt is sent to the rider's phone. */
export async function POST(req: NextRequest) {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const amount = Math.round(Number(b.amount));
    if (!Number.isFinite(amount) || amount < MIN_TOPUP)
      return NextResponse.json({ error: `The smallest top-up is FCFA ${MIN_TOPUP.toLocaleString("en-US")}` }, { status: 400 });
    if (amount > 1000000) return NextResponse.json({ error: "That amount is too high" }, { status: 400 });
    const phone = cleanPhone(b.phone);
    if (phone.length < 9) return NextResponse.json({ error: "Enter your mobile money number" }, { status: 400 });
    if (b.network !== "mtn" && b.network !== "orange") return NextResponse.json({ error: "Choose a network" }, { status: 400 });

    const id = `${TOPUP_PREFIX}${randomUUID().replace(/-/g, "")}`;
    const result = await chargeMobileMoney({ ref: id, amount, phone, network: b.network, description: "Pickup balance top-up" });
    if (!result.success) return NextResponse.json({ error: result.error || "The payment could not be started. Please try again." }, { status: 502 });

    const db: any = getDb();
    await db.collection("rider_topups").doc(id).set({
      id, rider_id: rider.id, amount, phone, network: b.network, status: "pending",
      fapshi_ref: result.transId || "", created_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
