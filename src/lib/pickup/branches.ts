import { isPoint } from "@/lib/pickup/config";

/** Check and tidy a bus agency branch typed in by the admin. */
export function cleanBranch(b: any): { error?: string; value?: any } {
  const agency = String(b.agency || "").trim().slice(0, 60);
  const name = String(b.name || "").trim().slice(0, 60);
  const city = String(b.city || "").trim().slice(0, 60);
  const address = String(b.address || "").trim().slice(0, 160);
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!agency) return { error: "Enter the agency's name" };
  if (!name) return { error: "Enter the branch name, for example Mvan or Bonabéri" };
  if (!city) return { error: "Enter the city" };
  if (!isPoint({ lat, lng }) || (lat === 0 && lng === 0)) return { error: "Put the branch on the map" };
  return { value: { agency, name, city, address, lat, lng } };
}

