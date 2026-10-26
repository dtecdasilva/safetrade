import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { cleanEmail, cleanPhone, isEmail } from "@/lib/users";
import { isPoint } from "@/lib/pickup/config";
import { makeSetupLink } from "@/lib/pickup/setup";
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
  const riders = rs.docs.map((d: any) => { const { password, ...r } = d.data(); return { ...r, max_value: maxPackageValue(r.balance), no_limit: !!r.no_limit, needs_setup: !!r.setup_nonce }; })
    .sort((a: any, b: any) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || (b.created_at > a.created_at ? 1 : -1));
  const withdrawals = ws.docs.map((d: any) => d.data()).sort((a: any, b: any) => (b.created_at > a.created_at ? 1 : -1));
  return NextResponse.json({ riders, withdrawals });
}

/**
 * Admin: add a rider (for example your own staff). They are approved straight
 * away, and with "no limit" they can carry any parcel without a balance.
 * Returns a link the rider opens to set their password.
 */
export async function POST(req: NextRequest) {
  try {
    const s = await getSession();
    if (s?.role !== "admin") return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    const db: any = getDb();
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || "").trim().slice(0, 80);
    const phone = cleanPhone(b.phone);
    const email = cleanEmail(b.email);
    const city = String(b.city || "").trim().slice(0, 60);
    if (name.length < 2) return NextResponse.json({ error: "Enter the rider's full name" }, { status: 400 });
    if (phone.length < 9) return NextResponse.json({ error: "Enter all 9 digits of the rider's number" }, { status: 400 });
    if (email && !isEmail(email)) return NextResponse.json({ error: "Enter a valid email address, or leave it empty" }, { status: 400 });
    if (!city) return NextResponse.json({ error: "Choose the city where they deliver" }, { status: 400 });
    if (!(await db.collection("riders").where("phone", "==", phone).limit(1).get()).empty)
      return NextResponse.json({ error: "A rider already uses this number" }, { status: 409 });
    if (email && !(await db.collection("riders").where("email", "==", email).limit(1).get()).empty)
      return NextResponse.json({ error: "A rider already uses this email" }, { status: 409 });
    const base = { lat: Number(b.baseLat), lng: Number(b.baseLng) };
    const hasBase = isPoint(base) && !(base.lat === 0 && base.lng === 0);

    const id = randomUUID();
    const now = new Date().toISOString();
    await db.collection("riders").doc(id).set({
      id, name, phone, email, city,
      // Nobody can sign in until the rider sets their own password from the link
      password: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      ...(hasBase ? { base_lat: base.lat, base_lng: base.lng } : {}),
      base_address: String(b.baseAddress || "").trim().slice(0, 160),
      lang: b.lang === "fr" ? "fr" : "en",
      status: "approved", approved_at: now, approved_by: s.name,
      created_by_admin: s.name,
      no_limit: b.noLimit !== false,
      available: false, balance: 0, active_trade: null, deliveries_done: 0,
      created_at: now, updated_at: now,
    });
    const link = await makeSetupLink(db, id);
    return NextResponse.json({ success: true, id, link, name, phone });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
