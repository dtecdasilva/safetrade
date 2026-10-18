import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Sign in with Google (OAuth 2.0 authorization-code flow, server side).
 *
 * Setup, once:
 *   1. In Google Cloud Console → APIs & Services → Credentials, create an
 *      "OAuth client ID" of type "Web application".
 *   2. Add this Authorised redirect URI (one per domain you use):
 *        https://YOUR-DOMAIN/api/auth/google/callback
 *        http://localhost:3000/api/auth/google/callback   (for local work)
 *   3. Set these environment variables (Vercel → Settings → Environment Variables):
 *        GOOGLE_CLIENT_ID=...
 *        GOOGLE_CLIENT_SECRET=...
 *
 * The redirect URI is built from the address the app is being visited on.
 * Set GOOGLE_REDIRECT_URI only if you need to force a specific one.
 */

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
}

/** The Google consent screen address to send the person to. */
export function googleAuthUrl(origin: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * Swap the one-time code Google sent back for the person's identity, and
 * verify that identity really was issued by Google for this app.
 */
export async function googleProfileFromCode(code: string, origin: string): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data.id_token) {
    throw new Error(`Google token exchange failed: ${data.error_description || data.error || res.status}`);
  }

  const { payload } = await jwtVerify(data.id_token, GOOGLE_KEYS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });

  return {
    sub: String(payload.sub || ""),
    email: String(payload.email || "").toLowerCase(),
    email_verified: payload.email_verified === true || payload.email_verified === "true",
    name: String(payload.name || payload.given_name || ""),
    picture: payload.picture ? String(payload.picture) : undefined,
  };
}
