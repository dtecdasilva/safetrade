"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") || "";

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [showPw2, setShowPw2]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid reset link. Please request a new one.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 40px 9px 12px",
    background: "#141414", border: "1px solid #242424",
    borderRadius: 8, color: "#f0f0f0", fontSize: 14,
    fontFamily: "inherit", outline: "none", transition: "border-color 0.15s",
  };

  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        <div style={{ width: 28, height: 28, background: "#22c55e", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldCheck size={15} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#f0f0f0", letterSpacing: "-0.02em" }}>SafeTrade</span>
      </div>

      {success ? (
        <>
          <div style={{ width: 44, height: 44, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>✓</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Password updated</h1>
          <p style={{ fontSize: 14, color: "#555", margin: "0 0 20px" }}>Your password has been changed. Redirecting to sign in...</p>
          <Link href="/auth/login" style={{ color: "#22c55e", fontSize: 13, textDecoration: "none" }}>Go to sign in</Link>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Set new password</h1>
          <p style={{ fontSize: 14, color: "#555", margin: "0 0 28px" }}>Choose a strong password for your account.</p>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
              {error}
              {error.includes("expired") || error.includes("Invalid") ? (
                <> <Link href="/auth/forgot-password" style={{ color: "#ef4444", textDecoration: "underline" }}>Request a new link</Link></>
              ) : null}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>New password</label>
              <div style={{ position: "relative" }}>
                <input style={inp} type={showPw ? "text" : "password"} placeholder="Min. 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex", alignItems: "center", padding: 2 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>Confirm password</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...inp, borderColor: confirm && password !== confirm ? "rgba(239,68,68,0.4)" : "#242424" }}
                  type={showPw2 ? "text" : "password"} placeholder="Repeat password"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
                <button type="button" onClick={() => setShowPw2(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex", alignItems: "center", padding: 2 }}>
                  {showPw2 ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm && password !== confirm && (
                <p style={{ fontSize: 11, color: "#ef4444", margin: "4px 0 0" }}>Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={loading || !token || password !== confirm || password.length < 8}
              style={{ padding: "10px", background: (!token || password !== confirm || password.length < 8) ? "#1a1a1a" : "#22c55e", color: (!token || password !== confirm || password.length < 8) ? "#444" : "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <style>{`input:focus { border-color: #22c55e !important; } a { color: #22c55e; text-decoration: none; }`}</style>
      <Suspense fallback={<div style={{ color: "#555" }}>Loading...</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
