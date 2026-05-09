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