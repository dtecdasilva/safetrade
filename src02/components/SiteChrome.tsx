import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { BRAND } from "@/lib/zola";

/** Header for signed-out pages (home, help). */
export function SiteHeader() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo" aria-label="Zola home">
          <Logo size={30} />
        </Link>
        <nav className="site-links" aria-label="Main">
          <Link href="/#how" className="nav-link">How Zola works</Link>
          <Link href="/#fees" className="nav-link">Fees</Link>
          <Link href="/help" className="nav-link">Help</Link>
        </nav>
        <div className="nav-right">
          <Link href="/auth/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/auth/register" className="btn btn-primary btn-sm">Create account</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo size={30} tone="light" />
            <p style={{ marginTop: 16, fontSize: 15, maxWidth: "34ch" }}>{BRAND.tagline}</p>
            <p style={{ marginTop: 8, fontSize: 14.5, maxWidth: "40ch" }}>
              Built in Africa for buyers and sellers everywhere.
            </p>
          </div>
          <div className="footer-col">
            <p className="footer-head">Zola</p>
            <Link href="/#how">How Zola works</Link>
            <Link href="/#fees">Fees</Link>
            <Link href="/help">Help</Link>
          </div>
          <div className="footer-col">
            <p className="footer-head">Account</p>
            <Link href="/auth/login">Sign in</Link>
            <Link href="/auth/register">Create account</Link>
            <Link href="/auth/forgot-password">Reset password</Link>
          </div>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} Zola</span>
          <span>Payments are held by Zola until the buyer confirms delivery.</span>
        </div>
      </div>
    </footer>
  );
}
