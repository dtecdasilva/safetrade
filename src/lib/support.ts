/**
 * Zola customer service contacts, and helpers for turning a stored phone
 * number into call / WhatsApp / SMS links.
 *
 * Change the two numbers here and they update everywhere: the Help page,
 * the footer, transaction screens, the offline page copy and every email.
 */

const COUNTRY = "237";

/** Group a 9-digit local number as 671 543 308. */
function spaced(local: string): string {
  return local.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

const WHATSAPP_LOCAL = "671543308";
const PHONE_LOCAL    = "671534224";

export const SUPPORT = {
  /** WhatsApp chat with customer service. */
  whatsapp:        `+${COUNTRY} ${spaced(WHATSAPP_LOCAL)}`,
  whatsappUrl:     `https://wa.me/${COUNTRY}${WHATSAPP_LOCAL}`,
  /** Voice calls to customer service. */
  phone:           `+${COUNTRY} ${spaced(PHONE_LOCAL)}`,
  phoneUrl:        `tel:+${COUNTRY}${PHONE_LOCAL}`,
};

/** One-line version for emails and plain-text messages. */
export const SUPPORT_LINE = `Need help? WhatsApp ${SUPPORT.whatsapp} or call ${SUPPORT.phone}.`;
export const SUPPORT_LINE_FR = `Besoin d'aide ? WhatsApp ${SUPPORT.whatsapp} ou appelez le ${SUPPORT.phone}.`;
export const supportLine = (lang: "en" | "fr" = "en") => (lang === "fr" ? SUPPORT_LINE_FR : SUPPORT_LINE);

/** Digits only, with the country code: 671543308 -> 237671543308. */
export function intlDigits(phone: string | undefined | null): string {
  const d = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  return d.startsWith(COUNTRY) && d.length > 9 ? d : `${COUNTRY}${d}`;
}

/** +237 671 543 308, for showing a stored number to a person. */
export function prettyPhone(phone: string | undefined | null): string {
  const d = intlDigits(phone);
  if (!d) return "";
  return `+${COUNTRY} ${spaced(d.slice(COUNTRY.length))}`;
}

/** Links for reaching someone from a phone: call, WhatsApp and SMS. */
export function contactLinks(phone: string | undefined | null) {
  const d = intlDigits(phone);
  if (!d) return null;
  return {
    display:  prettyPhone(phone),
    call:     `tel:+${d}`,
    whatsapp: `https://wa.me/${d}`,
    sms:      `sms:+${d}`,
  };
}

/** Public address of the site, used for links inside emails. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.zolahq.com").replace(/\/+$/, "");
}
