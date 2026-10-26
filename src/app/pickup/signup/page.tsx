"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LocateFixed } from "lucide-react";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { PhoneField } from "@/components/ui";
import PickupMap from "@/components/pickup/Map";
import PlaceSearch from "@/components/pickup/PlaceSearch";

export default function RiderSignup() {
  const { t, lang } = useT();
  const pk = usePk();
  const [cities, setCities] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", city: "", baseAddress: "" });
  const [base, setBase] = useState<{ lat: number; lng: number } | null>(null);
  const [locMsg, setLocMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/pickup/cities").then((r) => r.json()).then((d) => setCities(d.cities || [])).catch(() => {});
  }, []);

  function locate() {
    setLocMsg("");
    if (!navigator.geolocation) { setLocMsg("Your phone can't share its location. Tap the map instead."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setBase({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => setLocMsg("Location is blocked. Allow it for this site, or tap the map instead."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!base) { setError("Set where you usually start from: press Use my location"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/pickup/signup", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, baseLat: base.lat, baseLng: base.lng, lang }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      window.location.href = pk("/app");
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="pk-card pk-narrow">
      <h1 className="pk-h1">{t("Become a Pickup rider")}</h1>
      <p className="hint" style={{ marginBottom: 14 }}>{t("Zola checks every rider in person before they can take deliveries. Bring your national ID when we call you.")}</p>
      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(error)}</div>}
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="name">{t("Full name")}</label>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="phone">{t("WhatsApp number")}</label>
          <PhoneField id="phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <p className="hint">{t("Sellers write this number on the parcel, and buyers call it.")}</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="email">{t("Email")}</label>
          <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">{t("Password")}</label>
          <input id="password" className="input" type="password" autoComplete="new-password" placeholder={t("At least 8 characters")} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="city">{t("City where you deliver")}</label>
          <input id="city" className="input" list="pk-cities" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Douala" required />
          <datalist id="pk-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field">
          <span className="label">{t("Where you usually start from")}</span>
          <p className="hint" style={{ marginBottom: 6 }}>{t("Used to give you parcels near you when your live location is off. Press the button, or tap the map.")}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={locate} style={{ alignSelf: "flex-start" }}><LocateFixed size={15} /> {t("Use my location")}</button>
          {locMsg && <p className="hint-error">{t(locMsg)}</p>}
          <PlaceSearch city={form.city} onPick={(p) => { setBase({ lat: p.lat, lng: p.lng }); if (!form.baseAddress.trim()) setForm((f) => ({ ...f, baseAddress: p.name })); }} />
          <PickupMap height={200} pick={base} onPick={setBase} />
          <input className="input" aria-label={t("Neighbourhood")} placeholder={t("Neighbourhood, for example Akwa")} value={form.baseAddress} onChange={(e) => setForm((f) => ({ ...f, baseAddress: e.target.value }))} />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t("Creating your account...") : t("Create my rider account")}</button>
      </form>
      <p className="hint" style={{ marginTop: 14, textAlign: "center" }}>{t("Already a rider?")} <Link href={pk("/login")}>{t("Sign in")}</Link></p>
    </section>
  );
}
