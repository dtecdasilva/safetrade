/**
 * The towns and cities Zola delivers in, set by the admin (Admin, Cities).
 * Each has a centre point: for a parcel coming from another city, the
 * delivery price is worked out from the city centre to the buyer.
 */
import { isPoint } from "@/lib/pickup/config";

export interface City { id: string; name: string; lat: number; lng: number; active: boolean }

export const cityId = (name: string) => String(name || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function listCities(db: any, includeOff = false): Promise<City[]> {
  const snap = await db.collection("pickup_cities").get();
  return snap.docs.map((d: any) => d.data())
    .filter((c: any) => !!c?.name && isPoint({ lat: c.lat, lng: c.lng }) && (includeOff || c.active !== false))
    .map((c: any) => ({ id: c.id, name: c.name, lat: Number(c.lat), lng: Number(c.lng), active: c.active !== false }))
    .sort((a: City, b: City) => a.name.localeCompare(b.name));
}

export async function findCity(db: any, name: unknown): Promise<City | null> {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return (await listCities(db)).find((c) => c.name.toLowerCase() === n || c.id === cityId(n)) || null;
}
