/**
 * Zola presentation helpers.
 * Shared labels, status wording and formatting used across the interface.
 * Nothing here changes how transactions work; it only decides how they read.
 */

import { ReviewFields, reviewState, timeLeft } from "@/lib/review";
import { interpolate, Lang, locale, T } from "@/lib/i18n/core";

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
  // Delivery confirmed by the buyer: 24-hour review before the payment is released
  pending_release: { label: "Under review",    tone: "wait",   step: 4, money: "zola"   },
  complete:        { label: "Completed",       tone: "done",   step: 5, money: "seller" },
  disputed:        { label: "Disputed",        tone: "danger", step: 0, money: "zola"   },
  cancelled:       { label: "Cancelled",       tone: "muted",  step: 0, money: "none"   },
  refunded:        { label: "Refunded",        tone: "muted",  step: 0, money: "buyer"  },
};

export const STEPS = ["Payment", "Held by Zola", "Shipped", "Review", "Completed"];

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

export function fmtDate(iso: string | undefined | null, lang: Lang = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale(lang), { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | undefined | null, lang: Lang = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(locale(lang), {
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
 * Pass the screen's t() so the answers come out in the reader's language.
 */
export function statusStory(
  trade: { status: string; amount: number; buyer_total?: number; buyer_name?: string; vendor_name?: string; needs_delivery?: boolean; delivery_fee?: number; buyer_pending?: boolean } & ReviewFields,
  viewer: ViewerRole,
  now: number = Date.now(),
  t: T = (s, p) => interpolate(s, p),
  lang: Lang = "en"
): StatusStory {
  const held  = money(trade.amount);
  const total = money(trade.buyer_total || trade.amount);
  const buyer  = trade.buyer_name  || t("The buyer");
  const seller = trade.vendor_name || t("The seller");
  const isBuyer  = viewer === "buyer";
  const isSeller = viewer === "seller";
  const isAdmin  = viewer === "admin";
  // Goods go to Zola for delivery; services have nothing to deliver
  const goods = trade.needs_delivery !== undefined ? trade.needs_delivery !== false : Number(trade.delivery_fee) > 0;
  const you = t("You");
  const noOne = t("No one");

  switch (trade.status) {
    case "pending_payment":
      // The buyer was invited and has not created their account yet
      if (trade.buyer_pending) {
        return {
          where: t("The buyer hasn't joined Zola yet, so no money has moved."),
          next: isSeller
            ? t("The buyer creates a Zola account from the invitation we sent, then pays. We'll tell you as soon as they join.")
            : t("The buyer creates a Zola account from the invitation, then pays."),
          who: t("The buyer"),
          yourMove: false,
        };
      }
      return {
        where: isBuyer ? t("You haven't paid yet, so no money has moved.") : t("The buyer hasn't paid yet, so no money has moved."),
        next: isBuyer
          ? t("Pay {total} to Zola. We hold it safely until your order arrives.", { total })
          : t("{buyer} pays Zola. We'll let you know as soon as the payment is secured.", { buyer }),
        who: isBuyer ? you : buyer,
        yourMove: isBuyer,
      };
    case "funds_held":
      return {
        where: isBuyer ? t("Your payment is safely held by Zola.") : t("{held} is safely held by Zola.", { held }),
        next: isBuyer
          ? (goods ? t("The seller sends your order to Zola, and Zola delivers it to you.") : t("The seller needs to complete what you agreed."))
          : isSeller
            ? (goods ? t("Send the item to Zola for delivery, then mark it as sent.") : t("Complete the work, then mark it as delivered."))
            : (goods ? t("The seller sends the item to Zola. Then Zola delivers it to the buyer.") : t("The seller needs to complete the work.")),
        who: isSeller ? you : seller,
        yourMove: isSeller,
      };
    case "shipped":
      return {
        where: isBuyer ? t("Your payment is safely held by Zola.") : t("{held} is safely held by Zola.", { held }),
        next: isBuyer
          ? t("Confirm delivery once your order arrives. You then have 24 hours to tell us if anything is wrong before the seller is paid.")
          : isSeller
            ? (goods
                ? t("Zola is delivering your item. Once the buyer confirms delivery, Zola reviews it for 24 hours and then releases your payment.")
                : t("Once the buyer confirms delivery, Zola reviews it for 24 hours and then releases your payment."))
            : (goods ? t("Deliver the item to the buyer. The buyer confirms once it arrives.") : t("The buyer confirms delivery once the work is done.")),
        who: isBuyer ? you : buyer,
        yourMove: isBuyer,
      };
    case "delivered":
    case "pending_release": {
      const r = reviewState(trade, now);
      const until = r.endsAt ? fmtDateTime(r.endsAt, lang) : "";
      const where = isBuyer
        ? t("Your payment is still held by Zola while this transaction is under review.")
        : isSeller
          ? t("Zola is still holding your payment while this transaction is under review.")
          : t("{held} is held by Zola while this transaction is under review.", { held });

      // The buyer said something is wrong
      if (r.complaintOpen) {
        return {
          where,
          next: isBuyer
            ? t("Zola is looking into your complaint and will call or text you. The seller is not paid until it is settled.")
            : isSeller
              ? t("The buyer reported a problem with this order. Your payment stays held while Zola looks into it. We may call or text you.")
              : t("Call or text the buyer about their complaint, settle it, then mark it as resolved."),
          who: isAdmin ? you : "Zola",
          yourMove: isAdmin,
        };
      }

      // Still inside the 24 hours
      if (r.windowOpen) {
        return {
          where,
          next: isBuyer
            ? t("You have until {until} to tell us if something is wrong. Zola may call or text you to check. After that, the seller is paid.", { until })
            : isSeller
              ? t("The buyer confirmed delivery. Zola checks with the buyer and releases your payment after {until}.", { until })
              : r.contacted
                ? t("The buyer has been contacted. You can release {held} to {seller} after {until} ({left} left).", { held, seller, until, left: timeLeft(r.msLeft, lang) })
                : t("Call or text the buyer to check the order arrived as agreed. You can release {held} to {seller} after {until}.", { held, seller, until }),
          who: isAdmin ? you : "Zola",
          yourMove: isAdmin && !r.contacted,
        };
      }

      // Review over (or a transaction confirmed before reviews existed)
      return {
        where: isSeller ? t("Zola is holding your payment and getting it ready for release.") : t("{held} is with Zola, ready to be released.", { held }),
        next: isBuyer
          ? t("The review is over. Your payment is being sent to the seller.")
          : isSeller
            ? t("The review is over. Your payment is being released to you.")
            : r.canRelease
              ? t("The review is over. Release {held} to {seller}.", { held, seller })
              : t("Call or text the buyer, mark them as contacted, then release {held} to {seller}.", { held, seller }),
        who: isAdmin ? you : "Zola",
        yourMove: isAdmin,
      };
    }
    case "complete":
      return {
        where: isSeller ? t("{held} has been released to you.", { held }) : t("{held} has been released to the seller.", { held }),
        next: isSeller ? t("You can withdraw your funds from your wallet.") : t("Nothing more to do. This transaction is complete."),
        who: noOne,
        yourMove: false,
      };
    case "disputed":
      return {
        where: t("{held} stays held by Zola while the dispute is reviewed.", { held }),
        next: isAdmin ? t("Review this transaction with the buyer and the seller.") : t("Zola is reviewing this transaction."),
        who: isAdmin ? you : "Zola",
        yourMove: isAdmin,
      };
    case "refunded":
      return {
        where: t("The payment has been returned to the buyer."),
        next: t("Nothing more to do."),
        who: noOne,
        yourMove: false,
      };
    default:
      return {
        where: t("This transaction was cancelled. No money is being held for it."),
        next: t("Nothing more to do."),
        who: noOne,
        yourMove: false,
      };
  }
}
