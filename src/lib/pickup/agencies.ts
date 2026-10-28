/**
 * Bus agency offices senders have used, per city, so the next sender can pick
 * "Touristique Express, Mvan" instead of marking the map again. Built up by
 * use: every transaction or booking with a marked agency office adds to it.
 */
import { cityId } from "@/lib/pickup/cities";
import { isPoint } from "@/lib/pickup/config";

const key = (s: string) => cityId(s || "");

export function agencySpotId(city: string, agency: string, quarter: string) {
  return [key(city), key(agency), key(quarter) || "x"].join("__");
}

/** Remember an agency office from an origin (only marked ones, not "I don't know"). */
export async function rememberAgency(db: any, origin: any) {
  try {
    if (origin?.kind !== "agency" || !origin.agency || !isPoint({ lat: origin.lat, lng: origin.lng })) return;
    const id = agencySpotId(origin.city, origin.agency, origin.landmark || "");
    const ref = db.collection("agency_spots").doc(id);
    const now = new Date().toISOString();
    const old = (await ref.get()).data();
    if (old?.hidden) return;
    await ref.set({
      id, city: origin.city, agency: old?.agency || origin.agency, quarter: old?.quarter ?? (origin.landmark || ""),
      // Keep the first point unless the admin moved it; senders only add uses
      lat: old ? old.lat : Number(origin.lat), lng: old ? old.lng : Number(origin.lng),
      uses: (Number(old?.uses) || 0) + 1, created_at: old?.created_at || now, updated_at: now,
    });
  } catch { /* suggestions must never block a sale */ }
}

export async function agencySpots(db: any, city?: string, includeHidden = false) {
  const snap = await db.collection("agency_spots").get();
  const c = key(city || "");
  return snap.docs.map((d: any) => d.data())
    .filter((s: any) => (includeHidden || !s.hidden) && (!c || key(s.city) === c))
    .sort((a: any, b: any) => (Number(b.uses) || 0) - (Number(a.uses) || 0) || String(a.agency).localeCompare(b.agency));
}
