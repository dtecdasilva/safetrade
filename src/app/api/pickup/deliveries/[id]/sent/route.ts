import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markSent } from "@/lib/pickup/deliveries";

/** Out of town: the sender has sent the parcel through the agency to the rider. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { k, receipt, agency } = await req.json().catch(() => ({}));
  const db: any = getDb();
  const d = (await db.collection("deliveries").doc(params.id).get()).data();
  if (!d || d.kind !== "direct" || k !== d.manage_key) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (d.mode !== "out_of_town") return NextResponse.json({ error: "The rider collects this from you. Hand it over when they arrive." }, { status: 400 });
  if (d.status !== "assigned") return NextResponse.json({ error: d.status === "waiting_rider" ? "Wait until a rider is assigned: you need their name to write on the parcel." : "This parcel has already been sent" }, { status: 400 });
  const r = String(receipt || "").trim().slice(0, 60);
  const ag = String(agency || "").trim();
  if (!d.branch && !d.origin?.agency && ag.length < 2) return NextResponse.json({ error: "Enter the name of the agency you sent it with" }, { status: 400 });
  if (r.length < 3) return NextResponse.json({ error: "Enter the receipt number the agency gave you" }, { status: 400 });
  await markSent(db, params.id, r, ag);
  return NextResponse.json({ success: true });
}
