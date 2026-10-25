import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * What an invited buyer (or seller) sees before they have an account: who invited them,
 * for what, and how much. Open to anyone holding the invitation link (the
 * transaction ID is long and unguessable), and only while the buyer has not
 * signed up yet.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!/^[\w-]{8,64}$/.test(params.id))
      return NextResponse.json({ error: "This invitation link isn't valid" }, { status: 404 });

    const doc = await getDb().collection("trades").doc(params.id).get();
    if (!doc.exists)
      return NextResponse.json({ error: "This invitation is no longer available. The seller may have removed the transaction." }, { status: 404 });

    const t = doc.data()!;

    // A buyer started this and invited a seller who has no account yet
    if (t.vendor_pending && t.status === "awaiting_seller") {
      return NextResponse.json({
        claimed: false,
        side: "seller",
        title: t.title,
        buyerName: t.buyer_name || "The buyer",
        amount: t.amount,
        phone: t.vendor_phone || "",
        email: t.vendor_invite_email || "",
      });
    }

    if (!t.buyer_pending || t.status !== "pending_payment")
      return NextResponse.json({ claimed: true });

    return NextResponse.json({
      claimed: false,
      side: "buyer",
      title: t.title,
      sellerName: t.vendor_name || "The seller",
      amount: t.amount,
      fee: t.fee,
      deliveryFee: Number(t.delivery_fee) || 0,
      total: t.buyer_total || t.amount,
      phone: t.buyer_phone || "",
      email: t.buyer_invite_email || "",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
