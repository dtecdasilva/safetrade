import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();

    // Step 1: fetch the trade document
    let tradeDoc;
    try {
      tradeDoc = await db.collection("trades").doc(params.id).get();
    } catch (e: any) {
      console.error("[trade GET] failed to fetch trade doc:", e.message);
      return NextResponse.json({ error: "Failed to fetch trade", detail: e.message }, { status: 500 });
    }

    if (!tradeDoc.exists) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const trade = tradeDoc.data()!;

    if (
      session.role !== "admin" &&
      trade.buyer_id !== session.id &&
      trade.vendor_id !== session.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Step 2: fetch trade events — single field where, no composite index needed
    let events: any[] = [];
    try {
      const eventsSnap = await db
        .collection("trade_events")
        .where("trade_id", "==", params.id)
        .get();

      events = eventsSnap.docs
        .map(d => d.data())
        .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    } catch (e: any) {
      // Events failing should not block the trade from loading
      console.error("[trade GET] failed to fetch events:", e.message);
      events = [];
    }

    return NextResponse.json({ trade, events });
  } catch (e: any) {
    console.error("[trade GET] unexpected error:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — edit trade (vendor only, pending_payment only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.vendor_id !== session.id)
      return NextResponse.json({ error: "Only the vendor can edit this trade" }, { status: 403 });
    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: "Trade can only be edited before the buyer pays" }, { status: 400 });

    const { title, description, amount, deliveryDays } = await req.json();
    if (!title || !description || !amount)
      return NextResponse.json({ error: "Title, description and amount are required" }, { status: 400 });

    const fee = parseFloat((Number(amount) * 0.015).toFixed(2));

    await db.collection("trades").doc(params.id).update({
      title,
      description,
      amount: Number(amount),
      fee,
      delivery_days: deliveryDays || trade.delivery_days || 7,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — delete trade (vendor only, pending_payment only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.vendor_id !== session.id)
      return NextResponse.json({ error: "Only the vendor can delete this trade" }, { status: 403 });
    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: "Trade can only be deleted before the buyer pays" }, { status: 400 });

    // Delete trade and its events
    await db.collection("trades").doc(params.id).delete();

    const eventsSnap = await db.collection("trade_events")
      .where("trade_id", "==", params.id)
      .get();
    const batch = db.batch();
    eventsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
