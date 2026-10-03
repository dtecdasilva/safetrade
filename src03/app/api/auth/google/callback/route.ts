import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { createToken, signTemp, verifyTemp, SessionUser } from "@/lib/auth";
import { googleConfigured, googleProfileFromCode } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * Step 2: Google sends the person back here.
 *  - If their email already has a Zola account, they are signed in.
 *  - If not, they finish setting up (buyer or seller, WhatsApp number) on
 *    /auth/complete before the account is created.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const secure = origin.startsWith("https://");
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/auth/login?error=${code}`);
    res.cookies.set("g_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  };

  try {
    if (!googleConfigured()) return fail("google_not_configured");

    const params = req.nextUrl.searchParams;
    if (params.get("error")) return fail("google_cancelled");

    const code  = params.get("code");
    const state = params.get("state");
    const saved = await verifyTemp<{ state: string; role: string }>(req.cookies.get("g_state")?.value, "google-state");
    if (!code || !state || !saved || saved.state !== state) return fail("google_state");

    const profile = await googleProfileFromCode(code, origin);
    if (!profile.email || !profile.email_verified) return fail("google_unverified");

    await initDb();
    const db = getDb();
    const snap = await db.collection("users").where("email", "==", profile.email).limit(1).get();

    // Existing account: sign in
    if (!snap.empty) {
      const row = snap.docs[0].data();
      if (!row.google_id) {
        await db.collection("users").doc(row.id).update({ google_id: profile.sub });
      }

      const user: SessionUser = { id: row.id, email: row.email, name: row.name, role: row.role };
      const token = await createToken(user);

      const res = NextResponse.redirect(`${origin}${row.role === "admin" ? "/admin" : "/dashboard"}`);
      res.cookies.set("st_token", token, {
        httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
      });
      res.cookies.set("g_state", "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }

    // New person: hold their Google details for 20 minutes while they finish setting up
    const pending = await signTemp(
      { email: profile.email, name: profile.name, sub: profile.sub, role: saved.role === "vendor" ? "vendor" : "buyer" },
      "google-pending",
      "20m"
    );
    const res = NextResponse.redirect(`${origin}/auth/complete`);
    res.cookies.set("g_pending", pending, { httpOnly: true, path: "/", maxAge: 1200, sameSite: "lax", secure });
    res.cookies.set("g_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e: any) {
    console.error("[google/callback] error:", e.message);
    return fail("google_failed");
  }
}
