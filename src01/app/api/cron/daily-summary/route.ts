import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { adminEmails } from "@/lib/notifications";
import { buildDailySummary } from "@/lib/summary";

export const dynamic = "force-dynamic";

/**
 * The admin's morning email.
 *
 * Vercel calls this every day (see vercel.json) and sends the header
 * "Authorization: Bearer <CRON_SECRET>". Nobody else can trigger a send.
 *
 * Signed in as admin, you can also open:
 *   /api/cron/daily-summary?preview=1   see today's summary in the browser
 *   /api/cron/daily-summary?send=1      send it to the admin inbox now
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const fromCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
    const url = new URL(req.url);

    let fromAdmin = false;
    if (!fromCron) {
      const session = await getSession();
      fromAdmin = session?.role === "admin";
    }
    if (!fromCron && !fromAdmin)
      return NextResponse.json({ error: "You don't have access to this" }, { status: 401 });

    await initDb();
    const summary = await buildDailySummary(getDb());

    if (fromAdmin && url.searchParams.get("preview")) {
      return new NextResponse(summary.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (fromAdmin && !url.searchParams.get("send")) {
      return NextResponse.json({ subject: summary.subject, waiting: summary.waiting, text: summary.text });
    }

    const to = await adminEmails();
    if (!to.length)
      return NextResponse.json({ error: "No admin email to send to. Set ADMIN_EMAIL in Vercel." }, { status: 400 });

    const results = await Promise.all(
      to.map((addr) => sendEmail({ to: addr, subject: summary.subject, text: summary.text, html: summary.html }))
    );
    const sent = results.filter((r) => r.success).length;
    console.log(`[daily-summary] sent to ${sent} of ${to.length}; ${summary.waiting} waiting`);
    return NextResponse.json({ sent, waiting: summary.waiting, errors: results.filter((r) => !r.success).map((r) => r.error) });
  } catch (e: any) {
    console.error("[daily-summary] failed:", e?.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
