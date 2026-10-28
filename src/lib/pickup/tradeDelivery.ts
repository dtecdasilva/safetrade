/**
 * Pickup deliveries for Zola transactions: where the rider collects the
 * parcel, and the delivery fee from the distance to the buyer.
 *
 *   same_city    the seller marks their pickup spot; no agency
 *   out_of_town  the seller chooses the buyer's city and sends it by any bus
 *                agency to the rider there (or, older ones, to a chosen branch)
 *
 * The fee is only known once the buyer has said where to deliver, so it is
 * worked out then, before the buyer pays. Until then delivery_pending is true.
 */
import { quote } from "@/lib/fees";
import { DeliveryMode, Origin, branchOrigin, distanceKm, isPoint, quoteDelivery } from "@/lib/pickup/config";
import { getPickupSettings, pickupCities } from "@/lib/pickup/settings";
import { findCity, listCities } from "@/lib/pickup/cities";
import { branchSnapshot, sameCity, tradeOrigin } from "@/lib/pickup/deliveries";

export interface OriginChoice { mode?: DeliveryMode; origin?: Origin; branch?: any; error?: string }

/** The point a parcel from another city is priced from: the centre of the buyer's city. */
export function cityOrigin(c: { name: string; lat: number; lng: number }, agency = ""): Origin {
  return { kind: "city", lat: c.lat, lng: c.lng, city: c.name, label: agency ? `${agency}, ${c.name}` : c.name, ...(agency ? { agency } : {}) };
}

/** How far from the city centre an agency office can be (km). */
const AGENCY_MAX_KM = 40;

/** Read the seller's choice from a form: same city (a map spot) or another city (an agency branch). */
export async function originFromBody(db: any, body: any): Promise<OriginChoice> {
  const mode: DeliveryMode | "" = body?.deliveryMode === "same_city" ? "same_city" : body?.deliveryMode === "out_of_town" || body?.destBranchId || body?.destCity ? "out_of_town" : "";
  if (!mode) return { error: "Choose whether the buyer is in your city or in another city" };
  if (mode === "out_of_town") {
    // Older forms: a chosen agency branch
    if (body.destBranchId) {
      const branch = await branchSnapshot(db, body.destBranchId);
      if (!branch) return { error: "Choose the agency branch you will send it to" };
      return { mode, branch, origin: branchOrigin(branch) };
    }
    // Now: the buyer's city, the bus agency, and the agency's quarter on the map
    const city = await findCity(db, body.destCity);
    if (!city) return { error: (await listCities(db)).length ? "Choose the buyer's city" : "Zola doesn't deliver in other cities yet" };
    const agency = String(body.agencyName || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (agency.length < 2) return { error: "Enter the bus agency you will send it with" };
    // The sender doesn't know where the office is: price from the city centre
    if (body.agencyUnknown) return { mode, origin: cityOrigin(city, agency) };
    const pt = { lat: Number(body.agencyLat), lng: Number(body.agencyLng) };
    if (!isPoint(pt) || (pt.lat === 0 && pt.lng === 0)) return { error: "Mark the agency's quarter on the map, or tick that you don't know it" };
    if (distanceKm(pt, city) > AGENCY_MAX_KM) return { error: `That place isn't in ${city.name}. Mark the agency's office in ${city.name}.` };
    const quarter = String(body.agencyQuarter || "").replace(/\s+/g, " ").trim().slice(0, 80);
    return { mode, origin: { kind: "agency", lat: pt.lat, lng: pt.lng, city: city.name, agency,
      label: quarter ? `${agency}, ${quarter}` : agency, landmark: quarter } };
  }
  const lat = Number(body.originLat), lng = Number(body.originLng);
  if (!isPoint({ lat, lng }) || (lat === 0 && lng === 0)) return { error: "Mark where the rider collects the parcel from you" };
  const city = String(body.originCity || "").trim();
  if (!city) return { error: "Choose your city" };
  const cities = await pickupCities(db);
  if (cities.length && !cities.some((c) => sameCity(c, city))) return { error: "Pickup doesn't have riders in that city yet" };
  const landmark = String(body.originLandmark || "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (landmark.length < 3) return { error: "Describe your pickup spot so the rider finds you" };
  const canonical = cities.find((c) => sameCity(c, city)) || city;
  return { mode, origin: { kind: "spot", lat, lng, city: canonical, label: landmark, landmark } };
}

/** Is Pickup handling deliveries? (Admin switch; on by default once an agency branch exists.) */
export async function pickupOn(db: any): Promise<boolean> {
  return (await getPickupSettings(db)).enabled;
}

/**
 * The money fields for a Pickup transaction: the delivery fee comes from the
 * distance between the pickup point and the buyer's spot, if it is set.
 */
export async function pickupPrice(db: any, amount: number, origin: Origin | null, dest: { lat: number; lng: number } | null) {
  const base = quote(Number(amount), false);  // item + Zola fee, no flat delivery
  if (!origin || !dest || !isPoint(dest)) {
    return { fee: base.fee, delivery_fee: 0, delivery_km: 0, delivery_pending: true, buyer_total: base.total };
  }
  const s = await getPickupSettings(db);
  const q = quoteDelivery(origin, dest, s);
  return { fee: base.fee, delivery_fee: q.fee, delivery_km: q.km, delivery_pending: false, buyer_total: base.total + q.fee };
}

export function tradeDest(trade: any): { lat: number; lng: number } | null {
  return isPoint({ lat: trade?.delivery_lat, lng: trade?.delivery_lng }) ? { lat: Number(trade.delivery_lat), lng: Number(trade.delivery_lng) } : null;
}

export { tradeOrigin };
