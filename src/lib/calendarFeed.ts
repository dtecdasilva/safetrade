/**
 * The admin's calendar subscription: one private link that lists every
 * transaction under review, each as "Time to pay the vendor" at the moment
 * its 24 hours end. The link carries a key; making a new link cancels the old.
 */
import { randomBytes } from "crypto";
import { signTemp, verifyTemp } from "@/lib/auth";
import { siteUrl } from "@/lib/support";

const PURPOSE = "admin-calendar";

export async function feedUrl(db: any, rotate = false): Promise<string> {
  const ref = db.collection("settings").doc("admin_calendar");
  let key = (await ref.get()).data()?.key;
  if (!key || rotate) { key = randomBytes(12).toString("hex"); await ref.set({ key, updated_at: new Date().toISOString() }); }
  const token = await signTemp({ k: key }, PURPOSE, "3650d");
  return `${siteUrl()}/api/calendar/reviews?t=${encodeURIComponent(token)}`;
}

export async function feedAllowed(db: any, token: string | null): Promise<boolean> {
  const p = await verifyTemp<{ k: string }>(token || undefined, PURPOSE);
  if (!p?.k) return false;
  const key = (await db.collection("settings").doc("admin_calendar").get()).data()?.key;
  return !!key && key === p.k;
}
