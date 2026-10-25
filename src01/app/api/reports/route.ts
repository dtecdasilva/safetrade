import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { REPORT_MAX, REPORT_MIN, REPORT_REASONS, canReportSeller, reportId, reportReasonLabel } from "@/lib/reports";
import { notifySellerReported } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** The buyer of a transaction reports its seller. Works at any stage, including after completion. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const { tradeId, reason, details } = await req.json().catch(() => ({}));
    if (!tradeId || typeof tradeId !== "string")
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const db = getDb();
    const tradeDoc = await db.collection("trades").doc(tradeId).get();
    if (!tradeDoc.exists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    const trade = tradeDoc.data()!;

    if (trade.buyer_id !== session.id)
      return NextResponse.json({ error: "Only the buyer on this transaction can report the seller" }, { status: 403 });
    if (!canReportSeller(trade))
      return NextResponse.json({ error: "The seller hasn't joined Zola yet, so there is no one to report" }, { status: 400 });
    if (!REPORT_REASONS.some((r) => r.key === reason))
      return NextResponse.json({ error: "Choose what went wrong" }, { status: 400 });

    const text = String(details || "").replace(/\s+/g, " ").trim().slice(0, REPORT_MAX);
    if (text.length < REPORT_MIN)
      return NextResponse.json({ error: "Tell us what happened, in a sentence or two" }, { status: 400 });

    const id  = reportId(tradeId, session.id);
    const ref = db.collection("reports").doc(id);
    if ((await ref.get()).exists)
      return NextResponse.json({ error: "You've already reported this seller for this transaction. Zola is looking into it." }, { status: 409 });

    const now = new Date().toISOString();
    const report = {
      id,
      trade_id: tradeId,
      trade_title: trade.title,
      trade_status: trade.status,
      reporter_id: session.id,
      reporter_name: session.name,
      vendor_id: trade.vendor_id,
      vendor_name: trade.vendor_name,
      reason,
      details: text,
      status: "open",
      created_at: now,
    };
    await ref.set(report);

    await notifySellerReported({ ...report, reason_label: reportReasonLabel(reason) });

    return NextResponse.json({ success: true, report: { reason, created_at: now, status: "open" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Admin: every report, newest first, with each seller's flag and report count. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });

    const db = getDb();
    const snap = await db.collection("reports").get();
    const reports = snap.docs.map((d: any) => d.data()).sort((a: any, b: any) => (b.created_at > a.created_at ? 1 : -1));

    const sellerIds = Array.from(new Set(reports.map((r: any) => r.vendor_id))) as string[];
    const sellers: Record<string, { flagged: boolean; flag_note?: string; reports: number; open: number }> = {};
    await Promise.all(sellerIds.map(async (id) => {
      const u = (await db.collection("users").doc(id).get()).data() || {};
      const mine = reports.filter((r: any) => r.vendor_id === id);
      sellers[id] = {
        flagged: !!u.flagged,
        flag_note: u.flag_note || "",
        reports: mine.length,
        open: mine.filter((r: any) => r.status === "open").length,
      };
    }));

    return NextResponse.json({ reports, sellers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
