/**
 * The admin's morning email: everything waiting on the admin, and what
 * happened in the last 24 hours. The app never reminds anyone otherwise,
 * so this is what keeps money from sitting forgotten.
 *
 * Sent by /api/cron/daily-summary (scheduled in vercel.json).
 */
import { emailLayout } from "@/lib/mail";
import { reviewState } from "@/lib/review";
import { siteUrl } from "@/lib/support";
import { originOf } from "@/lib/pickup/config";

const fcfa = (n: unknown) => `FCFA ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Douala", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const isGoods = (t: any) => (t.needs_delivery !== undefined ? t.needs_delivery !== false : Number(t.delivery_fee) > 0);

export interface DailySummary {
  subject: string;
  text: string;
  html: string;
  waiting: number;
}

export async function buildDailySummary(db: any, now: number = Date.now()): Promise<DailySummary> {
  const [tradesSnap, wSnap, usersSnap, reportsSnap, waitSnap, ridersSnap, rwSnap] = await Promise.all([
    db.collection("trades").get(),
    db.collection("withdrawals").where("status", "==", "pending").get(),
    db.collection("users").get(),
    db.collection("reports").where("status", "==", "open").get(),
    db.collection("deliveries").where("status", "==", "waiting_rider").get(),
    db.collection("riders").where("status", "==", "pending").get(),
    db.collection("rider_withdrawals").where("status", "==", "pending").get(),
  ]);
  const noRider: any[] = waitSnap.docs.map((d: any) => d.data());
  const newRiders: any[] = ridersSnap.docs.map((d: any) => d.data());
  const riderW: any[] = rwSnap.docs.map((d: any) => d.data());
  const reports: any[] = reportsSnap.docs.map((d: any) => d.data());
  const trades: any[] = tradesSnap.docs.map((d: any) => d.data());
  const withdrawals: any[] = wSnap.docs.map((d: any) => d.data());
  const users: any[] = usersSnap.docs.map((d: any) => d.data());
  const base = siteUrl();
  const link = (t: any) => `${base}/trade/${t.id}`;
  const since = now - 24 * 3600e3;
  const inLastDay = (iso?: string) => !!iso && Date.parse(iso) >= since && Date.parse(iso) <= now;

  const review = trades.filter((t) => t.status === "pending_release").map((t) => ({ t, r: reviewState(t, now) }));
  const complaints = review.filter((x) => x.r.complaintOpen);
  const toCall     = review.filter((x) => !x.r.complaintOpen && !x.r.contacted && !!x.r.endsAt);
  const toRelease  = review.filter((x) => x.r.canRelease);
  const disputes   = trades.filter((t) => t.status === "disputed");
  const toDeliver  = trades.filter((t) => t.status === "shipped" && isGoods(t) && !t.dest_branch && !t.origin); // Pickup riders handle the rest
  const stuck      = trades.filter((t) => {
    if (t.status !== "pending_payment" || !t.payment_started_at) return false;
    const age = now - Date.parse(t.payment_started_at);
    return age > 30 * 60e3 && age < 7 * 24 * 3600e3;
  });

  const sections = [
    { title: `Complaints to settle (${complaints.length})`,
      items: complaints.map(({ t }) => ({ url: link(t), text: `${t.title}: ${t.buyer_name} complained${t.complaint_text ? ` (“${String(t.complaint_text).slice(0, 90)}”)` : ""}. ${fcfa(t.amount)} on hold.` })) },
    { title: `Buyers to call or text (${toCall.length})`,
      items: toCall.map(({ t, r }) => ({ url: link(t), text: `${t.title}: call ${t.buyer_name}${t.buyer_phone ? ` on +237 ${t.buyer_phone}` : ""}. Review ends ${when(r.endsAt)}.` })) },
    { title: `Payments ready to release (${toRelease.length})`,
      items: toRelease.map(({ t }) => ({ url: link(t), text: `${t.title}: release ${fcfa(t.amount)} to ${t.vendor_name}.` })) },
    { title: `Seller reports to review (${reports.length})`,
      items: reports.map((r) => ({ url: `${base}/admin?tab=reports`, text: `${r.vendor_name}, reported by ${r.reporter_name} on “${r.trade_title}”: ${String(r.details || "").slice(0, 90)}` })) },
    { title: `Parcels with no rider yet (${noRider.length})`,
      items: noRider.map((d) => ({ url: d.trade_id ? link({ id: d.trade_id }) : `${base}/admin?tab=deliveries`, text: `${d.title}: no free rider in ${originOf(d)?.city || d.city} can carry ${fcfa(d.amount)}. Assign one, or ask a rider to top up.` })) },
    { title: `Riders to approve (${newRiders.length})`,
      items: newRiders.map((r) => ({ url: `${base}/admin?tab=riders`, text: `${r.name}, ${r.city}, +237 ${r.phone}: check their ID, then approve.` })) },
    { title: `Rider withdrawals to send (${riderW.length})`,
      items: riderW.map((w) => ({ url: `${base}/admin?tab=riders`, text: `${w.rider_name}: ${fcfa(w.amount)} to +237 ${w.phone}.` })) },
    { title: `Withdrawals to send (${withdrawals.length})`,
      items: withdrawals.map((w) => ({ url: `${base}/admin`, text: `${w.vendor_name}: ${fcfa(w.amount)} to ${w.network}, +237 ${w.phone}. Asked ${when(w.created_at)}.` })) },
    { title: `Items with Zola to deliver (${toDeliver.length})`,
      items: toDeliver.map((t) => ({ url: link(t), text: `${t.title}: deliver to ${t.buyer_name}${t.buyer_phone ? `, +237 ${t.buyer_phone}` : ""}.` })) },
    { title: `Disputes open (${disputes.length})`,
      items: disputes.map((t) => ({ url: link(t), text: `${t.title}: ${t.buyer_name} and ${t.vendor_name}, ${fcfa(t.amount)} held.` })) },
    { title: `Payments that may be stuck (${stuck.length})`,
      items: stuck.map((t) => ({ url: link(t), text: `${t.title}: ${t.buyer_name} started paying ${when(t.payment_started_at)} and it still says Payment pending. Open it and press Check payment.` })) },
  ];
  const waiting = complaints.length + toCall.length + toRelease.length + reports.length + noRider.length + newRiders.length + riderW.length + withdrawals.length + toDeliver.length + disputes.length + stuck.length;
  const needs = sections.filter((s) => s.items.length);

  // The last 24 hours
  const created  = trades.filter((t) => inLastDay(t.created_at));
  const paid     = trades.filter((t) => inLastDay(t.paid_at));
  const released = trades.filter((t) => inLastDay(t.released_at));
  const joined   = users.filter((u) => u.role !== "admin" && inLastDay(u.created_at));
  const heldNow  = trades
    .filter((t) => ["funds_held", "shipped", "pending_release", "disputed"].includes(t.status))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const day = [
    `${created.length} new transaction${created.length === 1 ? "" : "s"}`,
    `${paid.length} paid (${fcfa(paid.reduce((s, t) => s + (Number(t.buyer_total) || Number(t.amount) || 0), 0))})`,
    `${released.length} released to sellers (${fcfa(released.reduce((s, t) => s + (Number(t.amount) || 0), 0))})`,
    `${joined.length} new account${joined.length === 1 ? "" : "s"}`,
  ];

  const date = new Date(now).toLocaleDateString("en-GB", { timeZone: "Africa/Douala", weekday: "long", day: "numeric", month: "long" });
  const subject = waiting
    ? `Zola daily summary: ${waiting} thing${waiting === 1 ? "" : "s"} waiting on you`
    : "Zola daily summary: nothing waiting on you";
  const intro = waiting
    ? `${date}. ${waiting} thing${waiting === 1 ? " needs" : "s need"} you today. Zola is holding ${fcfa(heldNow)} in total.`
    : `${date}. Nothing is waiting on you today. Zola is holding ${fcfa(heldNow)} in total.`;

  const html = emailLayout({
    heading: waiting ? "Waiting on you today" : "All clear today",
    intro,
    sections: [
      ...needs,
      { title: "The last 24 hours", items: day.map((text) => ({ text })) },
    ],
    cta: { label: "Open admin", url: `${base}/admin` },
  });

  const text = [
    intro, "",
    ...needs.flatMap((s) => [s.title, ...s.items.map((i) => `- ${i.text}${i.url ? ` ${i.url}` : ""}`), ""]),
    "The last 24 hours", ...day.map((d) => `- ${d}`), "",
    `Open admin: ${base}/admin`,
  ].join("\n");

  return { subject, text, html, waiting };
}
