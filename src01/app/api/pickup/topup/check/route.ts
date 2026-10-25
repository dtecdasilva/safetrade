import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRider, SIGNED_OUT } from "@/lib/pickup/auth";
import { confirmTopup } from "@/lib/pickup/topups";

/** Ask Fapshi whether a top-up went through. */
export async function POST(req: NextRequest) {
  try {
    const rider = await getRider();
    if (!rider) return NextResponse.json(SIGNED_OUT, { status: 401 });
    const { id } = await req.json().catch(() => ({}));
    const t = id ? (await (getDb() as any).collection("rider_topups").doc(String(id)).get()).data() : null;
    if (!t || t.rider_id !== rider.id) return NextResponse.json({ error: "Top-up not found" }, { status: 404 });
    const r = await confirmTopup(String(id));
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
