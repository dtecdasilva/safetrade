/**
 * Pickup: Zola's delivery platform, served at pickup.zolahq.com.
 *
 * How a parcel travels:
 *   1. When creating a transaction, the seller picks the bus agency branch
 *      (agency + branch + city) the parcel will be sent to.
 *   2. When the buyer pays, Pickup assigns a rider in that city: riders who
 *      are free come first (one package at a time), then the closest to the
 *      branch. The seller sees the rider's name and number and writes them
 *      on the parcel as the recipient.
 *   3. The seller sends it through the agency and enters the receipt number.
 *   4. The rider collects it at the branch, then delivers it to the buyer,
 *      sharing their location so the buyer can follow it on a map.
 *   5. The buyer gives the rider a 4-digit code on delivery.
 *
 * Riders keep a balance with Pickup (they top it up with mobile money). It
 * is their guarantee: a rider can only carry a package worth up to
 * VALUE_RATIO of their balance. With FCFA 5,000 they can carry up to 3,500.
 *
 * This file has no server-only code, so pages and API routes share it.
 */

/** Share of a rider's balance they may carry in package value: 5,000 → 3,500. */
export const VALUE_RATIO = 0.7;

/** Smallest top-up (Fapshi's minimum payment is FCFA 100). */
export const MIN_TOPUP = 500;

/** A rider's live location counts for matching for this long; after that, their home base is used. */
export const LOCATION_FRESH_MINUTES = 120;

/** How often the rider's phone sends its position while they are available. */
export const LOCATION_EVERY_SECONDS = 30;

/** The most a package can be worth for a rider with this balance. */
export function maxPackageValue(balance: number): number {
  return Math.floor((Number(balance) || 0) * VALUE_RATIO);
}

/** The balance needed to carry a package of this value. */
export function balanceNeeded(value: number): number {
  return Math.ceil((Number(value) || 0) / VALUE_RATIO);
}

/* ── Prices ──────────────────────────────────────────────────────────────── */

/**
 * The delivery fee comes from the distance between where the rider collects
 * the parcel (the agency branch, or the sender's spot in the same city) and
 * where it is delivered. The admin sets these in Admin, Agencies.
 */
export interface PickupSettings {
  /** Pickup deliveries are offered on Zola and on pickup.zolahq.com. */
  enabled: boolean;
  /** Fixed part of every delivery. */
  base: number;
  /** Price per km of road. */
  per_km: number;
  /** No delivery costs less than this. */
  min: number;
  /** Roads are longer than a straight line: km by road ≈ straight km × this. */
  road_factor: number;
  /** Share of the delivery fee the rider earns (1 = all of it). */
  rider_share: number;
  /** Highest parcel value accepted. 0 = no limit. */
  max_value: number;
}

export const DEFAULT_SETTINGS: PickupSettings = {
  enabled: false, base: 500, per_km: 150, min: 1000, road_factor: 1.3, rider_share: 1, max_value: 0,
};

/** Road distance in km, estimated from the straight line. */
export function roadKm(a: Point, b: Point, factor = DEFAULT_SETTINGS.road_factor): number {
  return Math.round(distanceKm(a, b) * factor * 10) / 10;
}

/** The delivery fee for a distance, rounded up to the next FCFA 50. */
export function priceForKm(km: number, s: PickupSettings): number {
  const raw = Number(s.base) + Number(s.per_km) * Math.max(0, km);
  return Math.max(Number(s.min) || 0, Math.ceil(raw / 50) * 50);
}

export function quoteDelivery(from: Point, to: Point, s: PickupSettings): { km: number; fee: number } {
  const km = roadKm(from, to, s.road_factor);
  return { km, fee: priceForKm(km, s) };
}

/** What a rider earns for a delivery. */
export function riderPayFor(trade: { delivery_fee?: number }, share = 1): number {
  return Math.max(0, Math.floor((Number(trade.delivery_fee) || 0) * Math.min(1, Math.max(0, share))));
}

/** "same_city": the rider collects from the seller. "out_of_town": the seller sends it by bus agency and the rider collects at the branch. */
export type DeliveryMode = "same_city" | "out_of_town";

/** Where the rider collects the parcel. */
export interface Origin {
  kind: "spot" | "branch";
  lat: number; lng: number;
  city: string;
  /** "Touristique Express, Akwa" or the sender's landmark. */
  label: string;
  landmark?: string;
}

export function branchOrigin(b: any): Origin {
  return { kind: "branch", lat: Number(b.lat), lng: Number(b.lng), city: b.city, label: `${b.agency}, ${b.name}`, landmark: b.address || "" };
}

/** Where the rider collects a delivery's parcel (older deliveries only have a branch). */
export function originOf(d: any): Origin | null {
  if (d?.origin && isPoint(d.origin)) return d.origin;
  if (d?.branch && isPoint(d.branch)) return branchOrigin(d.branch);
  if (d?.dest_branch && isPoint(d.dest_branch)) return branchOrigin(d.dest_branch);
  return null;
}

export interface Point { lat: number; lng: number }

export function isPoint(p: any): p is Point {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;
}

/** Straight-line distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type DeliveryStatus = "awaiting_payment" | "waiting_rider" | "assigned" | "sent" | "collected" | "delivered" | "cancelled";

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; step: number }> = {
  awaiting_payment: { label: "Waiting for payment",     step: 0 },
  waiting_rider: { label: "Finding a rider",            step: 1 },
  assigned:      { label: "Rider assigned",             step: 1 },
  sent:          { label: "On its way with the agency", step: 2 },
  collected:     { label: "With the rider",             step: 3 },
  delivered:     { label: "Delivered",                  step: 4 },
  cancelled:     { label: "Cancelled",                  step: 0 },
};

export const DELIVERY_STEPS = ["Rider assigned", "With the agency", "With the rider", "Delivered"];

/** Pickup's public address, for links in Zola and in emails. */
export function pickupUrl(): string {
  return (process.env.NEXT_PUBLIC_PICKUP_URL || "https://pickup.zolahq.com").replace(/\/+$/, "");
}

/** "Open in Google Maps" for a point: works on any phone, nothing to install. */
export function mapsLink(p: Point): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}
