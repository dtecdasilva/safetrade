import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createToken, getSession, SessionUser } from "@/lib/auth";

/**
 * Switch between buying and selling. One account does both: the stored role
 * ("buyer" or "vendor") is simply the side the person is using right now, and
 * decides which transactions their dashboard shows.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
    if (session.role === "admin")
      return NextResponse.json({ error: "Admin accounts can't switch to buying or selling" }, { status: 400 });

    const { mode } = await req.json().catch(() => ({}));
    if (mode !== "buyer" && mode !== "vendor")
      return NextResponse.json({ error: "Choose buying or selling" }, { status: 400 });

    const db  = getDb();
    const ref = db.collection("users").doc(session.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
    const u = doc.data()!;

    const now = new Date().toISOString();
    await ref.update({
      role: mode,
      mode_switched_at: now,
      // Remember that this person has used both sides
      ...(mode === "vendor" && !u.became_seller_at ? { became_seller_at: now } : {}),
      ...(mode === "buyer" && !u.became_buyer_at ? { became_buyer_at: now } : {}),
    });

    const user: SessionUser = { id: session.id, email: u.email || session.email, name: u.name || session.name, role: mode };
    const res = NextResponse.json({ success: true, role: mode });
    res.cookies.set("st_token", await createToken(user), {
      httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
