import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, trackingNumber } = await req.json();
    const db = getDb();

    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    const trade = tradeDoc.data()!;

    const addEvent = async (label: string, detail: string, type = "info") => {
      const id = randomUUID();
      await db.collection("trade_events").doc(id).set({
        id, trade_id: params.id, label, detail, type,
        created_at: new Date().toISOString(),
      });
    };

    const updateTrade = async (fields: Record<string, any>) => {
      await db.collection("trades").doc(params.id).update({
        ...fields,
        updated_at: new Date().toISOString(),
      });
    };

    switch (action) {
      case "pay": {
        if (session.id !== trade.buyer_id)
          return NextResponse.json({ error: "Only buyer can pay" }, { status: 403 });
        if (trade.status !== "pending_payment")
          return NextResponse.json({ error: "Trade already paid" }, { status: 400 });
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (trade.delivery_days || 7));
        await updateTrade({ status: "funds_held", delivery_deadline: deadline.toISOString() });
        await addEvent("Payment confirmed", `FCFA ${trade.amount.toLocaleString()} locked in escrow vault`, "success");
        break;
      }
      case "ship": {
        if (session.id !== trade.vendor_id)
          return NextResponse.json({ error: "Only vendor can mark shipped" }, { status: 403 });
        if (trade.status !== "funds_held")
          return NextResponse.json({ error: "Funds not yet locked" }, { status: 400 });
        const tracking = trackingNumber || "N/A";
        await updateTrade({ status: "shipped", tracking_number: tracking });
        await addEvent("Item shipped", `Tracking: ${tracking}`, "info");
        break;
      }
      case "confirm": {
        if (session.id !== trade.buyer_id)
          return NextResponse.json({ error: "Only buyer can confirm" }, { status: 403 });
        if (!["shipped", "funds_held"].includes(trade.status))
          return NextResponse.json({ error: "Cannot confirm delivery at this stage" }, { status: 400 });
        await updateTrade({ status: "pending_release" });
        await addEvent("Delivery confirmed by buyer", "Awaiting admin approval to release funds", "success");
        break;
      }
      case "dispute": {
        if (session.id !== trade.buyer_id && session.id !== trade.vendor_id)
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!["shipped", "funds_held"].includes(trade.status))
          return NextResponse.json({ error: "Cannot dispute at this stage" }, { status: 400 });
        await updateTrade({ status: "disputed" });
        await addEvent("Dispute opened", `${session.name} raised a dispute. SafeTrade referee notified.`, "danger");
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}