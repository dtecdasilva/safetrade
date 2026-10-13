/**
 * The review that follows "Confirm delivery".
 *
 * When the buyer confirms delivery the payment is not released straight
 * away. The transaction is under review for 24 hours:
 *
 *   - the buyer can still make a complaint if something is wrong,
 *   - Zola calls or texts the buyer to check,
 *   - once the 24 hours are over, the buyer has been contacted and there is
 *     no open complaint, Zola releases the payment to the seller.
 *
 * The stored status stays "pending_release" the whole time, so nothing else
 * in the app (payments, webhooks, wallet balances) had to change.
 *
 * Fields kept on the transaction:
 *   confirmed_at            when the buyer confirmed delivery
 *   review_ends_at          confirmed_at + 24 hours
 *   review_contacted_at/by  when an admin logged that they called or texted the buyer
 *   complaint_text/at       what the buyer said was wrong, and when
 *   complaint_status        "open" until an admin marks it "resolved"
 *   complaint_resolution    the admin's note on how it was settled
 *
 * This file has no server-only code, so screens and API routes share it.
 */

export const REVIEW_HOURS = 24;
const HOUR = 60 * 60 * 1000;

export const COMPLAINT_MIN = 10;
export const COMPLAINT_MAX = 1000;

export interface ReviewFields {
  status?: string;
  confirmed_at?: string | null;
  review_ends_at?: string | null;
  review_contacted_at?: string | null;
  complaint_text?: string | null;
  complaint_at?: string | null;
  complaint_status?: string | null;
}

export interface ReviewState {
  /** The transaction is in the review step at all. */
  inReview: boolean;
  /** When the 24 hours end (ISO). Empty for transactions confirmed before this step existed. */
  endsAt: string;
  /** The 24 hours are still running. */
  windowOpen: boolean;
  msLeft: number;
  hasComplaint: boolean;
  complaintOpen: boolean;
  complaintResolved: boolean;
  /** An admin has logged a call or text to the buyer. */
  contacted: boolean;
  /** The buyer may still make a complaint. */
  canComplain: boolean;
  /** Why the payment can't be released yet. Empty when it can. */
  blockers: string[];
  canRelease: boolean;
}

/** ISO time at which a review that started at `confirmedAt` ends. */
export function reviewEnd(confirmedAt: string | number | Date): string {
  return new Date(new Date(confirmedAt).getTime() + REVIEW_HOURS * HOUR).toISOString();
}

export function reviewState(trade: ReviewFields, now: number = Date.now()): ReviewState {
  const inReview = trade.status === "pending_release";

  const confirmed = trade.confirmed_at ? Date.parse(trade.confirmed_at) : NaN;
  const stored    = trade.review_ends_at ? Date.parse(trade.review_ends_at) : NaN;
  const end       = !isNaN(stored) ? stored : !isNaN(confirmed) ? confirmed + REVIEW_HOURS * HOUR : NaN;
  // Transactions confirmed before the review step existed have no start time:
  // they are treated as already reviewed so they can still be released.
  const timed     = !isNaN(end);

  const msLeft     = timed ? Math.max(0, end - now) : 0;
  const windowOpen = inReview && timed && msLeft > 0;

  const hasComplaint      = !!trade.complaint_at;
  const complaintOpen     = hasComplaint && trade.complaint_status !== "resolved";
  const complaintResolved = hasComplaint && trade.complaint_status === "resolved";
  const contacted         = !!trade.review_contacted_at;

  const blockers: string[] = [];
  if (inReview) {
    if (complaintOpen) blockers.push("The buyer's complaint is still open.");
    if (timed && !contacted) blockers.push("Call or text the buyer first, then mark them as contacted.");
    if (windowOpen) blockers.push(`The 24-hour review is still running (${timeLeft(msLeft)} left).`);
  }

  return {
    inReview,
    endsAt: timed ? new Date(end).toISOString() : "",
    windowOpen,
    msLeft,
    hasComplaint,
    complaintOpen,
    complaintResolved,
    contacted,
    canComplain: inReview && windowOpen && !hasComplaint,
    blockers,
    canRelease: inReview && blockers.length === 0,
  };
}

/** "23 hours", "1 hour", "40 minutes", "less than a minute" (or in French). */
export function timeLeft(ms: number, lang: "en" | "fr" = "en"): string {
  const fr = lang === "fr";
  if (ms <= 0) return fr ? "plus de temps" : "no time";
  const mins = Math.ceil(ms / 60000);
  if (mins < 2) return fr ? "moins d'une minute" : "less than a minute";
  if (mins < 60) return fr ? `${mins} minutes` : `${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (fr) return hours === 1 ? "1 heure" : `${hours} heures`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** Short label for lists and pills: what "under review" means right now. */
export function reviewLabel(trade: ReviewFields, now: number = Date.now()): string {
  const r = reviewState(trade, now);
  if (!r.inReview) return "";
  if (r.complaintOpen) return "Complaint open";
  if (r.windowOpen) return `Review ends in ${timeLeft(r.msLeft)}`;
  return "Review finished";
}
