"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inp, btn, card } from "@/lib/styles";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      const role = data.user.role;
      router.push(role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "linear-gradient(135deg,#22c55e,#15803d)", borderRadius: 12, marginBottom: 12 }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5.5V10c0 4 3 6.5 7 8 4-1.5 7-4 7-8V5.5L10 2z" fill="white" opacity=".9"/><path d="M7 10l2 2 4-4" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0fdf4", margin: "0 0 4px", letterSpacing: "-0.03em" }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Sign in to your SafeTrade account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Email</label>
            <input style={inp} type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Password</label>
            <input style={inp} type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")} required />
          </div>
          <button style={{ ...btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 20 }}>
          No account?{" "}
          <Link href="/auth/register" style={{ color: "#4ade80", fontWeight: 600, textDecoration: "none" }}>Create one</Link>
        </p>
        <div style={{ marginTop: 16, padding: "12px", background: "rgba(34,197,94,0.05)", borderRadius: 8, border: "1px solid rgba(74,222,128,0.1)" }}>
          <p style={{ fontSize: 11, color: "#6b7280", margin: 0, textAlign: "center" }}>
            Admin demo: <span style={{ fontFamily: "monospace", color: "#4ade80" }}>admin@safetrade.com</span> / <span style={{ fontFamily: "monospace", color: "#4ade80" }}>admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
