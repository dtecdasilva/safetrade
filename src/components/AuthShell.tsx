"use client";
import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { MoneyRail } from "@/components/ui";
import { BRAND } from "@/lib/zola";
import LangSwitch from "@/components/LangSwitch";
import { useT } from "@/components/I18n";

/** Shared layout for sign in, create account and password screens. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="nav-logo" aria-label={t("Zola home")}><Logo size={32} /></Link>
        <div>
          <p className="auth-aside-title">{t("Secure transactions. Simple payments.")}</p>
          <div className="auth-aside-card">
            <MoneyRail at="zola" />
            <p style={{ textAlign: "center", fontSize: 14.5, fontWeight: 600, color: "var(--emerald-press)", marginTop: 16 }}>
              {t("Zola holds the payment until delivery is confirmed.")}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: "44ch" }}>{t(BRAND.summary)}</p>
      </aside>
      <main className="auth-main">
        <div className="auth-theme">
          <LangSwitch />
          <ThemeToggle />
        </div>
        <div className="auth-box">
          <Link href="/" className="nav-logo auth-logo-mobile" aria-label={t("Zola home")}><Logo size={30} /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
