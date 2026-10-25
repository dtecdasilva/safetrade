import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { cleanEmail, cleanPhone } from "@/lib/users";
import { riderToken, setRiderCookie, publicRider } from "@/lib/pickup/auth";

/** Riders sign in with their email or phone number. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const login = String(b.login || "").trim();
    const db: any = getDb();
    const snap = login.includes("@")
      ? await db.collection("riders").where("email", "==", cleanEmail(login)).limit(1).get()
      : await db.collection("riders").where("phone", "==", cleanPhone(login)).limit(1).get();
    const rider = snap.empty ? null : snap.docs[0].data();
    if (!rider || !(await bcrypt.compare(String(b.password || ""), rider.password)))
      return NextResponse.json({ error: "Wrong email, number or password" }, { status: 401 });
    return setRiderCookie(NextResponse.json({ success: true, rider: publicRider(rider) }), await riderToken(rider.id));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
