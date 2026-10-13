"use client";
import { Globe } from "lucide-react";
import { useLang } from "@/components/I18n";
import { LANG_COOKIE, Lang } from "@/lib/i18n/core";

/**
 * English / Français. The choice is kept in a cookie (so pages render in it
 * straight away) and, for people signed in, on their account (so emails and
 * notifications follow it too).
 */
export default function LangSwitch({ variant = "button", className = "" }: { variant?: "button" | "text" | "row"; className?: string }) {
  const lang = useLang();
  const next: Lang = lang === "fr" ? "en" : "fr";
  const label = next === "fr" ? "Français" : "English";

  async function change() {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      await fetch("/api/profile/lang", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: next }),
      });
    } catch {}
    window.location.reload();
  }

  if (variant === "row") {
    // A full-width row, for the phone menu
    return (
      <button type="button" onClick={change} lang={next} className={`nav-link lang-row ${className}`}
        aria-label={next === "fr" ? "Afficher le site en français" : "Show the site in English"}>
        <Globe size={17} /> {label}
      </button>
    );
  }

  return (
    <button type="button" onClick={change} lang={next}
      className={variant === "text" ? `theme-toggle theme-text ${className}` : `btn btn-ghost btn-sm lang-switch ${className}`}
      aria-label={next === "fr" ? "Afficher le site en français" : "Show the site in English"}>
      <Globe size={variant === "text" ? 15 : 16} />
      <span className="lang-long">{label}</span>
      {variant !== "text" && <span className="lang-short" aria-hidden="true">{next.toUpperCase()}</span>}
    </button>
  );
}
