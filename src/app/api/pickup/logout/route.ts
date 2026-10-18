import { NextResponse } from "next/server";
import { RIDER_COOKIE } from "@/lib/pickup/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(RIDER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
