import { cookies, headers } from "next/headers";
import { LANG_COOKIE, Lang, langFromAcceptLanguage, makeT, normalizeLang, T } from "@/lib/i18n/core";

/** The visitor's language: their saved choice, otherwise their browser's. */
export function getLang(): Lang {
  try {
    const saved = normalizeLang(cookies().get(LANG_COOKIE)?.value);
    if (saved) return saved;
    return langFromAcceptLanguage(headers().get("accept-language"));
  } catch {
    return "en";
  }
}

export function getT(): { t: T; lang: Lang } {
  const lang = getLang();
  return { t: makeT(lang), lang };
}

/** The language saved on a user's account, for emails and messages. */
export function userLang(user: any): Lang {
  return normalizeLang(user?.lang) || "en";
}
