import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "vendor")
      return NextResponse.json({ error: "Vendors only" }, { status: 403 });

    const db = getDb();

    // Total from completed trades
    const tradesSnap = await db.collection("trades")
      .where("vendor_id", "==", session.id)
      .where("status", "==", "complete")
      .get();
    const totalEarned = tradesSnap.docs.reduce((s, d) => s + Number(d.data().amount), 0);

    // Total already withdrawn (sent)
    const wSnap = await db.collection("withdrawals")
      .where("vendor_id", "==", session.id)
      .get();
    const totalWithdrawn = wSnap.docs
      .filter(d => d.data().status === "sent")
      .reduce((s, d) => s + Number(d.data().amount), 0);

    const available = Math.max(0, totalEarned - totalWithdrawn);

    return NextResponse.json({ available, totalEarned, totalWithdrawn });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
