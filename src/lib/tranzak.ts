import TRANZAK from "tranzak-node";

let _client: any = null;

export function getTranzak() {
  if (!_client) {
    _client = new TRANZAK({
      appId:  process.env.TRANZAK_APP_ID!,
      appKey: process.env.TRANZAK_APP_KEY!,
      mode:   (process.env.TRANZAK_MODE as any) || "sandbox",
    });
  }
  return _client;
}

/**
 * Charge a buyer via mobile money (USSD push — no redirect needed)
 */
export async function chargeMobileMoney(opts: {
  ref:         string;   // unique reference (trade ID)
  amount:      number;
  phone:       string;   // e.g. "237671234567"
  description: string;
}) {
  try {
    const client = getTranzak();
    const tx = await client.payment.collection.simple.chargeMobileMoney({
      amount:            opts.amount,
      currencyCode:      "XAF",
      description:       opts.description,
      payerNote:         opts.description,
      mchTransactionRef: opts.ref,
      mobileWalletNumber: opts.phone,
    });

    console.log("[tranzak] chargeMobileMoney initiated:", JSON.stringify(tx?.data));
    return { success: true, tx };
  } catch (e: any) {
    console.error("[tranzak] chargeMobileMoney error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Send money to a mobile money wallet (vendor payout)
 */
export async function sendToMobileMoney(opts: {
  ref:         string;
  amount:      number;
  phone:       string;   // e.g. "237671234567"
  description: string;
}) {
  try {
    const client = getTranzak();
    const tx = await client.payment.transfer.simple.toMobileMoney({
      payeeAccountId:     opts.phone,
      amount:             opts.amount,
      currencyCode:       "XAF",
      customTransactionRef: opts.ref,
      description:        opts.description,
      payeeNote:          opts.description,
    });

    console.log("[tranzak] sendToMobileMoney initiated:", JSON.stringify(tx?.data));
    return { success: true, tx };
  } catch (e: any) {
    console.error("[tranzak] sendToMobileMoney error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Process an incoming webhook payload
 * Returns true if valid, false if fake
 */
export async function processWebhook(body: any) {
  try {
    const client = getTranzak();
    const status = await client.webhook.process(body);
    return status;
  } catch (e: any) {
    console.error("[tranzak] webhook process error:", e.message);
    return false;
  }
}
