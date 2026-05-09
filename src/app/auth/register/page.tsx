"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inp, btn, card } from "@/lib/styles";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "buyer" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "linear-gradient(135deg,#22c55e,#15803d)", borderRadius: 12, marginBottom: 12 }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5.5V10c0 4 3 6.5 7 8 4-1.5 7-4 7-8V5.5L10 2z" fill="white" opacity=".9"/><path d="M7 10l2 2 4-4" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0fdf4", margin: "0 0 4px", letterSpacing: "-0.03em" }}>Create account</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Join SafeTrade — protected escrow trading</p>
        </div>

        {/* Role picker */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { val: "buyer", emoji: "🛒", label: "Buyer", sub: "Pay & receive items" },
            { val: "vendor", emoji: "📦", label: "Vendor", sub: "Sell & get paid" },
          ].map(r => (
            <button key={r.val} onClick={() => setForm(f => ({ ...f, role: r.val }))} type="button"
              style={{
                padding: "12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                border: `1px solid ${form.role === r.val ? "#22c55e" : "rgba(74,222,128,0.12)"}`,
                background: form.role === r.val ? "rgba(34,197,94,0.08)" : "#0a0f0d",
                transition: "all .15s",
              }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{r.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: form.role === r.val ? "#4ade80" : "#f0fdf4" }}>{r.label}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{r.sub}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
              {error}
            </div>
          )}
          {[
            { key: "name", label: "Full name", type: "text", placeholder: "Jordan Lee" },
            { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
            { key: "password", label: "Password", type: "password", placeholder: "Min. 8 characters" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>{f.label}</label>
              <input style={inp} type={f.type} placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.4)")}
                onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")}
                required minLength={f.key === "password" ? 8 : undefined} />
            </div>
          ))}
          <button style={{ ...btn, marginTop: 4, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Creating account..." : `Create ${form.role} account`}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 16 }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "#4ade80", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
