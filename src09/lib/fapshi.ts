/**
 * Fapshi payments client
 * Docs: https://docs.fapshi.com/en/api-reference/getting-started
 *
 * Auth: two headers, `apiuser` and `apikey` (no bearer token / OAuth step).
 * Base URL differs between sandbox and live -- pick it from FAPSHI_MODE,
 * or auto-detect from the key prefix (sandbox keys start with FAK_TEST_).
 */

function getBaseUrl(): string {
  if (process.env.FAPSHI_MODE === "live") return "https://live.fapshi.com";
  if (process.env.FAPSHI_MODE === "sandbox") return "https://sandbox.fapshi.com";
  // Auto-detect from key prefix if FAPSHI_MODE isn't set
  const key = process.env.FAPSHI_API_KEY || "";
  return key.startsWith("FAK_TEST_") ? "https://sandbox.fapshi.com" : "https://live.fapshi.com";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    apiuser: process.env.FAPSHI_API_USER!,
    apikey:  process.env.FAPSHI_API_KEY!,
  };
}

/**
 * Charge a buyer via mobile money (Direct Pay — pushes a payment
 * prompt straight to their phone, no redirect needed).
 *
 * NOTE: Direct Pay is disabled by default in live mode. Fapshi must
 * enable it for your account first (email support@fapshi.com with
 * your apiuser, site URL, business name, and use case).
 */
export async function chargeMobileMoney(opts: {
  ref:         string;              // your own reference (we send it as externalId)
  amount:      number;
  phone:       string;              // local 9-digit number, starts with 6, NO 237 prefix
  network:     "mtn" | "orange";
  description?: string;
}) {
  try {
    const medium = opts.network === "orange" ? "orange money" : "mobile money";

    // Fapshi requires a whole-number XAF amount (no decimals, not a string)
    const amount = Math.round(Number(opts.amount));
    if (!Number.isFinite(amount) || amount < 100) {
      return { success: false, error: `Amount must be at least 100 XAF (got ${opts.amount})` };
    }
    console.log("[fapshi] direct-pay amount:", amount, "raw:", opts.amount);

    const res = await fetch(`${getBaseUrl()}/direct-pay`, {
      method:  "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        amount,
        phone:      opts.phone,
        medium,
        externalId: opts.ref,
        message:    opts.description,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[fapshi] direct-pay error:", data);
      return { success: false, error: data?.message || "Payment initiation failed" };
    }

    console.log("[fapshi] direct-pay initiated:", JSON.stringify(data));
    return { success: true, transId: data.transId, data };
  } catch (e: any) {
    console.error("[fapshi] direct-pay error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Look up the authoritative status of a transaction directly from
 * Fapshi. Always re-check this server-side before trusting a webhook
 * payload, since Fapshi doesn't sign webhook requests.
 */
export async function getPaymentStatus(transId: string) {
  try {
    const res = await fetch(`${getBaseUrl()}/payment-status/${transId}`, {
      method:  "GET",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[fapshi] payment-status error:", data);
      return { success: false, error: data?.message || "Could not fetch payment status" };
    }
    return { success: true, data };
  } catch (e: any) {
    console.error("[fapshi] payment-status error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Send money to a mobile money wallet (vendor payout).
 */
export async function sendToMobileMoney(opts: {
  ref:         string;
  amount:      number;
  phone:       string;   // local 9-digit number, no 237 prefix
  network:     "mtn" | "orange";
  description?: string;
}) {
  try {
    const medium = opts.network === "orange" ? "orange money" : "mobile money";

    const res = await fetch(`${getBaseUrl()}/payout`, {
      method:  "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        amount:     opts.amount,
        phone:      opts.phone,
        medium,
        externalId: opts.ref,
        message:    opts.description,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[fapshi] payout error:", data);
      return { success: false, error: data?.message || "Payout failed" };
    }

    console.log("[fapshi] payout initiated:", JSON.stringify(data));
    return { success: true, transId: data.transId, data };
  } catch (e: any) {
    console.error("[fapshi] payout error:", e.message);
    return { success: false, error: e.message };
  }
}
