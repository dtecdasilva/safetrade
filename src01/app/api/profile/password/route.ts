import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Change password (or set one for the first time after signing up with Google). */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!newPassword || String(newPassword).length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const ref = getDb().collection("users").doc(session.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const user = doc.data()!;

    // Google sign-ups never chose a password, so there is nothing to confirm the first time
    const hasPassword = !(user.auth_provider === "google" && !user.password_set);
    if (hasPassword) {
      if (!currentPassword)
        return NextResponse.json({ error: "Enter your current password" }, { status: 400 });
      const valid = await bcrypt.compare(String(currentPassword), user.password);
      if (!valid)
        return NextResponse.json({ error: "Your current password isn't right" }, { status: 400 });
    }

    await ref.update({ password: await bcrypt.hash(String(newPassword), 10), password_set: true });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
