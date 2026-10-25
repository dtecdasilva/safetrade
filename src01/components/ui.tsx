"use client";
import React from "react";
import { User, Store, Check } from "lucide-react";
import { ZolaMark } from "@/components/Logo";
import { MoneyAt, STEPS, Tone, fmtDateTime, statusMeta } from "@/lib/zola";
import { useT } from "@/components/I18n";
import { translateEventText } from "@/lib/i18n/events";

/* ── Status pill ─────────────────────────────────────────────────────────── */

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useT();
  const s = statusMeta(status);
  return <Pill tone={s.tone}>{t(s.label)}</Pill>;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>
  );
}

/* ── Phone field with country prefix ─────────────────────────────────────── */

export function PhoneField(props: {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  prefix?: string;
}) {
  const { value, onChange, disabled, required, id, prefix = "+237" } = props;
  return (
    <div className="phone">
      <span className="phone-prefix">{prefix}</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="6XXXXXXXX"
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
      />
    </div>
  );
}

/* ── Money rail: Buyer → Zola → Seller ───────────────────────────────────── */

export function MoneyRail({
  at,
  you,
  mini = false,
  names,
}: {
  /** Who is holding the money right now. */
  at: MoneyAt;
  /** Marks one side as "You". */
  you?: "buyer" | "seller";
  mini?: boolean;
  names?: { buyer?: string; seller?: string };
}) {
  const { t } = useT();
  const paid     = at === "zola" || at === "seller";
  const released = at === "seller";

  const buyerState  = at === "buyer" ? "is-waiting" : paid ? "is-passed" : "";
  const zolaState   = at === "zola" ? "is-here" : released ? "is-passed" : "";
  const sellerState = released ? "is-here" : "";

  const icon = mini ? 14 : 19;
  const label = (side: "buyer" | "seller", fallback: string) =>
    you === side ? t("You") : names?.[side] || t(fallback);

  const summary =
    at === "zola" ? t("The money is with Zola")
    : at === "seller" ? t("The money is with the seller")
    : at === "buyer" ? t("The money is still with the buyer")
    : t("No money is being held");

  return (
    <div className={`rail${mini ? " rail-mini" : ""}`} role="img" aria-label={summary}>
      <div className={`rail-node ${buyerState}`}>
        <span className="rail-dot"><User size={icon} strokeWidth={2} /></span>
        <span className="rail-name">{label("buyer", "Buyer")}</span>
        {!mini && (you === "buyer" || names?.buyer) && <span className="rail-note">{t("Buyer")}</span>}
      </div>
      <div className={`rail-link${paid ? " is-done" : ""}`} />
      <div className={`rail-node ${zolaState}`}>
        <span className="rail-dot"><ZolaMark size={mini ? 15 : 22} color="currentColor" /></span>
        <span className="rail-name">Zola</span>
      </div>
      <div className={`rail-link${released ? " is-done" : ""}`} />
      <div className={`rail-node ${sellerState}`}>
        <span className="rail-dot"><Store size={icon} strokeWidth={2} /></span>
        <span className="rail-name">{label("seller", "Seller")}</span>
        {!mini && (you === "seller" || names?.seller) && <span className="rail-note">{t("Seller")}</span>}
      </div>
    </div>
  );
}

/* ── Progress steps ──────────────────────────────────────────────────────── */

export function Steps({ step }: { step: number }) {
  const { t } = useT();
  if (step <= 0) return null;
  return (
    <ol className="steps" aria-label={t("Transaction progress")}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = step > n || step === STEPS.length;
        const active = step === n && !done;
        return (
          <li
            key={label}
            className={`step${done ? " is-done" : active ? " is-active" : ""}`}
            aria-current={active ? "step" : undefined}
          >
            <span className="step-dot">{done ? <Check size={13} strokeWidth={3} /> : n}</span>
            <span className="step-label">{t(label)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Activity timeline ───────────────────────────────────────────────────── */

export interface TimelineEvent {
  id: string;
  label: string;
  detail?: string;
  type?: string;
  created_at?: string;
  /** Optional line above the label, e.g. the transaction this belongs to. */
  context?: React.ReactNode;
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const { lang } = useT();
  return (
    <ol className="timeline">
      {events.map((ev) => (
        <li key={ev.id} className="timeline-item">
          <span className={`timeline-dot t-${ev.type || "info"}`} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            {ev.context}
            <p className="timeline-label">{translateEventText(lang, ev.label)}</p>
            {ev.detail && <p className="timeline-detail">{translateEventText(lang, ev.detail)}</p>}
            {ev.created_at && (
              <time className="timeline-time" dateTime={ev.created_at} suppressHydrationWarning>
                {fmtDateTime(ev.created_at, lang)}
              </time>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
