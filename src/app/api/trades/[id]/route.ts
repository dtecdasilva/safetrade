import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyTradeMove } from "@/lib/notifications";
import { quote } from "@/lib/fees";

/** Once the buyer has paid, the agreement is fixed for both sides. */
const PAID_LOCK = "The buyer has already paid, so this transaction can no longer be changed. If something needs fixing, contact Zola customer service.";
const PAYING_LOCK = "The buyer is paying for this right now, so it can't be changed. Try again in a few minutes.";
const PAYMENT_WINDOW_MINUTES = 10;

/** A payment prompt was sent to the buyer's phone in the last few minutes. */
function paymentInProgress(trade: any): boolean {
  const started = trade.payment_started_at ? Date.parse(trade.payment_started_at) : NaN;
  return !isNaN(started) && Date.now() - started < PAYMENT_WINDOW_MINUTES * 60000;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();

    // Step 1: fetch the trade document
    let tradeDoc;
    try {
      tradeDoc = await db.collection("trades").doc(params.id).get();
    } catch (e: any) {
      console.error("[trade GET] failed to fetch trade doc:", e.message);
      return NextResponse.json({ error: "We couldn't load this transaction", detail: e.message }, { status: 500 });
    }

    if (!tradeDoc.exists) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const trade = tradeDoc.data()!;

    if (
      session.role !== "admin" &&
      trade.buyer_id !== session.id &&
      trade.vendor_id !== session.id
    ) {
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
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

    // Step 3: admins get the buyer's and seller's contact details, so they can
    // call or text during a review, complaint or dispute
    let contacts: any = undefined;
    if (session.role === "admin") {
      try {
        const [buyerDoc, vendorDoc] = await Promise.all([
          db.collection("users").doc(trade.buyer_id).get(),
          db.collection("users").doc(trade.vendor_id).get(),
        ]);
        const b = buyerDoc.data()  || {};
        const v = vendorDoc.data() || {};
        contacts = {
          buyer:  { name: b.name || trade.buyer_name,  phone: b.phone || trade.buyer_phone || "", email: b.email || trade.buyer_email  || "" },
          seller: { name: v.name || trade.vendor_name, phone: v.phone || "",                      email: v.email || trade.vendor_email || "" },
        };
      } catch (e: any) {
        console.error("[trade GET] failed to fetch contacts:", e.message);
      }
    }

    return NextResponse.json({ trade, events, contacts });
  } catch (e: any) {
    console.error("[trade GET] unexpected error:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — edit trade (vendor only, pending_payment only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.vendor_id !== session.id)
      return NextResponse.json({ error: "Only the seller can edit this transaction" }, { status: 403 });
    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: PAID_LOCK }, { status: 400 });
    if (paymentInProgress(trade))
      return NextResponse.json({ error: PAYING_LOCK }, { status: 409 });

    const { title, description, amount, deliveryDays, needsDelivery } = await req.json();
    if (!title || !description || !amount)
      return NextResponse.json({ error: "Title, description and amount are required" }, { status: 400 });

    // Keep the current delivery choice unless the seller changes it.
    // Older transactions with no delivery fee stay without one.
    const hadDelivery  = trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0;
    const withDelivery = needsDelivery === undefined ? hadDelivery : needsDelivery !== false;
    const { fee, deliveryFee, total: buyerTotal } = quote(Number(amount), withDelivery);

    await db.collection("trades").doc(params.id).update({
      title,
      description,
      amount: Number(amount),
      fee,
      needs_delivery: withDelivery,
      delivery_fee: deliveryFee,
      buyer_total: buyerTotal,   // keep what the buyer is charged in step with the new price
      delivery_days: deliveryDays || trade.delivery_days || 7,
      updated_at: new Date().toISOString(),
    });

    await notifyTradeMove("edited", { ...(trade as any), id: params.id, title, amount: Number(amount), buyer_total: buyerTotal });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — delete trade (vendor only, pending_payment only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(params.id).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const trade = tradeDoc.data()!;
    if (trade.vendor_id !== session.id)
      return NextResponse.json({ error: "Only the seller can delete this transaction" }, { status: 403 });
    if (trade.status !== "pending_payment")
      return NextResponse.json({ error: PAID_LOCK.replace("changed", "deleted") }, { status: 400 });
    if (paymentInProgress(trade))
      return NextResponse.json({ error: PAYING_LOCK }, { status: 409 });

    // Delete trade and its events
    await db.collection("trades").doc(params.id).delete();

    const eventsSnap = await db.collection("trade_events")
      .where("trade_id", "==", params.id)
      .get();
    const batch = db.batch();
    eventsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    await notifyTradeMove("deleted", { ...(trade as any), id: params.id });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
