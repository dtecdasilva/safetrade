import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb, initDb } from "@/lib/db";
import { createToken, SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role)
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    if (!["buyer", "vendor"].includes(role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const db = getDb();
    const existing = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();

    if (!existing.empty)
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const hash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    const avatar = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

    await db.collection("users").doc(id).set({
      id,
      email: email.toLowerCase(),
      name,
      password: hash,
      role,
      avatar,
      rating: 5.0,
      trade_count: 0,
      created_at: new Date().toISOString(),
    });

    const user: SessionUser = { id, email: email.toLowerCase(), name, role };
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