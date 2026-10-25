"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";

export default function RiderLogin() {
  const { t } = useT();
  const pk = usePk();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const res = await fetch("/api/pickup/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      window.location.href = pk("/app");
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="pk-card pk-narrow">
      <h1 className="pk-h1">{t("Rider sign in")}</h1>
      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(error)}</div>}
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="login">{t("Email or phone number")}</label>
          <input id="login" className="input" autoComplete="username" value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">{t("Password")}</label>
          <input id="password" className="input" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t("Signing in...") : t("Sign in")}</button>
      </form>
      <p className="hint" style={{ marginTop: 14, textAlign: "center" }}>{t("New rider?")} <Link href={pk("/signup")}>{t("Create a rider account")}</Link></p>
    </section>
  );
}
