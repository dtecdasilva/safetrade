import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendToMobileMoney } from "@/lib/fapshi";

/** Admin: send a rider's withdrawal through Fapshi. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await getSession();
    if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const db: any = getDb();
    const ref = db.collection("rider_withdrawals").doc(params.id);
    const w = (await ref.get()).data();
    if (!w) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    if (w.status !== "pending") return NextResponse.json({ error: "This withdrawal has already been processed" }, { status: 400 });
    const result = await sendToMobileMoney({ ref: params.id, amount: w.amount, phone: w.phone, network: w.network === "orange" ? "orange" : "mtn", description: `Pickup withdrawal for ${w.rider_name}` });
    if (!result.success) return NextResponse.json({ error: `Payout failed: ${result.error}` }, { status: 500 });
    await ref.update({ status: "sent", sent_at: new Date().toISOString(), sent_by: s.name, payout_ref: result.transId || "" });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
