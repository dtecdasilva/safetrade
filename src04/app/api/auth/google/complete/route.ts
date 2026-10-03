import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { createToken, verifyTemp, SessionUser } from "@/lib/auth";
import { phoneInUse, PHONE_TAKEN } from "@/lib/users";

export const dynamic = "force-dynamic";

interface Pending { email: string; name: string; sub: string; role: string }

const EXPIRED = "Your Google sign-in has expired. Please start again.";

/** Who is in the middle of signing up with Google (to pre-fill the form). */
export async function GET(req: NextRequest) {
  const pending = await verifyTemp<Pending>(req.cookies.get("g_pending")?.value, "google-pending");
  if (!pending) return NextResponse.json({ error: EXPIRED }, { status: 401 });
  return NextResponse.json({ email: pending.email, name: pending.name, role: pending.role });
}

/** Step 3 for new people: create the account and sign them in. */
export async function POST(req: NextRequest) {
  try {
    const pending = await verifyTemp<Pending>(req.cookies.get("g_pending")?.value, "google-pending");
    if (!pending) return NextResponse.json({ error: EXPIRED }, { status: 401 });

    const body = await req.json();
    const name = String(body.name || pending.name || "").trim();
    const role = body.role;

    if (!name)
      return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    if (!["buyer", "vendor"].includes(role))
      return NextResponse.json({ error: "Choose whether you're buying or selling" }, { status: 400 });

    // Same clean-up as normal registration: digits only, no leading 237 or 0
    const cleanPhone = String(body.phone || "").replace(/\D/g, "").replace(/^237/, "").replace(/^0/, "");
    if (cleanPhone.length < 8)
      return NextResponse.json({ error: "Enter your WhatsApp number" }, { status: 400 });

    await initDb();
    const db = getDb();

    const existing = await db.collection("users").where("email", "==", pending.email).limit(1).get();
    if (!existing.empty)
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });

    if (await phoneInUse(db, cleanPhone))
      return NextResponse.json({ error: PHONE_TAKEN }, { status: 409 });

    const id     = randomUUID();
    const avatar = name.split(" ").filter(Boolean).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    // No password was chosen. Store an unguessable one so password sign-in simply
    // doesn't match; the person can set a real one with "Forgot password".
    const hash   = await bcrypt.hash(randomUUID() + randomUUID(), 10);

    await db.collection("users").doc(id).set({
      id,
      email:         pending.email,
      name,
      password:      hash,
      role,
      avatar,
      phone:         cleanPhone,
      rating:        5.0,
      trade_count:   0,
      google_id:     pending.sub,
      auth_provider: "google",
      created_at:    new Date().toISOString(),
    });

    const user: SessionUser = { id, email: pending.email, name, role };
    const token = await createToken(user);

    const res = NextResponse.json({ user, success: true });
    res.cookies.set("st_token", token, {
      httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
    });
    res.cookies.set("g_pending", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
