import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "safetrade-super-secret-key-2025"
);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "buyer" | "vendor" | "admin";
}

export async function createToken(user: SessionUser) {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("st_token")?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function cuid(): string {
  const { randomUUID } = require("crypto");
  return randomUUID();
}

/**
 * Short-lived signed values for one specific purpose, such as the steps of
 * the Google sign-in handshake. They are signed with a key derived from the
 * session secret plus the purpose, so they can never be passed off as a
 * session token (or as a token for a different purpose).
 */
function purposeKey(purpose: string) {
  return new TextEncoder().encode(
    `${process.env.JWT_SECRET || "safetrade-super-secret-key-2025"}::${purpose}`
  );
}

export async function signTemp(payload: Record<string, unknown>, purpose: string, expiresIn = "15m") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(purposeKey(purpose));
}

export async function verifyTemp<T = Record<string, unknown>>(token: string | undefined, purpose: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, purposeKey(purpose));
    return payload as unknown as T;
  } catch {
    return null;
  }
}
