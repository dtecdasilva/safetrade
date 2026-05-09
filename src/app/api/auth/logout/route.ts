import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("st_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
