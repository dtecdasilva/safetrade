import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, initDb } from "@/lib/db";
import { createToken, SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const db = getDb();
    const snap = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const row = snap.docs[0].data();
    const valid = await bcrypt.compare(password, row.password);
    if (!valid)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const user: SessionUser = { id: row.id, email: row.email, name: row.name, role: row.role };
    const token = await createToken(user);

    const res = NextResponse.json({ user, success: true });
    res.cookies.set("st_token", token, {
      httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}