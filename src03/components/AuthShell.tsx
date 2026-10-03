import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { MoneyRail } from "@/components/ui";
import { BRAND } from "@/lib/zola";

/** Shared layout for sign in, create account and password screens. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="nav-logo" aria-label="Zola home"><Logo size={32} /></Link>
        <div>
          <p className="auth-aside-title">Secure transactions. Simple payments.</p>
          <div className="auth-aside-card">
            <MoneyRail at="zola" />
            <p style={{ textAlign: "center", fontSize: 14.5, fontWeight: 600, color: "var(--emerald-press)", marginTop: 16 }}>
              Zola holds the payment until delivery is confirmed.
            </p>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: "44ch" }}>{BRAND.summary}</p>
      </aside>
      <main className="auth-main">
        <ThemeToggle className="auth-theme" />
        <div className="auth-box">
          <Link href="/" className="nav-logo auth-logo-mobile" aria-label="Zola home"><Logo size={30} /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
