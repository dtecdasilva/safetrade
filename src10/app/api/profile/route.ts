import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createToken, getSession, SessionUser } from "@/lib/auth";
import { cleanEmail, cleanPhone, emailInUse, initialsOf, isEmail, phoneInUse, EMAIL_TAKEN, PHONE_TAKEN } from "@/lib/users";

export const dynamic = "force-dynamic";

const SIGNED_OUT = "Your session has ended. Please sign in again.";

function publicProfile(u: any) {
  return {
    id: u.id,
    name: u.name || "",
    email: u.email || "",
    phone: u.phone || "",
    role: u.role,
    created_at: u.created_at || "",
    signed_up_with_google: u.auth_provider === "google",
    // People who signed up with Google have no password until they set one
    has_password: !(u.auth_provider === "google" && !u.password_set),
  };
}

/** The signed-in person's own details. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: SIGNED_OUT }, { status: 401 });

    const doc = await getDb().collection("users").doc(session.id).get();
    if (!doc.exists) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    return NextResponse.json({ profile: publicProfile(doc.data()) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Update name, email and WhatsApp number. */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: SIGNED_OUT }, { status: 401 });

    const db  = getDb();
    const ref = db.collection("users").doc(session.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const current = doc.data()!;
    const isAdmin = current.role === "admin";

    const body  = await req.json();
    const name  = String(body.name ?? "").trim();
    const email = body.email === undefined ? current.email : cleanEmail(body.email);
    const phone = body.phone === undefined ? (current.phone || "") : cleanPhone(body.phone);

    if (name.length < 2)
      return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    if (name.length > 80)
      return NextResponse.json({ error: "That name is too long" }, { status: 400 });
    if (!isEmail(email))
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

    // The admin sign-in address is fixed: the app looks for it when it starts
    if (isAdmin && email !== current.email)
      return NextResponse.json({ error: "The admin email can't be changed here" }, { status: 400 });

    // Buyers and sellers are found and notified by this number, so it is required for them
    if (!isAdmin && phone.length < 8)
      return NextResponse.json({ error: "Enter your WhatsApp number" }, { status: 400 });
    if (phone && phone.length < 8)
      return NextResponse.json({ error: "That phone number looks too short" }, { status: 400 });

    if (email !== current.email && (await emailInUse(db, email, session.id)))
      return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
    if (phone !== (current.phone || "") && (await phoneInUse(db, phone, session.id)))
      return NextResponse.json({ error: PHONE_TAKEN }, { status: 409 });

    const avatar = initialsOf(name);
    await ref.update({ name, email, phone, avatar, updated_at: new Date().toISOString() });

    // Transactions and withdrawals keep a copy of each person's details.
    // Bring those copies up to date so reminders and labels use the new ones.
    if (name !== current.name || email !== current.email || phone !== (current.phone || "")) {
      try {
        const [asBuyer, asSeller, payouts] = await Promise.all([
          db.collection("trades").where("buyer_id", "==", session.id).get(),
          db.collection("trades").where("vendor_id", "==", session.id).get(),
          db.collection("withdrawals").where("vendor_id", "==", session.id).get(),
        ]);
        const writes: [any, Record<string, any>][] = [
          ...asBuyer.docs.map((d: any) => [d.ref, { buyer_name: name, buyer_email: email, buyer_avatar: avatar, buyer_phone: phone }] as [any, any]),
          ...asSeller.docs.map((d: any) => [d.ref, { vendor_name: name, vendor_email: email, vendor_avatar: avatar }] as [any, any]),
          ...payouts.docs.map((d: any) => [d.ref, { vendor_name: name, vendor_email: email }] as [any, any]),
        ];
        for (let i = 0; i < writes.length; i += 400) {
          const batch = db.batch();
          writes.slice(i, i + 400).forEach(([r, v]) => batch.update(r, v));
          await batch.commit();
        }
      } catch (e: any) {
        console.error("[profile] could not update copies on transactions:", e.message);
      }
    }

    // The session carries the name and email, so issue a fresh one
    const user: SessionUser = { id: session.id, email, name, role: current.role };
    const token = await createToken(user);

    const res = NextResponse.json({ success: true, user, profile: publicProfile({ ...current, name, email, phone }) });
    res.cookies.set("st_token", token, {
      httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
