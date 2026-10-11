/**
 * What a transaction costs. Change the numbers here and every screen,
 * email and calculation follows.
 *
 * The buyer pays:  item price + Zola fee (8%, or 5% above FCFA 50,000) + standard delivery
 *                  (delivery only when the seller says there is something to deliver).
 * The seller receives the full item price.
 */

/**
 * Zola's fee, as a share of the item price.
 *
 *   item price up to FCFA 50,000   -> 8%
 *   item price above FCFA 50,000   -> 5%
 *
 * The rate applies to the whole item price (it is not 8% on the first 50,000
 * and 5% on the rest). An item at exactly 50,000 pays 8%.
 */
export const FEE_THRESHOLD = 50000;
export const FEE_RATE_STANDARD = 0.08;   // up to the threshold
export const FEE_RATE_LARGE    = 0.05;   // above the threshold

/** The rate that applies to an item of this price. */
export function feeRate(amount: number): number {
  return (Number(amount) || 0) > FEE_THRESHOLD ? FEE_RATE_LARGE : FEE_RATE_STANDARD;
}

const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;

/** "8%" or "5%", for an item of this price. */
export function feePercentLabel(amount: number): string {
  return pct(feeRate(amount));
}

export const FEE_STANDARD_LABEL  = pct(FEE_RATE_STANDARD);
export const FEE_LARGE_LABEL     = pct(FEE_RATE_LARGE);
export const FEE_THRESHOLD_LABEL = `FCFA ${FEE_THRESHOLD.toLocaleString("en-US")}`;

/** One sentence that explains the fee, used on the home page, Help and signup. */
export const FEE_SUMMARY =
  `Zola charges ${FEE_STANDARD_LABEL} of the item price, or ${FEE_LARGE_LABEL} when the item costs more than ${FEE_THRESHOLD_LABEL}.`;

/** Standard delivery, in FCFA, added when a transaction needs delivery. */
export const DELIVERY_FEE = 1000;

export interface Quote {
  amount: number;       // item price, what the seller receives
  fee: number;          // Zola fee
  deliveryFee: number;  // standard delivery
  total: number;        // what the buyer pays
}

/**
 * `withDelivery` is false for services and anything else with nothing to
 * deliver: no delivery fee is added.
 */
export function quote(amount: number, withDelivery = true): Quote {
  const price       = Number(amount) || 0;
  const fee         = parseFloat((price * feeRate(price)).toFixed(2));
  const deliveryFee = withDelivery ? DELIVERY_FEE : 0;
  const total       = parseFloat((price + fee + deliveryFee).toFixed(2));
  return { amount: price, fee, deliveryFee, total };
}

/**
 * The fee percentage a stored transaction was actually charged, for display.
 * Transactions created before a price change keep the rate they were created with.
 */
export function feePercentOf(trade: { amount?: number; fee?: number }): string {
  const amount = Number(trade.amount) || 0;
  const fee    = Number(trade.fee) || 0;
  if (!amount) return FEE_STANDARD_LABEL;
  return `${+((fee / amount) * 100).toFixed(1)}%`;
}

/** The delivery note shown wherever the delivery fee appears. */
export const DELIVERY_NOTE =
  `Delivery is FCFA ${DELIVERY_FEE.toLocaleString("en-US")} for a standard delivery. ` +
  `If your item costs more than that to deliver, you will have to pay the difference.`;
