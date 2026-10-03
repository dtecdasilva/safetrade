import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendToMobileMoney } from "@/lib/fapshi";
import { notifyVendorWithdrawalSent } from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    const db  = getDb();
    const doc = await db.collection("withdrawals").doc(params.id).get();
    if (!doc.exists) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });

    const w = doc.data()!;
    if (w.status !== "pending")
      return NextResponse.json({ error: "This withdrawal has already been processed" }, { status: 400 });

    // Fapshi wants the local 9-digit number, no 237 country-code prefix
    const phone = String(w.phone).replace(/^237/, "");

    const result = await sendToMobileMoney({
      ref:         params.id,
      amount:      w.amount,
      phone,
      network:     w.network === "orange" ? "orange" : "mtn",
      description: `Zola withdrawal for ${w.vendor_name}`,
    });

    if (!result.success) {
      console.error("[withdrawal-sent] Fapshi payout failed:", result.error);
      return NextResponse.json({ error: `Payout failed: ${result.error}` }, { status: 500 });
    }

    // Mark as sent
    await db.collection("withdrawals").doc(params.id).update({
      status:      "sent",
      updated_at:  new Date().toISOString(),
      sent_by:     session.name,
      fapshi_ref:  result.transId || params.id,
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
