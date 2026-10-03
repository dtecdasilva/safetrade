/**
 * Zola presentation helpers.
 * Shared labels, status wording and formatting used across the interface.
 * Nothing here changes how transactions work; it only decides how they read.
 */

export const BRAND = {
  name: "Zola",
  tagline: "Secure transactions. Simple payments.",
  promise: "Buy and sell online with confidence.",
  summary:
    "Zola protects both buyers and sellers by securely holding payment until the transaction is completed.",
};

export type Tone = "ok" | "wait" | "info" | "done" | "danger" | "muted";
export type MoneyAt = "buyer" | "zola" | "seller" | "none";
export type ViewerRole = "buyer" | "seller" | "admin";

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** Position in the 5-step progress bar (0 = not on the normal path). */
  step: number;
  /** Who is holding the money at this point. */
  money: MoneyAt;
}

/** Keys are the existing transaction statuses stored in the database. */
export const STATUS: Record<string, StatusMeta> = {
  pending_payment: { label: "Payment pending", tone: "wait",   step: 1, money: "buyer"  },
  funds_held:      { label: "Paid",            tone: "ok",     step: 2, money: "zola"   },
  shipped:         { label: "Shipped",         tone: "info",   step: 3, money: "zola"   },
  delivered:       { label: "Delivered",       tone: "ok",     step: 4, money: "zola"   },
  pending_release: { label: "Delivered",       tone: "ok",     step: 4, money: "zola"   },
  complete:        { label: "Completed",       tone: "done",   step: 5, money: "seller" },
  disputed:        { label: "Disputed",        tone: "danger", step: 0, money: "zola"   },
  cancelled:       { label: "Cancelled",       tone: "muted",  step: 0, money: "none"   },
  refunded:        { label: "Refunded",        tone: "muted",  step: 0, money: "buyer"  },
};

export const STEPS = ["Payment", "Held by Zola", "Shipped", "Delivered", "Completed"];

export function statusMeta(status: string): StatusMeta {
  return STATUS[status] || STATUS.cancelled;
}

export const WITHDRAWAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending:  { label: "Pending",  tone: "wait"   },
  sent:     { label: "Sent",     tone: "ok"     },
  rejected: { label: "Rejected", tone: "danger" },
};

/** "vendor" is the stored role name; people see "Seller". */
export function roleLabel(role: string): string {
  if (role === "vendor") return "Seller";
  if (role === "buyer") return "Buyer";
  if (role === "admin") return "Admin";
  return role;
}

export function money(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  // Non-breaking space keeps the currency and the figure on one line.
  return `FCFA\u00A0${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function shortId(id: string | undefined): string {
  return (id || "").slice(0, 8).toUpperCase();
}

export function initials(name: string | undefined, fallback = ""): string {
  if (fallback) return fallback;
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Older activity entries were written before the rebrand. This keeps the
 * previous product name and its jargon from showing up in the interface.
 */
export function brandText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/raised a dispute\. SafeTrade referee notified\.?/gi, "opened a dispute. Zola is reviewing this transaction.")
    .replace(/received and locked in escrow\b(?! vault)/gi, "received and safely held by Zola")
    .replace(/locked in escrow vault/gi, "safely held by Zola")
    .replace(/Awaiting admin approval to release funds/gi, "Zola is releasing the payment to the seller")
    .replace(/released to vendor by admin/gi, "released to the seller")
    .replace(/\bFunds released\b/g, "Payment released")
    .replace(/\bTrade created\b/g, "Transaction created")
    .replace(/created the trade for/g, "created this transaction for")
    .replace(/Vendor has shipped the item/g, "The seller has shipped the order")
    .replace(/\bDelivery confirmed by buyer\b/g, "Delivery confirmed")
    .replace(/Safe[\s-]?Trade/gi, "Zola");
}

export interface StatusStory {
  /** Where is the money? */
  where: string;
  /** What happens next? */
  next: string;
  /** Who needs to take action? */
  who: string;
  /** True when the person looking at the screen is the one who must act. */
  yourMove: boolean;
}

/**
 * Plain-language answers to the three questions every transaction screen
 * must answer: where the money is, what happens next, and who acts.
 */
export function statusStory(
  trade: { status: string; amount: number; buyer_total?: number; buyer_name?: string; vendor_name?: string },
  viewer: ViewerRole
): StatusStory {
  const held  = money(trade.amount);
  const total = money(trade.buyer_total || trade.amount);
  const buyer  = trade.buyer_name  || "The buyer";
  const seller = trade.vendor_name || "The seller";
  const isBuyer  = viewer === "buyer";
  const isSeller = viewer === "seller";
  const isAdmin  = viewer === "admin";

  switch (trade.status) {
    case "pending_payment":
      return {
        where: isBuyer ? "You haven't paid yet, so no money has moved." : "The buyer hasn't paid yet, so no money has moved.",
        next: isBuyer
          ? `Pay ${total} to Zola. We hold it safely until your order arrives.`
          : `${buyer} pays Zola. We'll let you know as soon as the payment is secured.`,
        who: isBuyer ? "You" : buyer,
        yourMove: isBuyer,
      };
    case "funds_held":
      return {
        where: isBuyer ? "Your payment is safely held by Zola." : `${held} is safely held by Zola.`,
        next: isBuyer
          ? "The seller needs to ship your order."
          : isSeller
            ? "Deliver the order, then mark it as shipped."
            : "The seller needs to deliver the order.",
        who: isSeller ? "You" : seller,
        yourMove: isSeller,
      };
    case "shipped":
      return {
        where: isBuyer ? "Your payment is safely held by Zola." : `${held} is safely held by Zola.`,
        next: isBuyer
          ? "Confirm delivery once your order arrives. Zola then releases the payment to the seller."
          : isSeller
            ? "Your order is on its way. Once the buyer confirms delivery, Zola releases your payment."
            : "The buyer confirms delivery once the order arrives.",
        who: isBuyer ? "You" : buyer,
        yourMove: isBuyer,
      };
    case "delivered":
    case "pending_release":
      return {
        where: isSeller ? "Zola is holding your payment and getting it ready for release." : `${held} is with Zola, ready to be released.`,
        next: isBuyer
          ? "Your payment is being sent to the seller."
          : isSeller
            ? "Your payment is being released to you."
            : `Release ${held} to ${seller}.`,
        who: isAdmin ? "You" : "Zola",
        yourMove: isAdmin,
      };
    case "complete":
      return {
        where: isSeller ? `${held} has been released to you.` : `${held} has been released to the seller.`,
        next: isSeller ? "You can withdraw your funds from your wallet." : "Nothing more to do. This transaction is complete.",
        who: "No one",
        yourMove: false,
      };
    case "disputed":
      return {
        where: `${held} stays held by Zola while the dispute is reviewed.`,
        next: isAdmin ? "Review this transaction with the buyer and the seller." : "Zola is reviewing this transaction.",
        who: isAdmin ? "You" : "Zola",
        yourMove: isAdmin,
      };
    case "refunded":
      return {
        where: "The payment has been returned to the buyer.",
        next: "Nothing more to do.",
        who: "No one",
        yourMove: false,
      };
    default:
      return {
        where: "This transaction was cancelled. No money is being held for it.",
        next: "Nothing more to do.",
        who: "No one",
        yourMove: false,
      };
  }
}
