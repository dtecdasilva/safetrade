import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createDirect, readBooking } from "@/lib/pickup/direct";
import { getLang } from "@/lib/i18n/server";

/** Anyone books a delivery on Pickup. They pay on the next page. */
export async function POST(req: NextRequest) {
  try {
    const db: any = getDb();
    const body = await req.json().catch(() => ({}));
    const r = await readBooking(db, body);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    const d = await createDirect(db, r.value, { by: "public", lang: body.lang || getLang() });
    return NextResponse.json({ success: true, id: d.id, key: d.manage_key, fee: d.fee, km: d.km });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
