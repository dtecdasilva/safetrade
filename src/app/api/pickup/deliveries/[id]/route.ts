import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { directView } from "@/lib/pickup/direct";

export const dynamic = "force-dynamic";

/** The sender's private page: only with the key from their link. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const k = req.nextUrl.searchParams.get("k") || "";
  const d = (await (getDb() as any).collection("deliveries").doc(params.id).get()).data();
  if (!d || d.kind !== "direct" || !k || k !== d.manage_key) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  return NextResponse.json({ delivery: directView(d) });
}
