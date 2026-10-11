/**
 * How goods travel on Zola.
 *
 * The seller does not send the item straight to the buyer. The seller hands
 * it to Zola, and Zola delivers it. The buyer pays for that delivery (and the
 * Zola fee); the seller pays nothing and receives the full item price.
 *
 * Services and anything else with nothing to deliver skip all of this.
 */
import { SUPPORT } from "@/lib/support";

/**
 * Where sellers hand items over. Leave empty until there is a fixed place;
 * sellers are then told to contact Zola to arrange it.
 * Example: "Zola desk, Carrefour Bastos, Yaoundé, Monday to Saturday 8am to 6pm"
 */
export const DROP_OFF = "";

/** How a seller gets the item to Zola. */
export function handoverHow(): string {
  return DROP_OFF
    ? `Bring it to ${DROP_OFF}.`
    : `WhatsApp ${SUPPORT.whatsapp} or call ${SUPPORT.phone} to arrange the hand-over.`;
}

export const HANDOVER_SELLER =
  "You send the item to Zola, not straight to the buyer. Zola delivers it. The buyer pays for delivery and the Zola fee, so you pay nothing.";

export const HANDOVER_BUYER =
  "The seller sends your order to Zola, and Zola delivers it to you.";
