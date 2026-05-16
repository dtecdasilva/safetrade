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
    if (Number(amount) < 500)
      return NextResponse.json({ error: "Minimum withdrawal is FCFA 500" }, { status: 400 });

    const db = getDb();

    // Check for pending in memory — no compound query needed
    const existingSnap = await db.collection("withdrawals")
      .where("vendor_id", "==", session.id)
      .get();
    const hasPending = existingSnap.docs.some(d => d.data().status === "pending");
    if (hasPending)
      return NextResponse.json({ error: "You already have a pending withdrawal request" }, { status: 400 });

    const id  = randomUUID();
    const now = new Date().toISOString();

    await db.collection("withdrawals").doc(id).set({
      id,
      vendor_id:    session.id,
      vendor_name:  session.name,
      vendor_email: session.email,
      amount:       Number(amount),
      phone:        phone.trim(),
      network:      network.trim(),
      status:       "pending",
      created_at:   now,
      updated_at:   now,
    });

    // Notify admin on WhatsApp
    notifyAdminWithdrawalRequested({
      vendorName: session.name,
      amount: Number(amount),
      phone: phone.trim(),
      network: network.trim(),
    }).catch(console.error);

    return NextResponse.json({ success: true, withdrawalId: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
