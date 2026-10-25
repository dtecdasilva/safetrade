import React from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import Navbar from "@/components/Navbar";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export interface LegalSection { title: string; body: (string | string[])[] }

/** Shared layout for the Terms of use and the Privacy policy. A string is a paragraph, an array is a list. */
export default async function LegalPage({ title, updated, intro, sections, other }: {
  title: string; updated: string; intro: string; sections: LegalSection[]; other: { href: string; label: string };
}) {
  const session = await getSession();
  const { t } = getT();
  return (
    <div className="page">
      {session ? <Navbar user={{ name: session.name, role: session.role }} /> : <SiteHeader />}
      <main className="container main">
        <article className="legal">
          <h1 className="page-title">{title}</h1>
          <p className="legal-updated">{updated}</p>
          <p className="lead" style={{ marginTop: 14 }}>{intro}</p>
          <nav className="legal-toc" aria-label={t("Contents")}>
            <ol>
              {sections.map((s, i) => <li key={s.title}><a href={`#s${i + 1}`}>{s.title}</a></li>)}
            </ol>
          </nav>
          {sections.map((s, i) => (
            <section key={s.title} id={`s${i + 1}`} className="legal-section">
              <h2>{i + 1}. {s.title}</h2>
              {s.body.map((b, j) =>
                Array.isArray(b)
                  ? <ul key={j}>{b.map((li) => <li key={li}>{li}</li>)}</ul>
                  : <p key={j}>{b}</p>
              )}
            </section>
          ))}
          <p className="legal-other"><Link href={other.href}>{other.label}</Link></p>
        </article>
      </main>
      {!session && <SiteFooter />}
    </div>
  );
}
