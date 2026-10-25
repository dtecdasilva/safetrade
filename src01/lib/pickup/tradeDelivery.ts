/**
 * Pickup deliveries for Zola transactions: where the rider collects the
 * parcel, and the delivery fee from the distance to the buyer.
 *
 *   same_city    the seller marks their pickup spot; no agency
 *   out_of_town  the seller sends it by bus agency to a branch in the buyer's city
 *
 * The fee is only known once the buyer has said where to deliver, so it is
 * worked out then, before the buyer pays. Until then delivery_pending is true.
 */
import { quote } from "@/lib/fees";
import { DeliveryMode, Origin, branchOrigin, isPoint, quoteDelivery } from "@/lib/pickup/config";
import { getPickupSettings, pickupCities } from "@/lib/pickup/settings";
import { branchSnapshot, sameCity, tradeOrigin } from "@/lib/pickup/deliveries";

export interface OriginChoice { mode?: DeliveryMode; origin?: Origin; branch?: any; error?: string }

/** Read the seller's choice from a form: same city (a map spot) or another city (an agency branch). */
export async function originFromBody(db: any, body: any): Promise<OriginChoice> {
  const mode: DeliveryMode | "" = body?.deliveryMode === "same_city" ? "same_city" : body?.deliveryMode === "out_of_town" || body?.destBranchId ? "out_of_town" : "";
  if (!mode) return { error: "Choose whether the buyer is in your city or in another city" };
  if (mode === "out_of_town") {
    const branch = await branchSnapshot(db, body.destBranchId);
    if (!branch) return { error: "Choose the agency branch you will send it to" };
    return { mode, branch, origin: branchOrigin(branch) };
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
