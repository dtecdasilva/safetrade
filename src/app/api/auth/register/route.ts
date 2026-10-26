import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { createToken, SessionUser } from "@/lib/auth";
import { cleanPhone as normalizePhone, phoneInUse, PHONE_TAKEN } from "@/lib/users";
import { claimInvitedTrades } from "@/lib/invites";
import { normalizeLang } from "@/lib/i18n/core";
import { getLang } from "@/lib/i18n/server";
import { sendPickupWelcome, sendWelcomeEmail } from "@/lib/welcome";

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const body = await req.json();
    const { name, email, password, phone, sells, invite, lang } = body;
    // Accounts made on pickup.zolahq.com are ordinary Zola accounts (buyer side; they can switch later)
    const fromPickup = body.site === "pickup";
    const role = fromPickup ? "buyer" : body.role;
    if (fromPickup && String(phone || "").replace(/\D/g, "").length < 9)
      return NextResponse.json({ error: "Enter your phone number" }, { status: 400 });

    if (!name || !email || !password || !role)
      return NextResponse.json({ error: "Please fill in all the fields" }, { status: 400 });
    if (!["buyer", "vendor"].includes(role))
      return NextResponse.json({ error: "Choose whether you're buying or selling" }, { status: 400 });

    const db = getDb();
    const existing = await db.collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();
    if (!existing.empty)
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    // One phone number per account, whether buyer or seller
    if (await phoneInUse(db, normalizePhone(phone)))
      return NextResponse.json({ error: PHONE_TAKEN }, { status: 409 });

    const hash    = await bcrypt.hash(password, 10);
    const id      = randomUUID();
    const avatar  = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    // Clean phone: strip non-digits, remove leading 237 or 0
    const cleanPhone = phone
      ? phone.replace(/\D/g, "").replace(/^237/, "").replace(/^0/, "")
      : "";

    const userLang = normalizeLang(lang) || getLang();
    await db.collection("users").doc(id).set({
      id,
      email:       email.toLowerCase(),
      name,
      password:    hash,
      role,
      avatar,
      phone:       cleanPhone,
      // Emails and notifications are sent in this language
      lang:        userLang,
      // From the signup questions: "goods", "services" or "both" (sellers only)
      ...(role === "vendor" && ["goods", "services", "both"].includes(sells) ? { sells } : {}),
      rating:      5.0,
      trade_count: 0,
      ...(fromPickup ? { joined_via: "pickup" } : {}),
      created_at:  new Date().toISOString(),
    });

    const user: SessionUser = { id, email: email.toLowerCase(), name, role };
    const token = await createToken(user);

    // A seller may already have created a transaction for this person
    const claimed = await claimInvitedTrades(db, { id, name, email: email.toLowerCase(), phone: cleanPhone, avatar, role }, invite);

    // Welcome email, in their language (never blocks the signup)
    if (fromPickup) await sendPickupWelcome({ name, email: email.toLowerCase(), lang: userLang });
    else await sendWelcomeEmail({ name, email: email.toLowerCase(), role, lang: userLang });

    const res = NextResponse.json({ user, success: true, tradeId: claimed[0] || null, waiting: claimed.length });
    res.cookies.set("st_token", token, {
      httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
