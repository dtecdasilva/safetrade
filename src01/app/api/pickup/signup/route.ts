import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { cleanEmail, cleanPhone, isEmail } from "@/lib/users";
import { isPoint } from "@/lib/pickup/config";
import { riderToken, setRiderCookie, publicRider } from "@/lib/pickup/auth";
import { sendNotifications, ADMIN_AUDIENCE } from "@/lib/notifications";
import { normalizeLang } from "@/lib/i18n/core";
import { getLang } from "@/lib/i18n/server";

/** A rider signs up. They can't take deliveries until an admin approves them. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const name  = String(b.name || "").trim().slice(0, 80);
    const phone = cleanPhone(b.phone);
    const email = cleanEmail(b.email);
    const city  = String(b.city || "").trim().slice(0, 60);
    if (name.length < 2) return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    if (phone.length < 9) return NextResponse.json({ error: "Enter all 9 digits of your number" }, { status: 400 });
    if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    if (String(b.password || "").length < 8) return NextResponse.json({ error: "Choose a password with at least 8 characters" }, { status: 400 });
    if (!city) return NextResponse.json({ error: "Choose the city where you deliver" }, { status: 400 });
    const base = { lat: Number(b.baseLat), lng: Number(b.baseLng) };
    if (!isPoint(base) || (base.lat === 0 && base.lng === 0))
      return NextResponse.json({ error: "Set where you usually start from: press Use my location" }, { status: 400 });

    const db: any = getDb();
    const [byPhone, byEmail] = await Promise.all([
      db.collection("riders").where("phone", "==", phone).limit(1).get(),
      db.collection("riders").where("email", "==", email).limit(1).get(),
    ]);
    if (!byPhone.empty) return NextResponse.json({ error: "A rider account already uses this number. Sign in instead." }, { status: 409 });
    if (!byEmail.empty) return NextResponse.json({ error: "A rider account already uses this email. Sign in instead." }, { status: 409 });

    const id = randomUUID();
    const now = new Date().toISOString();
    const rider = {
      id, name, phone, email, city,
      password: await bcrypt.hash(String(b.password), 10),
      base_lat: base.lat, base_lng: base.lng,
      base_address: String(b.baseAddress || "").trim().slice(0, 160),
      lang: normalizeLang(b.lang) || getLang(),
      status: "pending",
      available: false,
      balance: 0,
      active_trade: null,
      deliveries_done: 0,
      created_at: now, updated_at: now,
    };
    await db.collection("riders").doc(id).set(rider);
    await sendNotifications([{
      userId: ADMIN_AUDIENCE, tone: "info", link: "/admin?tab=riders",
      title: "New rider to approve",
      body: `${name} (+237 ${phone}) signed up to deliver in ${city}. Check their ID in person, then approve them in Admin, Riders.`,
    }]);
    return setRiderCookie(NextResponse.json({ success: true, rider: publicRider(rider) }), await riderToken(id));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
