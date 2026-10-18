import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maxPackageValue } from "@/lib/pickup/config";

export const dynamic = "force-dynamic";

/** Admin: every rider, and rider withdrawals waiting to be sent. */
export async function GET() {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const db: any = getDb();
  const [rs, ws] = await Promise.all([db.collection("riders").get(), db.collection("rider_withdrawals").get()]);
  const riders = rs.docs.map((d: any) => { const { password, ...r } = d.data(); return { ...r, max_value: maxPackageValue(r.balance) }; })
    .sort((a: any, b: any) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || (b.created_at > a.created_at ? 1 : -1));
  const withdrawals = ws.docs.map((d: any) => d.data()).sort((a: any, b: any) => (b.created_at > a.created_at ? 1 : -1));
  return NextResponse.json({ riders, withdrawals });
}
