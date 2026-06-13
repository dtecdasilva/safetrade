"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Plus, LogOut, Menu, X, Banknote } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  user: { name: string; role: string; avatar?: string };
}

export default function Navbar({ user }: NavbarProps) {
  const path   = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  const initials  = user.avatar || user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  const roleColor = user.role === "vendor" ? "#8b5cf6" : user.role === "admin" ? "#f59e0b" : "#22c55e";

  const navLinks = user.role === "admin"
    ? [{ href: "/admin",      label: "Admin",      icon: <LayoutDashboard size={14} /> }]
    : [
        { href: "/dashboard", label: "Dashboard",  icon: <LayoutDashboard size={14} /> },
        ...(user.role === "vendor" ? [
          { href: "/trade/new", label: "New trade",  icon: <Plus size={14} /> },
          { href: "/withdraw",  label: "Withdraw",   icon: <Banknote size={14} /> },
        ] : []),
      ];

  return (
    <>
      <style>{`
        .nav-link { color: #555; font-size: 13px; font-weight: 500; text-decoration: none; padding: 5px 10px; border-radius: 6px; display: flex; align-items: center; gap: 6px; transition: color 0.15s, background 0.15s; }
        .nav-link:hover { color: #f0f0f0; background: #1a1a1a; }
        .nav-link.active { color: #f0f0f0; }
        .nav-link.primary { background: #22c55e; color: #fff; padding: 5px 12px; }
        .nav-link.primary:hover { opacity: 0.9; }
        @media (max-width: 580px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .nav-user-label { display: none !important; }
        }
        @media (min-width: 581px) {
          .nav-hamburger { display: none !important; }
          .nav-mobile-drawer { display: none !important; }
        }
      `}</style>

      <nav style={{ background: "#0c0c0c", borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          {/* Logo */}
          <Link href={user.role === "admin" ? "/admin" : "/dashboard"} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, background: "#22c55e", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f0", letterSpacing: "-0.02em" }}>SafeTrade</span>
          </Link>

          {/* Desktop links */}
          <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, paddingLeft: 16 }}>
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}
                className={`nav-link${path === l.href || (l.href !== "/dashboard" && path.startsWith(l.href)) ? " active" : ""}${l.href === "/trade/new" ? " primary" : ""}`}>
                {l.icon} {l.label}
              </Link>
            ))}
          </div>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div className="nav-user-label" style={{ textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{user.name}</p>
              <p style={{ fontSize: 11, color: roleColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{user.role}</p>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2e2e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: roleColor, fontFamily: "monospace", flexShrink: 0 }}>
              {initials}
            </div>
            <button onClick={logout} title="Sign out" className="nav-desktop"
              style={{ background: "none", border: "1px solid #242424", cursor: "pointer", color: "#555", padding: "6px 8px", borderRadius: 6, display: "flex", alignItems: "center", transition: "color 0.15s" }}>
              <LogOut size={14} />
            </button>
            <button className="nav-hamburger" onClick={() => setOpen(o => !o)}
              style={{ background: "none", border: "1px solid #242424", cursor: "pointer", color: "#888", padding: "6px 8px", borderRadius: 6, display: "none", alignItems: "center" }}>
              {open ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="nav-mobile-drawer" style={{ borderTop: "1px solid #1e1e1e", background: "#0c0c0c", padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e1e1e", marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2e2e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: roleColor, fontFamily: "monospace" }}>
                {initials}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{user.name}</p>
                <p style={{ fontSize: 11, color: roleColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{user.role}</p>
              </div>
            </div>
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 500, color: path === l.href ? "#f0f0f0" : "#888", background: path === l.href ? "#1a1a1a" : "transparent" }}>
                {l.icon} {l.label}
              </Link>
            ))}
            <button onClick={() => { setOpen(false); logout(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", background: "transparent", color: "#555", border: "none", fontFamily: "inherit", marginTop: 4, textAlign: "left" }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
