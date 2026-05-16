import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyVendorWithdrawalSent } from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = getDb();
    const doc = await db.collection("withdrawals").doc(params.id).get();
    if (!doc.exists) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });

    const w = doc.data()!;
    if (w.status !== "pending")
      return NextResponse.json({ error: "Already processed" }, { status: 400 });

    await db.collection("withdrawals").doc(params.id).update({
      status:     "sent",
      updated_at: new Date().toISOString(),
      sent_by:    session.name,
    });

    // Get vendor phone and notify
    const vendorDoc = await db.collection("users").doc(w.vendor_id).get();
    const vendor    = vendorDoc.data();
    if (vendor?.phone) {
      notifyVendorWithdrawalSent({
        vendorPhone: vendor.phone,
        vendorName:  w.vendor_name,
        amount:      w.amount,
        network:     w.network,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
