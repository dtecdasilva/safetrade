import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { confirmDirectPayment } from "@/lib/pickup/direct";

/** Ask Fapshi whether the delivery fee went through. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { k } = await req.json().catch(() => ({}));
  const d = (await (getDb() as any).collection("deliveries").doc(params.id).get()).data();
  if (!d || d.kind !== "direct" || k !== d.manage_key) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  return NextResponse.json(await confirmDirectPayment(params.id));
}
