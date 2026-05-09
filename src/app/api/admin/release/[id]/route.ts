// ─── api/admin/release/[id]/route.ts ───────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.status !== "pending_release")
      return NextResponse.json({ error: "Trade is not pending release" }, { status: 400 });

    await db.collection("trades").doc(params.id).update({
      status: "complete",
      updated_at: new Date().toISOString(),
    });

    const eventId = randomUUID();
    await db.collection("trade_events").doc(eventId).set({
      id: eventId,
      trade_id: params.id,
      label: "Funds released",
      detail: `FCFA ${trade.amount.toLocaleString()} released to vendor by admin`,
      type: "success",
      created_at: new Date().toISOString(),
    });

    // Increment vendor trade_count
    const vendorRef = db.collection("users").doc(trade.vendor_id);
    const vendorDoc = await vendorRef.get();
    if (vendorDoc.exists) {
      const v = vendorDoc.data()!;
      await vendorRef.update({ trade_count: (v.trade_count || 0) + 1 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


// ─── api/admin/users/route.ts ───────────────────────────────────────────────
// (place this content in a separate file)
/*
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const snap = await db.collection("users").orderBy("created_at", "desc").get();
  const users = snap.docs.map(d => {
    const u = d.data();
    const { password, ...safe } = u; // never expose hash
    return safe;
  });
  return NextResponse.json({ users });
}
*/