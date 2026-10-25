/**
 * English / French.
 *
 * Text is written in English in the code, wrapped in t("..."). In French the
 * English sentence is looked up in the French dictionary (lib/i18n/fr). If a
 * sentence has no translation yet, the English is shown, so nothing ever
 * breaks or shows a blank.
 *
 * Placeholders: t("Pay {total} to Zola", { total: "FCFA 5,000" })
 */
import { FR } from "@/lib/i18n/fr";

export type Lang = "en" | "fr";
export const LANGS: Lang[] = ["en", "fr"];
export const LANG_COOKIE = "zola-lang";
export const LANG_NAMES: Record<Lang, string> = { en: "English", fr: "Français" };

export type Params = Record<string, string | number | undefined | null>;
export type T = (text: string, params?: Params) => string;

export function normalizeLang(v: unknown): Lang | null {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("fr")) return "fr";
  if (s.startsWith("en")) return "en";
  return null;
}

/** First visit: follow the browser's preferred language. */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  const first = String(header || "").split(",")[0]?.trim().toLowerCase() || "";
  return first.startsWith("fr") ? "fr" : "en";
}

export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined || params[k] === null ? m : String(params[k])));
}

export function translate(lang: Lang, text: string, params?: Params): string {
  const base = lang === "fr" ? FR[text] ?? text : text;
  return interpolate(base, params);
}

export function makeT(lang: Lang): T {
  return (text, params) => translate(lang, text, params);
}

/** Pick between two inline versions, for long passages kept side by side. */
export function pick<V>(lang: Lang, v: { en: V; fr: V }): V {
  return lang === "fr" ? v.fr : v.en;
}

/** Dates in the reader's language: "12 Oct 2026" / "12 oct. 2026". */
export function locale(lang: Lang): string {
  return lang === "fr" ? "fr-FR" : "en-GB";
}
