"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { safeNext } from "@/lib/pickup/config";
import { siteUrl } from "@/lib/support";

/** Sender sign in (riders sign in on /login). Zola accounts work here too. */
export default function SenderSignin() {
  const { t } = useT();
  const pk = usePk();
  const next = safeNext(useSearchParams().get("next"));
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      window.location.href = pk(next);
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="pk-card pk-narrow">
      <h1 className="pk-h1">{t("Sign in")}</h1>
      <p className="hint" style={{ marginBottom: 14 }}>{t("Use your Pickup or Zola account.")}</p>
      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(error)}</div>}
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <div className="field"><label className="label" htmlFor="email">{t("Email")}</label><input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></div>
        <div className="field"><label className="label" htmlFor="password">{t("Password")}</label><input id="password" className="input" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t("Signing in...") : t("Sign in")}</button>
      </form>
      <p className="hint" style={{ marginTop: 14, textAlign: "center" }}>{t("New to Pickup?")} <Link href={pk(`/join${next !== "/send" ? `?next=${encodeURIComponent(next)}` : ""}`)}>{t("Create an account")}</Link></p>
      <p className="hint" style={{ marginTop: 6, textAlign: "center" }}>{t("Forgot your password?")} <a href={`${siteUrl()}/auth/forgot-password`}>{t("Reset it on Zola")}</a></p>
      <p className="hint" style={{ marginTop: 6, textAlign: "center" }}>{t("Are you a rider?")} <Link href={pk("/login")}>{t("Rider sign in")}</Link></p>
    </section>
  );
}
