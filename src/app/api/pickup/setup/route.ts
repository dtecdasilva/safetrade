import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { riderFromSetup } from "@/lib/pickup/setup";
import { riderToken, setRiderCookie } from "@/lib/pickup/auth";

const EXPIRED = "This link has expired or was already used. Ask Zola for a new one.";

/** Check a setup link: whose account is it? */
export async function GET(req: NextRequest) {
  const r = await riderFromSetup(getDb(), req.nextUrl.searchParams.get("t"));
  if (!r) return NextResponse.json({ error: EXPIRED }, { status: 404 });
  return NextResponse.json({ name: r.name, phone: r.phone, email: r.email || "" });
}

/** The rider sets their password and is signed in. */
export async function POST(req: NextRequest) {
  try {
    const db: any = getDb();
    const { t, password } = await req.json().catch(() => ({}));
    const r = await riderFromSetup(db, t);
    if (!r) return NextResponse.json({ error: EXPIRED }, { status: 404 });
    if (String(password || "").length < 8) return NextResponse.json({ error: "Choose a password with at least 8 characters" }, { status: 400 });
    const now = new Date().toISOString();
    await db.collection("riders").doc(r.id).update({ password: await bcrypt.hash(String(password), 10), setup_nonce: null, setup_done_at: now, updated_at: now });
    return setRiderCookie(NextResponse.json({ success: true }), await riderToken(r.id));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
