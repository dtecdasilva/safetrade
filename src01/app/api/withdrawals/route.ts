import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyAdminWithdrawalRequested } from "@/lib/whatsapp";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    let snap;
    if (session.role === "admin") {
      snap = await db.collection("withdrawals").get();
    } else {
      snap = await db.collection("withdrawals").where("vendor_id", "==", session.id).get();
    }

    const withdrawals = snap.docs
      .map(d => d.data())
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

    return NextResponse.json({ withdrawals });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "vendor")
      return NextResponse.json({ error: "Only vendors can withdraw" }, { status: 403 });

    const { amount, phone, network } = await req.json();
    if (!amount || !phone || !network)
      return NextResponse.json({ error: "Amount, phone and network are required" }, { status: 400 });

    const requestedAmount = Number(amount);
    if (requestedAmount < 1)
      return NextResponse.json({ error: "Minimum withdrawal is FCFA 1" }, { status: 400 });

    const db = getDb();

    // Calculate available balance
    const [tradesSnap, wSnap] = await Promise.all([
      db.collection("trades").where("vendor_id", "==", session.id).where("status", "==", "complete").get(),
      db.collection("withdrawals").where("vendor_id", "==", session.id).get(),
    ]);

    const totalEarned = tradesSnap.docs.reduce((s, d) => s + Number(d.data().amount), 0);
    const wDocs = wSnap.docs.map(d => d.data());
    const totalWithdrawn = wDocs
      .filter(w => w.status === "sent")
      .reduce((s, w) => s + Number(w.amount), 0);
    const available = Math.max(0, totalEarned - totalWithdrawn);

    if (available <= 0)
      return NextResponse.json({ error: "You have no available balance to withdraw" }, { status: 400 });
    if (requestedAmount > available)
      return NextResponse.json({ error: `You can only withdraw up to FCFA ${available.toLocaleString()}` }, { status: 400 });

    // Check for existing pending withdrawal
    const hasPending = wDocs.some(w => w.status === "pending");
    if (hasPending)
      return NextResponse.json({ error: "You already have a pending withdrawal request" }, { status: 400 });

    const id  = randomUUID();
    const now = new Date().toISOString();

    await db.collection("withdrawals").doc(id).set({
      id,
      vendor_id:    session.id,
      vendor_name:  session.name,
      vendor_email: session.email,
      amount:       requestedAmount,
      phone:        phone.trim(),
      network:      network.trim(),
      status:       "pending",
      created_at:   now,
      updated_at:   now,
    });

    // Notify admin
    notifyAdminWithdrawalRequested({
      vendorName: session.name,
      amount:     requestedAmount,
      phone:      phone.trim(),
      network:    network.trim(),
    }).catch(console.error);

    return NextResponse.json({ success: true, withdrawalId: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
