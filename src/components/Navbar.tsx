"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Plus, LogOut } from "lucide-react";

interface NavbarProps {
  user: { name: string; role: string; avatar?: string };
}

export default function Navbar({ user }: NavbarProps) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  const initials = user.avatar || user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  const roleColor = user.role === "vendor" ? "#a78bfa" : user.role === "admin" ? "#f59e0b" : "#4ade80";
  const roleBg = user.role === "vendor" ? "rgba(167,139,250,0.1)" : user.role === "admin" ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)";

  return (
    <nav style={{ background: "#111812", borderBottom: "1px solid rgba(74,222,128,0.12)", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href={user.role === "admin" ? "/admin" : "/dashboard"} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#22c55e,#15803d)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#f0fdf4", letterSpacing: "-0.02em" }}>
            Safe<span style={{ color: "#4ade80" }}>Trade</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {user.role === "admin" ? (
            <NavLink href="/admin" active={path.startsWith("/admin")} icon={<LayoutDashboard size={14} />}>Admin Panel</NavLink>
          ) : (
            <>
              <NavLink href="/dashboard" active={path === "/dashboard"} icon={<LayoutDashboard size={14} />}>Dashboard</NavLink>
              {user.role === "vendor" && (
                <NavLink href="/trade/new" active={path === "/trade/new"} icon={<Plus size={14} />} primary>New Trade</NavLink>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#f0fdf4", margin: 0 }}>{user.name}</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: roleColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{user.role}</p>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: roleBg, border: `1.5px solid ${roleColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: roleColor, fontFamily: "monospace" }}>
            {initials}
          </div>
          <button onClick={logout} title="Sign out" style={{ background: "none", border: "1px solid rgba(74,222,128,0.12)", cursor: "pointer", color: "#6b7280", padding: 7, borderRadius: 8, display: "flex", alignItems: "center" }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, icon, primary, children }: { href: string; active: boolean; icon: React.ReactNode; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 8,
      fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "all .15s",
      background: primary ? (active ? "#22c55e" : "rgba(34,197,94,0.1)") : (active ? "#162018" : "transparent"),
      color: primary ? (active ? "#fff" : "#4ade80") : (active ? "#f0fdf4" : "#6b7280"),
      border: primary ? `1px solid ${active ? "#22c55e" : "rgba(74,222,128,0.25)"}` : "1px solid transparent",
    }}>
      {icon}{children}
    </Link>
  );
}
