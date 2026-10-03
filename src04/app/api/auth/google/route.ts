import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { signTemp } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Step 1: send the person to Google to choose their account. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!googleConfigured())
    return NextResponse.redirect(`${origin}/auth/login?error=google_not_configured`);

  // Remembered through the round trip so a new account starts on the right side
  const role  = req.nextUrl.searchParams.get("role") === "vendor" ? "vendor" : "buyer";
  const state = randomUUID();

  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("g_state", await signTemp({ state, role }, "google-state", "10m"), {
    httpOnly: true, path: "/", maxAge: 600, sameSite: "lax", secure: origin.startsWith("https://"),
  });
  return res;
}
