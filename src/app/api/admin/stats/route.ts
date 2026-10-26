import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Admin: what Zola is earning, for the Earnings tab.
 *
 * Earnings are counted on the day the money came in:
 *   Zola fee        the fee on each paid transaction (not cancelled or refunded)
 *   Pickup margin   delivery fee minus what the rider earns, on every paid
 *                   Pickup delivery (Zola orders and bookings made on Pickup)
 * "Secured" means it can no longer be undone: the transaction is completed or
 * the parcel delivered. Everything else is "pending".
 * Old flat FCFA 1,000 deliveries (before Pickup) are shown apart: what they
 * cost you isn't recorded, so they are left out of the earnings total.
 * Mobile money charges (Fapshi) are not taken off.
 */
const DAY = 86400000;
const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
const UNPAID = ["awaiting_seller", "pending_payment", "cancelled", "refunded"];

type Bucket = "day" | "week" | "month";
const n = (v: any) => Number(v) || 0;
const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);

function bucketStart(t: number, b: Bucket): number {
  // Cameroon is UTC+1 all year: days start at local midnight
  const local = new Date(t + 3600000);
  if (b === "month") return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 3600000;
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 3600000;
  if (b === "week") return day - ((local.getUTCDay() + 6) % 7) * DAY; // Monday
  return day;
}
function nextBucket(t: number, b: Bucket): number {
  if (b === "day") return t + DAY;
  if (b === "week") return t + 7 * DAY;
  const local = new Date(t + 3600000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - 3600000;
}

interface Item { at: number; zola: number; pickup: number; gmv: number; secured: boolean; kind: "trade" | "delivery" | "flat"; flat: number; vendor?: string; vendorId?: string; city?: string; riderPay: number; deliveryFee: number }

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const db: any = getDb();
  const range = req.nextUrl.searchParams.get("range") || "30d";

  const [tSnap, dSnap, uSnap, rSnap, wSnap, rwSnap] = await Promise.all([
    db.collection("trades").get(), db.collection("deliveries").get(), db.collection("users").get(),
    db.collection("riders").get(), db.collection("withdrawals").get(), db.collection("rider_withdrawals").get(),
  ]);
  const trades = tSnap.docs.map((x: any) => x.data());
  const deliveries = dSnap.docs.map((x: any) => x.data());
  const users = uSnap.docs.map((x: any) => x.data());
  const riders = rSnap.docs.map((x: any) => x.data());
  const withdrawals = wSnap.docs.map((x: any) => x.data());
  const riderW = rwSnap.docs.map((x: any) => x.data());

  // Every amount earned, dated
  const items: Item[] = [];
  const pickupTradeIds = new Set(deliveries.filter((d: any) => d.trade_id).map((d: any) => d.trade_id));
  const tradeById = new Map(trades.map((t: any) => [t.id, t]));
  for (const t of trades) {
    if (UNPAID.includes(t.status)) continue;
    const at = ms(t.paid_at || t.created_at);
    if (!Number.isFinite(at)) continue;
    const flat = !pickupTradeIds.has(t.id) && n(t.delivery_fee) > 0 ? n(t.delivery_fee) : 0;
    items.push({ at, zola: n(t.fee), pickup: 0, gmv: n(t.amount), secured: t.status === "complete", kind: "trade", flat,
      vendor: t.vendor_name, vendorId: t.vendor_id, riderPay: 0, deliveryFee: 0 });
  }
  for (const d of deliveries) {
    if (d.status === "awaiting_payment" || d.status === "cancelled") continue;
    const trade: any = d.trade_id ? tradeById.get(d.trade_id) : null;
    if (trade && ["cancelled", "refunded"].includes(trade.status)) continue;
    const at = ms(d.paid_at || trade?.paid_at || d.created_at);
    if (!Number.isFinite(at)) continue;
    const fee = n(d.fee ?? trade?.delivery_fee);
    const pay = n(d.rider_pay);
    items.push({ at, zola: 0, pickup: fee - pay, gmv: 0, secured: d.status === "delivered", kind: "delivery", flat: 0,
      city: d.city || d.origin?.city, riderPay: pay, deliveryFee: fee });
  }

  const now = Date.now();
  const first = items.length ? Math.min(...items.map((i) => i.at)) : now;
  const days = RANGES[range] || Math.max(1, Math.ceil((now - first) / DAY) + 1);
  const from = range === "all" ? bucketStart(first, "day") : now - days * DAY;
  const prevFrom = from - (now - from);
  const bucket: Bucket = days <= 31 ? "day" : days <= 120 ? "week" : "month";

  const sum = (list: Item[]) => {
    const zola = list.reduce((a, i) => a + i.zola, 0);
    const pickup = list.reduce((a, i) => a + i.pickup, 0);
    const paidTrades = list.filter((i) => i.kind === "trade");
    const dels = list.filter((i) => i.kind === "delivery");
    return {
      net: zola + pickup, zola_fees: zola, pickup_margin: pickup,
      secured: list.filter((i) => i.secured).reduce((a, i) => a + i.zola + i.pickup, 0),
      pending: list.filter((i) => !i.secured).reduce((a, i) => a + i.zola + i.pickup, 0),
      gmv: paidTrades.reduce((a, i) => a + i.gmv, 0),
      paid_trades: paidTrades.length,
      avg_fee: paidTrades.length ? Math.round(zola / paidTrades.length) : 0,
      deliveries: dels.length,
      delivery_fees: dels.reduce((a, i) => a + i.deliveryFee, 0),
      rider_pay: dels.reduce((a, i) => a + i.riderPay, 0),
      flat_delivery: paidTrades.reduce((a, i) => a + i.flat, 0),
    };
  };
  const cur = items.filter((i) => i.at >= from && i.at <= now);
  const prev = range === "all" ? [] : items.filter((i) => i.at >= prevFrom && i.at < from);

  // Earnings over time
  const series: { start: string; zola: number; pickup: number }[] = [];
  for (let b = bucketStart(from, bucket); b <= now; b = nextBucket(b, bucket)) {
    const e = nextBucket(b, bucket);
    const inB = cur.filter((i) => i.at >= b && i.at < e);
    series.push({ start: new Date(b).toISOString(), zola: inB.reduce((a, i) => a + i.zola, 0), pickup: inB.reduce((a, i) => a + i.pickup, 0) });
  }

  // Who and where it comes from
  const bySeller = new Map<string, { name: string; fees: number; count: number; gmv: number }>();
  for (const i of cur.filter((x) => x.kind === "trade")) {
    const k = i.vendorId || i.vendor || "?";
    const v = bySeller.get(k) || { name: i.vendor || "Unknown", fees: 0, count: 0, gmv: 0 };
    v.fees += i.zola; v.count++; v.gmv += i.gmv; bySeller.set(k, v);
  }
  const byCity = new Map<string, { city: string; count: number; margin: number }>();
  for (const i of cur.filter((x) => x.kind === "delivery")) {
    const k = i.city || "Unknown";
    const v = byCity.get(k) || { city: k, count: 0, margin: 0 };
    v.count++; v.margin += i.pickup; byCity.set(k, v);
  }

  const inRange = (iso?: string) => { const t = ms(iso); return Number.isFinite(t) && t >= from && t <= now; };
  const created = trades.filter((t: any) => inRange(t.created_at));
  return NextResponse.json({
    range, bucket, from: new Date(from).toISOString(), to: new Date(now).toISOString(),
    current: sum(cur), previous: range === "all" ? null : sum(prev),
    series,
    top_sellers: Array.from(bySeller.values()).sort((a, b) => b.fees - a.fees).slice(0, 5),
    cities: Array.from(byCity.values()).sort((a, b) => b.margin - a.margin).slice(0, 5),
    funnel: {
      created: created.length,
      paid: created.filter((t: any) => !UNPAID.includes(t.status)).length,
      completed: created.filter((t: any) => t.status === "complete").length,
      cancelled: created.filter((t: any) => t.status === "cancelled").length,
      disputed: created.filter((t: any) => t.status === "disputed").length,
    },
    // Money Zola holds that is NOT earnings
    held: {
      escrow: trades.filter((t: any) => !UNPAID.includes(t.status) && t.status !== "complete").reduce((a: number, t: any) => a + n(t.amount), 0),
      rider_balances: riders.reduce((a: number, r: any) => a + n(r.balance), 0),
      seller_withdrawals: withdrawals.filter((w: any) => w.status === "pending").reduce((a: number, w: any) => a + n(w.amount), 0),
      rider_withdrawals: riderW.filter((w: any) => w.status === "pending").reduce((a: number, w: any) => a + n(w.amount), 0),
    },
    people: {
      users: users.filter((u: any) => u.role !== "admin").length,
      new_users: users.filter((u: any) => u.role !== "admin" && inRange(u.created_at)).length,
      riders: riders.filter((r: any) => r.status === "approved").length,
      riders_on: riders.filter((r: any) => r.status === "approved" && r.available).length,
    },
  });
}
