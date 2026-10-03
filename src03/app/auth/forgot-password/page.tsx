"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { PhoneField } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [phone, setPhone]     = useState("");
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
        body: JSON.stringify({ phone }),
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
          <p className="auth-sub">Enter your WhatsApp number and we&apos;ll send you a reset link.</p>

          {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label className="label" htmlFor="phone">WhatsApp number</label>
              <PhoneField id="phone" value={phone} onChange={setPhone} required />
              <p className="hint">Use the number on your Zola account.</p>
            </div>

            <button type="submit" disabled={loading || phone.length < 8} className="btn btn-primary btn-block">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="auth-badge"><Check size={24} strokeWidth={2.5} /></div>
          <h1 className="auth-title">Check WhatsApp</h1>
          <p className="auth-sub" style={{ lineHeight: 1.6 }}>
            If a Zola account uses that number, we&apos;ve sent a password reset link to your WhatsApp. The link expires in 1 hour.
          </p>
          <p style={{ fontSize: 14.5, color: "var(--ink-3)", marginBottom: 22 }}>
            Didn&apos;t receive it?{" "}
            <button onClick={() => setSent(false)} className="link-btn">Try again</button>
          </p>
          <Link href="/auth/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </>
      )}
    </AuthShell>
  );
}
