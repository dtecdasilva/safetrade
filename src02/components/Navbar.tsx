"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Plus, LogOut, Menu, X, Wallet, ArrowLeftRight, Activity, HelpCircle, Home, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { brandText, initials as toInitials, roleLabel } from "@/lib/zola";

interface NavbarProps {
  user: { name: string; role: string; avatar?: string };
}

export default function Navbar({ user }: NavbarProps) {
  const path   = usePathname();
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const name     = brandText(user.name);
  const initials = user.avatar || toInitials(name);
  const isVendor = user.role === "vendor";
  const isAdmin  = user.role === "admin";
  const home     = isAdmin ? "/admin" : "/dashboard";

  const navLinks = isAdmin
    ? [
        { href: "/admin", label: "Admin", icon: <LayoutDashboard size={17} /> },
        { href: "/help",  label: "Help",  icon: <HelpCircle size={17} /> },
      ]
    : [
        { href: "/dashboard",    label: "Home",         icon: <Home size={17} /> },
        { href: "/transactions", label: "Transactions", icon: <ArrowLeftRight size={17} /> },
        ...(isVendor ? [{ href: "/withdraw", label: "Wallet", icon: <Wallet size={17} /> }] : []),
        { href: "/activity",     label: "Activity",     icon: <Activity size={17} /> },
        { href: "/help",         label: "Help",         icon: <HelpCircle size={17} /> },
      ];

  const isActive = (href: string) =>
    path === href ||
    (href !== "/dashboard" && path.startsWith(href)) ||
    (href === "/transactions" && path.startsWith("/trade"));

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        <Link href={home} className="nav-logo" aria-label="Zola home">
          <Logo size={30} />
        </Link>

        {/* Desktop links */}
        <div className="nav-links">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link${isActive(l.href) ? " active" : ""}`}
              aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="nav-right">
          {isVendor && (
            <Link href="/trade/new" className="btn btn-primary btn-sm nav-cta">
              <Plus size={16} /> New transaction
            </Link>
          )}

          {/* Account menu */}
          <div className="nav-account" ref={menuRef}>
            <button className="nav-account-btn" onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu">
              <span className="avatar">{initials}</span>
              <span className="nav-account-name">{name}</span>
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <div className="nav-menu" role="menu">
                <div className="nav-menu-head">
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)", lineHeight: 1.3 }}>{name}</p>
                  <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{roleLabel(user.role)} account</p>
                </div>
                <Link href="/help" className="nav-menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <HelpCircle size={16} /> Help
                </Link>
                <button className="nav-menu-item" role="menuitem" onClick={() => { setMenuOpen(false); logout(); }}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>

          <button className="icon-btn nav-burger" onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="nav-drawer">
          <div className="nav-drawer-user">
            <span className="avatar">{initials}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", lineHeight: 1.3 }}>{name}</p>
              <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{roleLabel(user.role)} account</p>
            </div>
          </div>
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`nav-link${isActive(l.href) ? " active" : ""}`}>
              {l.icon} {l.label}
            </Link>
          ))}
          {isVendor && (
            <Link href="/trade/new" onClick={() => setOpen(false)} className="btn btn-primary" style={{ marginTop: 10 }}>
              <Plus size={17} /> New transaction
            </Link>
          )}
          <button onClick={() => { setOpen(false); logout(); }} className="nav-link"
            style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", marginTop: 6, color: "var(--ink-3)" }}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
