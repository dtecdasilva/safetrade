"use client";
import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { BRAND } from "@/lib/zola";
import { SUPPORT } from "@/lib/support";
import LangSwitch from "@/components/LangSwitch";
import { useT } from "@/components/I18n";

/** Header for signed-out pages (home, help). */
export function SiteHeader() {
  const { t } = useT();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo" aria-label={t("Zola home")}>
          <Logo size={30} />
        </Link>
        <nav className="site-links" aria-label={t("Main")}>
          <Link href="/#how" className="nav-link">{t("How Zola works")}</Link>
          <Link href="/#fees" className="nav-link">{t("Fees")}</Link>
          <Link href="/help" className="nav-link">{t("Help")}</Link>
        </nav>
        <div className="nav-right">
          <LangSwitch className="site-lang" />
          <ThemeToggle className="site-theme" />
          <Link href="/auth/login" className="btn btn-ghost btn-sm">{t("Sign in")}</Link>
          <Link href="/auth/register" className="btn btn-primary btn-sm site-cta">{t("Create account")}</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useT();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo size={30} tone="light" />
            <p style={{ marginTop: 16, fontSize: 15, maxWidth: "34ch" }}>{t(BRAND.tagline)}</p>
            <p style={{ marginTop: 8, fontSize: 14.5, maxWidth: "40ch" }}>
              {t("Built in Africa for buyers and sellers everywhere.")}
            </p>
          </div>
          <div className="footer-col">
            <p className="footer-head">Zola</p>
            <Link href="/#how">{t("How Zola works")}</Link>
            <Link href="/#fees">{t("Fees")}</Link>
            <Link href="/help">{t("Help")}</Link>
            <Link href="/terms">{t("Terms of use")}</Link>
            <Link href="/privacy">{t("Privacy policy")}</Link>
          </div>
          <div className="footer-col">
            <p className="footer-head">{t("Account")}</p>
            <Link href="/auth/login">{t("Sign in")}</Link>
            <Link href="/auth/register">{t("Create account")}</Link>
            <Link href="/auth/forgot-password">{t("Reset password")}</Link>
          </div>
          <div className="footer-col">
            <p className="footer-head">{t("Customer service")}</p>
            <a href={SUPPORT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="footer-contact">WhatsApp {SUPPORT.whatsapp}</a>
            <a href={SUPPORT.phoneUrl} className="footer-contact">{t("Call {phone}", { phone: SUPPORT.phone })}</a>
          </div>
        </div>
        <div className="footer-base">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <span>© {new Date().getFullYear()} Zola</span>
            <ThemeToggle variant="text" />
            <LangSwitch variant="text" />
          </span>
          <span>{t("Payments are held by Zola until delivery is confirmed and reviewed.")}</span>
        </div>
      </div>
    </footer>
  );
}
