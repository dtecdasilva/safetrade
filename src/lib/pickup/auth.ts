/**
 * Rider accounts on Pickup. They are separate from Zola accounts: riders sign
 * in on pickup.zolahq.com with their own cookie, and their details live in
 * the "riders" collection.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signTemp, verifyTemp } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const RIDER_COOKIE = "pk_token";
const PURPOSE = "pickup-rider";
const DAYS = 30;

export async function riderToken(id: string): Promise<string> {
  return signTemp({ rid: id }, PURPOSE, `${DAYS}d`);
}

export function setRiderCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(RIDER_COOKIE, token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * DAYS, sameSite: "lax" });
  return res;
}

/** The signed-in rider, read fresh from the database (null if signed out). */
export async function getRider(): Promise<any | null> {
  try {
    const token = cookies().get(RIDER_COOKIE)?.value;
    const p = await verifyTemp<{ rid: string }>(token, PURPOSE);
    if (!p?.rid) return null;
    const doc = await getDb().collection("riders").doc(p.rid).get();
    return doc.exists ? doc.data() : null;
  } catch {
    return null;
  }
}

/** What a rider may see about their own account. */
export function publicRider(r: any) {
  const { password, ...safe } = r || {};
  return safe;
}

export const SIGNED_OUT = { error: "Please sign in again." };
