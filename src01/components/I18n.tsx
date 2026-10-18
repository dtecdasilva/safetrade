"use client";
import React, { createContext, useContext, useMemo } from "react";
import { Lang, makeT, T } from "@/lib/i18n/core";

const LangContext = createContext<Lang>("en");

/** Wraps the whole app (in layout.tsx) with the visitor's language. */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** const { t, lang } = useT();  t("Create a transaction") */
export function useT(): { t: T; lang: Lang } {
  const lang = useLang();
  const t = useMemo(() => makeT(lang), [lang]);
  return { t, lang };
}

/**
 * Text with a little markup inside a translated sentence:
 *   rich(t("Now <b>send the item to Zola</b>."), { b: (c) => <strong>{c}</strong> })
 */
export function rich(text: string, tags: Record<string, (chunk: React.ReactNode) => React.ReactNode>): React.ReactNode {
  const out: React.ReactNode[] = [];
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = tags[m[1]];
    out.push(<React.Fragment key={i++}>{render ? render(m[2]) : m[2]}</React.Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
