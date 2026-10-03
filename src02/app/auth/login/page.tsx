"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "@/components/AuthShell";

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
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  return (
    <AuthShell>
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-sub">Welcome back to Zola.</p>

      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" placeholder="you@example.com" autoComplete="email"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        </div>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <label className="label" htmlFor="password">Password</label>
            <Link href="/auth/forgot-password" style={{ fontSize: 13.5, fontWeight: 600 }}>Forgot password?</Link>
          </div>
          <div className="input-wrap">
            <input id="password" className="input"
              type={showPw ? "text" : "password"}
              placeholder="Your password" autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            <button type="button" className="input-affix" onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="auth-foot">
        New to Zola? <Link href="/auth/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
