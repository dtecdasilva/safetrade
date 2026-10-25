import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n/core";
import { getRider } from "@/lib/pickup/auth";

/** Save the language someone picked, so emails and notifications use it too. */
export async function POST(req: NextRequest) {
  const { lang } = await req.json().catch(() => ({}));
  const value = normalizeLang(lang);
  if (!value) return NextResponse.json({ error: "Unknown language" }, { status: 400 });

  const res = NextResponse.json({ success: true, lang: value });
  res.cookies.set(LANG_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const session = await getSession();
  if (session) {
    try { await getDb().collection("users").doc(session.id).update({ lang: value }); }
    catch (e: any) { console.error("[lang] could not save:", e?.message); }
  }
  // A Pickup rider: their emails follow the language too
  const rider = await getRider();
  if (rider) {
    try { await (getDb() as any).collection("riders").doc(rider.id).update({ lang: value }); }
    catch (e: any) { console.error("[lang] could not save for rider:", e?.message); }
  }
  return res;
}
