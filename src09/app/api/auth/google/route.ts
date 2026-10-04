import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { signTemp } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/** How long someone has to finish signing in with Google once the button is ready. */
const STATE_MINUTES = 30;

/**
 * Step 1: start a Google sign-in.
 *
 *   GET /api/auth/google            → redirects the browser to Google.
 *   GET /api/auth/google?format=json → returns { url } instead of redirecting.
 *
 * The JSON form exists for the installed (home-screen) app on iPhone. There,
 * Google refuses to load inside the app's own browser view, and a redirect
 * from Zola's address keeps the person inside it. With the JSON form the page
 * links straight to Google's address, so the iPhone opens it in a proper
 * Safari view, which Google accepts.
 */
export async function GET(req: NextRequest) {
  const origin   = req.nextUrl.origin;
  const wantJson = req.nextUrl.searchParams.get("format") === "json";

  if (!googleConfigured()) {
    return wantJson
      ? NextResponse.json({ error: "google_not_configured" }, { status: 503 })
      : NextResponse.redirect(`${origin}/auth/login?error=google_not_configured`);
  }

  // Remembered through the round trip so a new account starts on the right side
  const role  = req.nextUrl.searchParams.get("role") === "vendor" ? "vendor" : "buyer";
  const state = randomUUID();
  const url   = googleAuthUrl(origin, state);

  const res = wantJson
    ? NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.redirect(url);

  res.cookies.set("g_state", await signTemp({ state, role }, "google-state", `${STATE_MINUTES}m`), {
    httpOnly: true, path: "/", maxAge: STATE_MINUTES * 60, sameSite: "lax", secure: origin.startsWith("https://"),
  });
  return res;
}
