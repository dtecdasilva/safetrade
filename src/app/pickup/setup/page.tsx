"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { prettyPhone } from "@/lib/support";

/** A rider added by Zola opens this link to set their password. */
export default function RiderSetup() {
  const { t } = useT();
  const pk = usePk();
  const token = useSearchParams().get("t") || "";
  const [who, setWho] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/pickup/setup?t=${encodeURIComponent(token)}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "This link has expired or was already used. Ask Zola for a new one."); else setWho(d);
    }).catch(() => setError("Something went wrong. Check your connection and try again."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (pw.a.length < 8) { setError("Choose a password with at least 8 characters"); return; }
    if (pw.a !== pw.b) { setError("The two passwords are different"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/pickup/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, password: pw.a }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      window.location.href = pk("/app");
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="pk-card pk-narrow">
      <h1 className="pk-h1">{who ? t("Welcome, {name}", { name: who.name.split(" ")[0] }) : t("Set up your rider account")}</h1>
      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(error)}</div>}
      {who && (
        <>
          <p className="hint" style={{ marginBottom: 14 }}>{t("Zola has made you a Pickup rider. Choose a password, then sign in any time with your number {phone} and this password.", { phone: prettyPhone(who.phone) })}</p>
          <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
            <div className="field"><label className="label" htmlFor="pw1">{t("New password")}</label><input id="pw1" className="input" type="password" autoComplete="new-password" minLength={8} value={pw.a} onChange={(e) => setPw((p) => ({ ...p, a: e.target.value }))} required /></div>
            <div className="field"><label className="label" htmlFor="pw2">{t("Type it again")}</label><input id="pw2" className="input" type="password" autoComplete="new-password" minLength={8} value={pw.b} onChange={(e) => setPw((p) => ({ ...p, b: e.target.value }))} required /></div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t("Saving...") : t("Save and open my rider app")}</button>
          </form>
        </>
      )}
    </section>
  );
}
