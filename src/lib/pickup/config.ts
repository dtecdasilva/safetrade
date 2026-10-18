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

/** What a rider earns for a delivery: the delivery fee the buyer paid. */
export function riderPayFor(trade: { delivery_fee?: number }): number {
  return Math.max(0, Number(trade.delivery_fee) || 0);
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

export type DeliveryStatus = "waiting_rider" | "assigned" | "sent" | "collected" | "delivered" | "cancelled";

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; step: number }> = {
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
