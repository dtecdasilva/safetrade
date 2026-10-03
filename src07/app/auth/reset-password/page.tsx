"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Check } from "lucide-react";
import AuthShell from "@/components/AuthShell";

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
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  const mismatch = !!confirm && password !== confirm;
  const blocked  = !token || password !== confirm || password.length < 8;

  if (success) {
    return (
      <>
        <div className="auth-badge"><Check size={24} strokeWidth={2.5} /></div>
        <h1 className="auth-title">Password updated</h1>
        <p className="auth-sub">Your password has been changed. Taking you to sign in...</p>
        <Link href="/auth/login" className="btn btn-secondary btn-block">Go to sign in</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Set a new password</h1>
      <p className="auth-sub">Choose a strong password for your Zola account.</p>

      {error && (
        <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>
          <span>
            {error}
            {error.includes("expired") || error.includes("Invalid") ? (
              <> <Link href="/auth/forgot-password">Request a new link</Link></>
            ) : null}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label className="label" htmlFor="password">New password</label>
          <div className="input-wrap">
            <input id="password" className="input" type={showPw ? "text" : "password"} placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            <button type="button" className="input-affix" onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="confirm">Confirm password</label>
          <div className="input-wrap">
            <input id="confirm" className={`input${mismatch ? " is-invalid" : ""}`}
              type={showPw2 ? "text" : "password"} placeholder="Repeat password" autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
            <button type="button" className="input-affix" onClick={() => setShowPw2(s => !s)}
              aria-label={showPw2 ? "Hide password" : "Show password"}>
              {showPw2 ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {mismatch && <p className="hint-error">Passwords do not match</p>}
        </div>

        <button type="submit" disabled={loading || blocked} className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
