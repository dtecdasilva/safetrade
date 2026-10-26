"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocateFixed, Send, UserRound } from "lucide-react";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { PhoneField } from "@/components/ui";
import PickupMap from "@/components/pickup/Map";
import PlaceSearch from "@/components/pickup/PlaceSearch";
import OriginPicker, { OriginValue, originReady } from "@/components/pickup/OriginPicker";
import { money } from "@/lib/zola";

/** Book a delivery: what, from where, to where, who receives it. Pay on the next page. */
const SAVED = "pickup-sender";

export default function SendPage() {
  const { t, lang } = useT();
  const pk = usePk();
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [form, setForm] = useState({ title: "", value: "", destLandmark: "", recipientName: "", recipientPhone: "", senderName: "", senderPhone: "", senderEmail: "" });
  // The signed-in sender (false = not signed in)
  const [me, setMe] = useState<{ name: string; phone: string; email: string } | false | null>(null);
  const [origin, setOrigin] = useState<OriginValue>({ deliveryMode: "same_city" });
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [price, setPrice] = useState<{ km: number; fee: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Signed in? Then their details come from the account. Otherwise they type them (an account is optional).
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(SAVED) || "null"); if (s) setForm((f) => ({ ...f, ...s })); } catch {}
    fetch("/api/profile", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) { setMe(false); return; }
      const d = await r.json(); const p = d.profile || {};
      setMe({ name: p.name || "", phone: p.phone || "", email: p.email || "" });
    }).catch(() => setMe(false));
  }, []);

  // The price, as soon as both places are known
  useEffect(() => {
    setPrice(null);
    if (!dest || !originReady({ ...origin, originLandmark: origin.originLandmark || "xxx" })) return;
    const body = origin.deliveryMode === "out_of_town" ? (origin.destCity ? { destCity: origin.destCity } : { destBranchId: origin.destBranchId }) : { originLat: origin.originLat, originLng: origin.originLng };
    const h = setTimeout(() => {
      fetch("/api/pickup/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, destLat: dest.lat, destLng: dest.lng }) })
        .then((r) => r.json()).then((d) => { if (d.fee) setPrice(d); }).catch(() => {});
    }, 300);
    return () => clearTimeout(h);
  }, [dest, origin]);

  function locateDest() {
    navigator.geolocation?.getCurrentPosition((p) => setDest({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const res = await fetch("/api/pickup/deliveries", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...origin, value: Number(form.value || 0), destLat: dest?.lat, destLng: dest?.lng, lang }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      if (!me) { try { localStorage.setItem(SAVED, JSON.stringify({ senderName: form.senderName, senderPhone: form.senderPhone, senderEmail: form.senderEmail })); } catch {} }
      router.push(pk(`/d/${d.id}?k=${d.key}`));
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (enabled === false) return <section className="pk-card pk-narrow"><h1 className="pk-h1">{t("Send a parcel")}</h1><p className="notice notice-wait">{t("Pickup isn't taking deliveries yet. Check back soon.")}</p></section>;

  if (me === null) return <div className="pk-card" style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>;
  const ready = form.title.trim().length >= 2 && originReady(origin) && !!dest && form.destLandmark.trim().length >= 3
    && form.recipientName.trim().length >= 2 && form.recipientPhone.length >= 9 && (me ? (!!me.phone || form.senderPhone.length >= 9) : form.senderName.trim().length >= 2 && form.senderPhone.length >= 9);

  return (
    <form onSubmit={submit} className="pk-app">
      <section className="pk-card">
        <h1 className="pk-h1">{t("Send a parcel")}</h1>
        <p className="hint" style={{ marginBottom: 14 }}>{t("A checked Pickup rider collects it and delivers it. You pay by mobile money before the rider is sent, and follow it on the map.")}</p>
        {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>{t(error)}</div>}
        <div className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="title">{t("What are you sending?")}</label>
            <input id="title" className="input" maxLength={120} placeholder={t("For example: a bag of clothes, documents, a phone")} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="value">{t("What is it worth? (FCFA)")}</label>
            <input id="value" className="input num" type="number" min="0" inputMode="numeric" placeholder="0" value={form.value} onChange={(e) => set("value", e.target.value)} />
            <p className="hint">{t("Only riders whose guarantee covers this value are sent.")}</p>
          </div>
        </div>
      </section>

      <section className="pk-card">
        <h2 className="pk-h2">{t("From")}</h2>
        <OriginPicker value={origin} onChange={setOrigin} onLoaded={setEnabled} who="sender" idPrefix="snd" />
      </section>

      <section className="pk-card">
        <h2 className="pk-h2">{t("To")}</h2>
        <div className="stack" style={{ gap: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={locateDest} style={{ alignSelf: "flex-start" }}><LocateFixed size={15} /> {t("I'm at the delivery place")}</button>
          <PlaceSearch city={origin.deliveryMode === "same_city" ? origin.originCity : undefined} placeholder={t("Search the delivery place, for example Total Bonamoussadi")}
            onPick={(p) => { setDest({ lat: p.lat, lng: p.lng }); if (!form.destLandmark.trim()) set("destLandmark", p.name); }} />
          <PickupMap height={220} pick={dest} onPick={setDest} />
          <p className="hint">{t("Tap the map where it should be delivered.")}</p>
          <input className="input" maxLength={200} aria-label={t("How the rider finds the place")} placeholder={t("For example: behind Total Bonamoussadi, blue gate")} value={form.destLandmark} onChange={(e) => set("destLandmark", e.target.value)} />
          <div className="form-grid-2">
            <div className="field"><label className="label" htmlFor="rn">{t("Receiver's name")}</label><input id="rn" className="input" value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="rp">{t("Receiver's phone")}</label><PhoneField id="rp" value={form.recipientPhone} onChange={(v) => set("recipientPhone", v)} /></div>
          </div>
        </div>
      </section>

      {me ? (
        <section className="pk-card">
          <div className="kv" style={{ alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><UserRound size={16} /> {t("Sending as")}</span>
            <span style={{ textAlign: "right" }}><strong>{me.name}</strong>{me.phone && <><br /><span className="hint num">+237 {me.phone}</span></>}</span>
          </div>
          {!me.phone && (
            <div className="field" style={{ marginTop: 10 }}><label className="label" htmlFor="sp">{t("Your phone")}</label><PhoneField id="sp" value={form.senderPhone} onChange={(v) => set("senderPhone", v)} /></div>
          )}
        </section>
      ) : (
        <section className="pk-card">
          <h2 className="pk-h2">{t("Your details")}</h2>
          <p className="hint" style={{ marginBottom: 10 }}>{t("No account needed.")} <Link href={pk("/signin")}>{t("Sign in")}</Link> {t("or")} <Link href={pk("/join")}>{t("create an account")}</Link> {t("to keep all your deliveries in one place.")}</p>
          <div className="stack" style={{ gap: 10 }}>
            <div className="form-grid-2">
              <div className="field"><label className="label" htmlFor="sn">{t("Your name")}</label><input id="sn" className="input" autoComplete="name" value={form.senderName} onChange={(e) => set("senderName", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="sp">{t("Your phone")}</label><PhoneField id="sp" value={form.senderPhone} onChange={(v) => set("senderPhone", v)} /></div>
            </div>
            <div className="field"><label className="label" htmlFor="se">{t("Email (optional, for updates)")}</label><input id="se" className="input" type="email" autoComplete="email" value={form.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} /></div>
          </div>
        </section>
      )}

      <section className="pk-card pk-price">
        {price ? (
          <>
            <div className="kv"><span>{t("Distance by road, about")}</span><span>{price.km} km</span></div>
            <div className="kv kv-total"><span>{t("Delivery price")}</span><span>{money(price.fee)}</span></div>
          </>
        ) : <p className="hint">{t("Mark both places to see the price.")}</p>}
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 12 }} disabled={busy || !ready}>
          <Send size={17} /> {busy ? t("Booking...") : price ? t("Book and pay {fee}", { fee: money(price.fee) }) : t("Book the delivery")}
        </button>
      </section>
    </form>
  );
}
