"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

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
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <style>{`input:focus { border-color: #22c55e !important; } a { color: #22c55e; text-decoration: none; } a:hover { text-decoration: underline; }`}</style>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, background: "#22c55e", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f0f0f0", letterSpacing: "-0.02em" }}>SafeTrade</span>
        </div>

        {!sent ? (
          <>
            <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555", fontSize: 13, marginBottom: 24 }}>
              <ArrowLeft size={13} /> Back to sign in
            </Link>

            <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Forgot password</h1>
            <p style={{ fontSize: 14, color: "#555", margin: "0 0 28px" }}>
              Enter your WhatsApp number and we'll send you a reset link.
            </p>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>WhatsApp number</label>
                <div style={{ display: "flex", background: "#141414", border: "1px solid #242424", borderRadius: 8, overflow: "hidden", transition: "border-color 0.15s" }}>
                  <span style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: "1px solid #242424", color: "#444", fontSize: 12, fontFamily: "monospace", background: "#1a1a1a", flexShrink: 0 }}>+237</span>
                  <input type="tel" placeholder="6XXXXXXXX" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,9))}
                    onFocus={e => (e.currentTarget.parentElement!.style.borderColor = "#22c55e")}
                    onBlur={e => (e.currentTarget.parentElement!.style.borderColor = "#242424")}
                    style={{ flex: 1, height: 40, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 14, fontFamily: "monospace" }}
                    required />
                </div>
                <p style={{ fontSize: 12, color: "#444", margin: "5px 0 0" }}>
                  Must match the number on your SafeTrade account
                </p>
              </div>

              <button type="submit" disabled={loading || phone.length < 8}
                style={{ padding: "10px", background: phone.length >= 8 ? "#22c55e" : "#1a1a1a", color: phone.length >= 8 ? "#fff" : "#444", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: phone.length >= 8 ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ width: 44, height: 44, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>✓</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Check WhatsApp</h1>
            <p style={{ fontSize: 14, color: "#555", margin: "0 0 24px", lineHeight: 1.6 }}>
              If an account exists with that number, a password reset link has been sent to your WhatsApp. The link expires in 1 hour.
            </p>
            <p style={{ fontSize: 13, color: "#444", marginBottom: 24 }}>
              Didn't receive it?{" "}
              <button onClick={() => setSent(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#22c55e", fontSize: 13, fontFamily: "inherit", padding: 0 }}>
                Try again
              </button>
            </p>
            <Link href="/auth/login">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
