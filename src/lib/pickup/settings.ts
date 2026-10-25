/** Pickup's prices and on/off switch, kept in settings/pickup. */
import { DEFAULT_SETTINGS, PickupSettings } from "@/lib/pickup/config";

export async function getPickupSettings(db: any): Promise<PickupSettings> {
  const doc = await db.collection("settings").doc("pickup").get();
  const saved = doc.exists ? doc.data() : {};
  const s: PickupSettings = { ...DEFAULT_SETTINGS, ...saved };
  // Before the admin has saved settings, Pickup is on once an agency branch exists
  if (!doc.exists || saved.enabled === undefined) {
    const b = await db.collection("agency_branches").where("active", "==", true).limit(1).get();
    s.enabled = b.size > 0;
  }
  return s;
}

/** Cities Pickup works in: where there are agency branches or approved riders. */
export async function pickupCities(db: any): Promise<string[]> {
  const [b, r] = await Promise.all([
    db.collection("agency_branches").where("active", "==", true).get(),
    db.collection("riders").where("status", "==", "approved").get(),
  ]);
  const seen = new Map<string, string>();
  for (const d of [...b.docs, ...r.docs]) {
    const c = String(d.data().city || "").trim();
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
