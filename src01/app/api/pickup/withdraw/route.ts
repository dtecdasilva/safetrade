import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getRider, SIGNED_OUT } from "@/lib/pickup/auth";
import { moveRiderMoney } from "@/lib/pickup/deliveries";
import { sendNotifications, ADMIN_AUDIENCE } from "@/lib/notifications";
import { cleanPhone } from "@/lib/users";

/** A rider takes money out of their balance. Zola sends it to their mobile money. */
export async function POST(req: NextRequest) {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    if (rider.active_trade)
      return NextResponse.json({ error: "Finish your delivery first. Your balance guarantees the parcel you are carrying." }, { status: 400 });
    const b = await req.json().catch(() => ({}));
    const amount = Math.round(Number(b.amount));
    if (!Number.isFinite(amount) || amount < 500) return NextResponse.json({ error: "The smallest withdrawal is FCFA 500" }, { status: 400 });
    if (amount > Number(rider.balance)) return NextResponse.json({ error: "That's more than your balance" }, { status: 400 });
    const phone = cleanPhone(b.phone);
    if (phone.length < 9) return NextResponse.json({ error: "Enter your mobile money number" }, { status: 400 });
    if (b.network !== "mtn" && b.network !== "orange") return NextResponse.json({ error: "Choose a network" }, { status: 400 });

    const db: any = getDb();
    const pending = await db.collection("rider_withdrawals").where("rider_id", "==", rider.id).get();
    if (pending.docs.some((d: any) => d.data().status === "pending"))
      return NextResponse.json({ error: "You already have a withdrawal in progress" }, { status: 400 });

    const id = randomUUID();
    try {
      await moveRiderMoney(db, rider.id, -amount, { type: "withdrawal", note: "Withdrawal to mobile money", ref: id });
    } catch {
      return NextResponse.json({ error: "That's more than your balance" }, { status: 400 });
    }
    await db.collection("rider_withdrawals").doc(id).set({
      id, rider_id: rider.id, rider_name: rider.name, amount, phone, network: b.network, status: "pending", created_at: new Date().toISOString(),
    });
    await sendNotifications([{ userId: ADMIN_AUDIENCE, tone: "warn", link: "/admin?tab=riders",
      title: "Rider withdrawal requested",
      body: `${rider.name} asked to withdraw FCFA ${amount.toLocaleString("en-US")} to ${b.network === "orange" ? "Orange Money" : "MTN"}, +237${phone}. Send it from Admin, Riders.` }]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
