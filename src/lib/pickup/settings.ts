/** Pickup's prices and on/off switch, kept in settings/pickup. */
import { DEFAULT_SETTINGS, PickupSettings } from "@/lib/pickup/config";
import { listCities } from "@/lib/pickup/cities";

export async function getPickupSettings(db: any): Promise<PickupSettings> {
  const doc = await db.collection("settings").doc("pickup").get();
  const saved = doc.exists ? doc.data() : {};
  const s: PickupSettings = { ...DEFAULT_SETTINGS, ...saved };
  // Before the admin has saved settings, Pickup is on once a city (or an agency branch) is added
  if (!doc.exists || saved.enabled === undefined) {
    const b = await db.collection("agency_branches").where("active", "==", true).limit(1).get();
    s.enabled = b.size > 0 || (await listCities(db)).length > 0;
  }
  return s;
}

/**
 * Cities Pickup works in: the ones the admin added (Admin, Cities). Until the
 * admin adds any, the cities of agency branches and approved riders.
 */
export async function pickupCities(db: any): Promise<string[]> {
  const added = await listCities(db);
  if (added.length) return added.map((c) => c.name);
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
