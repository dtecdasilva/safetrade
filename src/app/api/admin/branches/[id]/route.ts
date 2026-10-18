import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { cleanBranch } from "@/lib/pickup/branches";

/** Admin: change a branch, or switch it off/on ({ active: false }). Transactions keep their own copy. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await getSession();
    if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const ref = (getDb() as any).collection("agency_branches").doc(params.id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (typeof body.active === "boolean" && Object.keys(body).length === 1) {
      await ref.update({ active: body.active });
      return NextResponse.json({ success: true });
    }
    const c = cleanBranch(body);
    if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
    await ref.update({ ...c.value, updated_at: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
