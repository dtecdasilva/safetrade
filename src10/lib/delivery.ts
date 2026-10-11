/**
 * Delivery tracking lives on a separate delivery platform.
 *
 * Until that site exists, Zola sends people to the built-in tracking page at
 * /delivery/<transaction id>. When the real site is live, set
 *   NEXT_PUBLIC_DELIVERY_URL=https://your-delivery-site.com
 * and Zola will send people to  <that address>/track/<transaction id>  instead.
 */

/** Placeholder name for the delivery company. Change it here once it has a real one. */
export const DELIVERY_COMPANY = "Dispatch";

export function deliveryTrackingUrl(tradeId: string): string {
  const base = (process.env.NEXT_PUBLIC_DELIVERY_URL || "").replace(/\/+$/, "");
  return base ? `${base}/track/${tradeId}` : `/delivery/${tradeId}`;
}

/** The reference shown to the customer on the delivery side. */
export function trackingNumber(tradeId: string | undefined): string {
  return `DP-${(tradeId || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
