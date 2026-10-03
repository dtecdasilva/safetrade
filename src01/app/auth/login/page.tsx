"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    background: "#141414", border: "1px solid #242424",
    borderRadius: 8, color: "#f0f0f0", fontSize: 14,
    fontFamily: "inherit", outline: "none", transition: "border-color 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <style>{`
        input:focus { border-color: #22c55e !important; }
        a { color: #22c55e; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .eye-btn:hover { color: #f0f0f0 !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, background: "#22c55e", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f0f0f0", letterSpacing: "-0.02em" }}>SafeTrade</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Sign in</h1>
        <p style={{ fontSize: 14, color: "#555", margin: "0 0 28px" }}>Welcome back to SafeTrade</p>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>Email</label>
            <input style={inp} type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#888" }}>Password</label>
              <Link href="/auth/forgot-password" style={{ fontSize: 12, color: "#555" }}>Forgot password?</Link>
            </div>
            <div style={{ position: "relative" }}>
              <input style={{ ...inp, paddingRight: 40 }}
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <button type="button" className="eye-btn"
                onClick={() => setShowPw(s => !s)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex", alignItems: "center", padding: 2, transition: "color 0.15s" }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ padding: "10px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 20 }}>
          No account? <Link href="/auth/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
