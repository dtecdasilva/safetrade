"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { PhoneField } from "@/components/ui";
import { safeNext } from "@/lib/pickup/config";

/** Create a sender account on Pickup. It is a Zola account, so it also works on zolahq.com. */
export default function SenderJoin() {
  const { t, lang } = useT();
  const pk = usePk();
  const next = safeNext(useSearchParams().get("next"));
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (form.password.length < 6) { setError("Use at least 6 characters for your password"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, site: "pickup", lang }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      window.location.href = pk(next);
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="pk-card pk-narrow">
      <h1 className="pk-h1">{t("Create your Pickup account")}</h1>
      <p className="hint" style={{ marginBottom: 14 }}>{t("An account is optional. It keeps all your deliveries in one place, fills in your details for you, and also works on Zola.")}</p>
      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(error)}</div>}
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <div className="field"><label className="label" htmlFor="name">{t("Full name")}</label><input id="name" className="input" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
        <div className="field"><label className="label" htmlFor="phone">{t("Phone number")}</label><PhoneField id="phone" value={form.phone} onChange={(v) => set("phone", v)} required /></div>
        <div className="field"><label className="label" htmlFor="email">{t("Email")}</label><input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></div>
        <div className="field"><label className="label" htmlFor="password">{t("Password")}</label><input id="password" className="input" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} required /></div>
        <button className="btn btn-primary btn-block" disabled={busy || form.name.trim().length < 2 || form.phone.length < 9}>{busy ? t("Creating your account...") : t("Create account")}</button>
      </form>
      <p className="hint" style={{ marginTop: 14, textAlign: "center" }}>{t("Already have a Pickup or Zola account?")} <Link href={pk(`/signin${next !== "/send" ? `?next=${encodeURIComponent(next)}` : ""}`)}>{t("Sign in")}</Link></p>
    </section>
  );
}

