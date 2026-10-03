"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import AuthShell from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSent(true);
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  return (
    <AuthShell>
      {!sent ? (
        <>
          <Link href="/auth/login" className="back-link">
            <ArrowLeft size={15} /> Back to sign in
          </Link>

          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-sub">Enter your email or WhatsApp number and we&apos;ll email you a reset link.</p>

          {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label className="label" htmlFor="identifier">Email or WhatsApp number</label>
              <input id="identifier" className="input" type="text" inputMode="email" autoComplete="username"
                placeholder="you@example.com or 6XXXXXXXX"
                value={identifier} onChange={e => setIdentifier(e.target.value)} required />
              <p className="hint">The link is sent to the email address on your Zola account.</p>
            </div>

            <button type="submit" disabled={loading || identifier.trim().length < 5} className="btn btn-primary btn-block">
              {loading ? "Sending..." : "Email me a reset link"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="auth-badge"><Check size={24} strokeWidth={2.5} /></div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-sub" style={{ lineHeight: 1.6 }}>
            If a Zola account matches what you entered, we&apos;ve emailed a password reset link to the address on that account. The link expires in 1 hour.
          </p>
          <p style={{ fontSize: 14.5, color: "var(--ink-3)", marginBottom: 22 }}>
            Nothing after a few minutes? Check your spam folder, or{" "}
            <button onClick={() => setSent(false)} className="link-btn">try again</button>.
          </p>
          <Link href="/auth/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </>
      )}
    </AuthShell>
  );
}
