import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendToMobileMoney } from "@/lib/tranzak";
import { notifyVendorWithdrawalSent } from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db  = getDb();
    const doc = await db.collection("withdrawals").doc(params.id).get();
    if (!doc.exists) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });

    const w = doc.data()!;
    if (w.status !== "pending")
      return NextResponse.json({ error: "Already processed" }, { status: 400 });

    const phone = `237${w.phone}`;

    const result = await sendToMobileMoney({
      ref:         params.id,
      amount:      w.amount,
      phone,
      description: `SafeTrade withdrawal for ${w.vendor_name}`,
    });

    if (!result.success) {
      console.error("[withdrawal-sent] Tranzak payout failed:", result.error);
      return NextResponse.json({ error: `Payout failed: ${result.error}` }, { status: 500 });
    }

    // Mark as sent
    await db.collection("withdrawals").doc(params.id).update({
      status:          "sent",
      updated_at:      new Date().toISOString(),
      sent_by:         session.name,
      tranzak_ref:     result.tx?.data?.requestId || params.id,
    });

    // Notify vendor on WhatsApp
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
