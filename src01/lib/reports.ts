/**
 * Reports about sellers, and the admin's flag.
 *
 * A buyer can report the seller of any transaction they were part of, at any
 * time, including after it is completed. Reports go to the admin, never to the
 * seller, and one buyer can report one transaction once.
 *
 * The admin reviews reports and can flag a seller (users.flagged = true).
 * While a seller is flagged, buyers see a warning on every transaction with
 * them. The flag is a warning only: the seller can still use Zola.
 *
 * Stored in the "reports" collection, document id "<tradeId>_<reporterId>".
 *
 * This file has no server-only code, so screens and API routes share it.
 */

export const REPORT_REASONS = [
  { key: "not_as_described", label: "The item wasn't what was agreed" },
  { key: "not_delivered",    label: "I never received it" },
  { key: "outside_payment",  label: "They asked me to pay outside Zola" },
  { key: "fake",             label: "Fake or counterfeit item" },
  { key: "behaviour",        label: "Rude, threatening or dishonest" },
  { key: "other",            label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

export const REPORT_MIN = 10;
export const REPORT_MAX = 1000;

export function reportReasonLabel(key: string): string {
  return REPORT_REASONS.find((r) => r.key === key)?.label || "Something else";
}

export function reportId(tradeId: string, reporterId: string): string {
  return `${tradeId}_${reporterId}`;
}

/** A transaction whose seller can be reported: there is a real seller on it. */
export function canReportSeller(trade: { vendor_id?: string; vendor_pending?: boolean }): boolean {
  return !!trade.vendor_id && !trade.vendor_pending && !String(trade.vendor_id).startsWith("invited:");
}
