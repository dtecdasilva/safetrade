"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Plus, LogOut, Menu, X, Banknote } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  user: { name: string; role: string; avatar?: string };
}

export default function Navbar({ user }: NavbarProps) {
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  const initials  = user.avatar || user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  const roleColor = user.role === "vendor" ? "#a78bfa" : user.role === "admin" ? "#f59e0b" : "#4ade80";
  const roleBg    = user.role === "vendor" ? "rgba(167,139,250,0.1)" : user.role === "admin" ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)";

  const navLinks = user.role === "admin"
  ? [{ href: "/admin",    label: "Admin Panel", icon: <LayoutDashboard size={14} />, primary: false }]
  : [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} />, primary: false },
      ...(user.role === "vendor"
        ? [
            { href: "/trade/new", label: "New Trade",        icon: <Plus size={14} />,    primary: true  },
            { href: "/withdraw",  label: "Withdraw funds",   icon: <Banknote size={14} />, primary: false },
          ]
        : []),
    ];

  return (
    <>
      <style>{`
        @media (max-width: 600px) {
          .nav-links-desktop { display: none !important; }
          .nav-menu-btn { display: flex !important; }
          .nav-user-name { display: none !important; }
        }
        @media (min-width: 601px) {
          .nav-menu-btn { display: none !important; }
          .nav-mobile-menu { display: none !important; }
        }
      `}</style>

      <nav style={{ background: "#111812", borderBottom: "1px solid rgba(74,222,128,0.12)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>

          {/* Logo */}
          <Link href={user.role === "admin" ? "/admin" : "/dashboard"} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#22c55e,#15803d)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#f0fdf4", letterSpacing: "-0.02em" }}>
              Safe<span style={{ color: "#4ade80" }}>Trade</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="nav-links-desktop" style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}>
            {navLinks.map(l => (
              <NavLink key={l.href} href={l.href} active={path === l.href || (l.href !== "/dashboard" && path.startsWith(l.href))} icon={l.icon} primary={l.primary}>
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* User info — hidden on mobile */}
            <div className="nav-user-name" style={{ textAlign: "right" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f0fdf4", margin: 0, whiteSpace: "nowrap" }}>{user.name}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: roleColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{user.role}</p>
            </div>

            {/* Avatar */}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: roleBg, border: `1.5px solid ${roleColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: roleColor, fontFamily: "monospace", flexShrink: 0 }}>
              {initials}
            </div>

            {/* Logout — desktop */}
            <button onClick={logout} title="Sign out" className="nav-links-desktop" style={{ background: "none", border: "1px solid rgba(74,222,128,0.12)", cursor: "pointer", color: "#6b7280", padding: 7, borderRadius: 8, display: "flex", alignItems: "center" }}>
              <LogOut size={14} />
            </button>

            {/* Hamburger — mobile only */}
            <button
              className="nav-menu-btn"
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: "none", border: "1px solid rgba(74,222,128,0.12)", cursor: "pointer", color: "#9ca3af", padding: 7, borderRadius: 8, display: "none", alignItems: "center" }}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="nav-mobile-menu" style={{ borderTop: "1px solid rgba(74,222,128,0.08)", padding: "12px 1rem 16px", display: "flex", flexDirection: "column", gap: 6, background: "#0d160e" }}>
            {/* User info row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(74,222,128,0.04)", borderRadius: 10, border: "1px solid rgba(74,222,128,0.08)", marginBottom: 4 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: roleBg, border: `1.5px solid ${roleColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: roleColor, fontFamily: "monospace", flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4", margin: 0 }}>{user.name}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: roleColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{user.role}</p>
              </div>
            </div>

            {/* Nav links */}
            {navLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px", borderRadius: 10, textDecoration: "none",
                  fontSize: 14, fontWeight: 600,
                  background: (path === l.href || path.startsWith(l.href + "/")) ? "rgba(34,197,94,0.08)" : "transparent",
                  color: (path === l.href || path.startsWith(l.href + "/")) ? "#4ade80" : "#9ca3af",
                  border: "1px solid",
                  borderColor: (path === l.href || path.startsWith(l.href + "/")) ? "rgba(74,222,128,0.15)" : "transparent",
                }}
              >
                {l.icon} {l.label}
              </Link>
            ))}

            {/* Logout */}
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                background: "transparent", color: "#6b7280",
                border: "1px solid rgba(239,68,68,0.12)",
                fontFamily: "inherit", marginTop: 4,
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

function NavLink({ href, active, icon, primary, children }: {
  href: string; active: boolean; icon: React.ReactNode; primary?: boolean; children: React.ReactNode;
}) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 8,
      fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "all .15s",
      background: primary ? (active ? "#22c55e" : "rgba(34,197,94,0.1)") : (active ? "#162018" : "transparent"),
      color: primary ? (active ? "#fff" : "#4ade80") : (active ? "#f0fdf4" : "#6b7280"),
      border: primary ? `1px solid ${active ? "#22c55e" : "rgba(74,222,128,0.25)"}` : "1px solid transparent",
      whiteSpace: "nowrap" as const,
    }}>
      {icon}{children}
    </Link>
  );
}