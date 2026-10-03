import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password)
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const db = getDb();
    const resetDoc = await db.collection("password_resets").doc(token).get();

    if (!resetDoc.exists)
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });

    const reset = resetDoc.data()!;

    if (reset.used)
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });

    if (new Date(reset.expires) < new Date())
      return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);

    // Update user password
    await db.collection("users").doc(reset.user_id).update({
      password: hash,
    });

    // Mark token as used
    await db.collection("password_resets").doc(token).update({ used: true });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
