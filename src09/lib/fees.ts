/**
 * What a transaction costs. Change the numbers here and every screen,
 * email and calculation follows.
 *
 * The buyer pays:  item price + Zola fee (a percentage) + standard delivery
 *                  (delivery only when the seller says there is something to deliver).
 * The seller receives the full item price.
 */

/** Zola's fee, as a share of the item price. 0.05 = 5%. */
export const FEE_RATE = 0.05;

/** Standard delivery, in FCFA, added when a transaction needs delivery. */
export const DELIVERY_FEE = 1000;

export const FEE_PERCENT_LABEL = `${+(FEE_RATE * 100).toFixed(2)}%`;

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
  const fee         = parseFloat((price * FEE_RATE).toFixed(2));
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
  if (!amount) return FEE_PERCENT_LABEL;
  return `${+((fee / amount) * 100).toFixed(1)}%`;
}

/** The delivery note shown wherever the delivery fee appears. */
export const DELIVERY_NOTE =
  `Delivery is FCFA ${DELIVERY_FEE.toLocaleString("en-US")} for a standard delivery. ` +
  `If your item costs more than that to deliver, you will have to pay the difference.`;
