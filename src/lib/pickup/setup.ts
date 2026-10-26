/**
 * Riders the admin creates get a link to set their own password. The link
 * works once, for 7 days; making a new link cancels the old one.
 */
import { randomBytes } from "crypto";
import { signTemp, verifyTemp } from "@/lib/auth";
import { pickupUrl } from "@/lib/pickup/config";

const PURPOSE = "pickup-rider-setup";

export async function makeSetupLink(db: any, riderId: string): Promise<string> {
  const nonce = randomBytes(12).toString("hex");
  await db.collection("riders").doc(riderId).update({ setup_nonce: nonce, setup_sent_at: new Date().toISOString() });
  const token = await signTemp({ rid: riderId, n: nonce }, PURPOSE, "7d");
  return `${pickupUrl()}/setup?t=${encodeURIComponent(token)}`;
}

/** The rider this link belongs to, if it is still valid. */
export async function riderFromSetup(db: any, token: string | null | undefined): Promise<any | null> {
  const p = await verifyTemp<{ rid: string; n: string }>(token || undefined, PURPOSE);
  if (!p?.rid || !p.n) return null;
  const r = (await db.collection("riders").doc(p.rid).get()).data();
  return r && r.setup_nonce && r.setup_nonce === p.n ? r : null;
}
