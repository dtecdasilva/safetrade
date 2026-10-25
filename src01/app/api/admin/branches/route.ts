import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { cleanBranch } from "@/lib/pickup/branches";

export const dynamic = "force-dynamic";

async function admin() { const s = await getSession(); return s?.role === "admin" ? s : null; }

/** Admin: every bus agency branch, including switched-off ones. */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
  const snap = await (getDb() as any).collection("agency_branches").get();
  const branches = snap.docs.map((d: any) => d.data()).sort((a: any, b: any) => (a.city + a.agency + a.name).localeCompare(b.city + b.agency + b.name));
  return NextResponse.json({ branches });
}

/** Admin: add a branch. */
export async function POST(req: NextRequest) {
  try {
    if (!(await admin())) return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const c = cleanBranch(await req.json().catch(() => ({})));
    if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
    const id = randomUUID();
    await (getDb() as any).collection("agency_branches").doc(id).set({ id, ...c.value, active: true, created_at: new Date().toISOString() });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
