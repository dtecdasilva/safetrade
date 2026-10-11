const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ADMIN_PHONE = process.env.WHATSAPP_ADMIN_PHONE || "237671543308";
const API_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

function fmt(phone: string): string {
  // Strip spaces, dashes, plus signs and ensure country code
  const clean = phone.replace(/[\s\-\+]/g, "");
  if (clean.startsWith("237")) return clean;
  if (clean.startsWith("6") && clean.length === 9) return `237${clean}`;
  return clean;
}

async function send(to: string, template: string, components: any[] = []) {
  const phone = fmt(to);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: components.length > 0 ? components : undefined,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[whatsapp] Failed to send "${template}" to ${phone}:`, JSON.stringify(data));
      return { success: false, error: data?.error?.message || "Unknown error" };
    }
    console.log(`[whatsapp] Sent "${template}" to ${phone}`);
    return { success: true };
  } catch (e: any) {
    console.error(`[whatsapp] Exception sending "${template}" to ${phone}:`, e.message);
    return { success: false, error: e.message };
  }
}

function params(values: string[]) {
  return [{
    type: "body",
    parameters: values.map(v => ({ type: "text", text: v })),
  }];
}

// ── Notify buyer: a vendor created a trade for them ──────────────────────────
export async function notifyBuyerTradeCreated(opts: {
  buyerPhone: string;
  buyerName: string;
  vendorName: string;
  title: string;
  amount: number;
  tradeId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
  return send(opts.buyerPhone, "trade_created", params([
    opts.buyerName,
    opts.vendorName,
    opts.title,
    `FCFA ${opts.amount.toLocaleString()}`,
    `${appUrl}/trade/${opts.tradeId}`,
  ]));
}

// ── Notify vendor: buyer paid ─────────────────────────────────────────────────
export async function notifyVendorPaymentReceived(opts: {
  vendorPhone: string;
  vendorName: string;
  buyerName: string;
  title: string;
  amount: number;
  tradeId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
  return send(opts.vendorPhone, "payment_received", params([
    opts.vendorName,
    opts.buyerName,
    opts.title,
    `FCFA ${opts.amount.toLocaleString()}`,
    `${appUrl}/trade/${opts.tradeId}`,
  ]));
}

// ── Notify buyer: vendor shipped ──────────────────────────────────────────────
export async function notifyBuyerItemShipped(opts: {
  buyerPhone: string;
  buyerName: string;
  vendorName: string;
  title: string;
  tradeId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
  return send(opts.buyerPhone, "item_shipped", params([
    opts.buyerName,
    opts.vendorName,
    opts.title,
    `${appUrl}/trade/${opts.tradeId}`,
  ]));
}

// ── Notify vendor: buyer confirmed delivery ───────────────────────────────────
export async function notifyVendorDeliveryConfirmed(opts: {
  vendorPhone: string;
  vendorName: string;
  buyerName: string;
  title: string;
  amount: number;
  tradeId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
  return send(opts.vendorPhone, "delivery_confirmed", params([
    opts.vendorName,
    opts.buyerName,
    opts.title,
    `FCFA ${opts.amount.toLocaleString()}`,
    `${appUrl}/trade/${opts.tradeId}`,
  ]));
}

// ── Notify vendor: funds released ─────────────────────────────────────────────
export async function notifyVendorFundsReleased(opts: {
  vendorPhone: string;
  vendorName: string;
  title: string;
  amount: number;
}) {
  return send(opts.vendorPhone, "funds_released", params([
    opts.vendorName,
    opts.title,
    `FCFA ${opts.amount.toLocaleString()}`,
  ]));
}

// ── Notify admin: withdrawal requested ───────────────────────────────────────
export async function notifyAdminWithdrawalRequested(opts: {
  vendorName: string;
  amount: number;
  phone: string;
  network: string;
}) {
  return send(ADMIN_PHONE, "withdrawal_requested", params([
    opts.vendorName,
    `FCFA ${opts.amount.toLocaleString()}`,
    opts.network,
    `+237${opts.phone}`,
  ]));
}

// ── Notify vendor: withdrawal sent ────────────────────────────────────────────
export async function notifyVendorWithdrawalSent(opts: {
  vendorPhone: string;
  vendorName: string;
  amount: number;
  network: string;
}) {
  return send(opts.vendorPhone, "withdrawal_sent", params([
    opts.vendorName,
    `FCFA ${opts.amount.toLocaleString()}`,
    opts.network,
  ]));
}

// ── Notify admin: new trade created ──────────────────────────────────────────
export async function notifyAdminTradeCreated(opts: {
  vendorName: string;
  buyerName: string;
  title: string;
  amount: number;
  tradeId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
  return send(ADMIN_PHONE, "admin_trade_created", params([
    opts.vendorName,
    opts.buyerName,
    opts.title,
    `FCFA ${opts.amount.toLocaleString()}`,
    `${appUrl}/trade/${opts.tradeId}`,
  ]));
}

// ── Notify admin: funds release needed ───────────────────────────────────────
export async function notifyAdminReleaseNeeded(opts: {
  buyerName: string;
  vendorName: string;
  title: string;
  amount: number;
  tradeId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
  return send(ADMIN_PHONE, "release_needed", params([
    opts.buyerName,
    opts.vendorName,
    opts.title,
    `FCFA ${opts.amount.toLocaleString()}`,
    `${appUrl}/admin`,
  ]));
}
