"use client";
import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { useT } from "@/components/I18n";
import PickupMap from "@/components/pickup/Map";
import PlaceSearch from "@/components/pickup/PlaceSearch";

/** The buyer marks where the rider should bring the parcel. */
export default function DeliverySpot({ tradeId, initial, onSaved, saveLabel }: {
  tradeId: string; initial?: { lat: number; lng: number; landmark?: string } | null; onSaved?: () => void; saveLabel?: string;
}) {
  const { t } = useT();
  const [spot, setSpot] = useState<{ lat: number; lng: number } | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [landmark, setLandmark] = useState(initial?.landmark || "");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function locate() {
    setErr("");
    if (!navigator.geolocation) { setErr("Your phone can't share its location. Tap the map instead."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setSpot({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => setErr("Location is blocked. Allow it for this site, or tap the map instead."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save() {
    if (!spot) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch(`/api/trades/${tradeId}/delivery-spot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...spot, landmark }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "Something went wrong. Please try again."); return; }
      setMsg("Saved. The rider will see this once they have your parcel.");
      onSaved?.();
    } catch { setErr("Something went wrong. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={locate} style={{ alignSelf: "flex-start" }}>
        <LocateFixed size={15} /> {t("Use my location")}
      </button>
      <PlaceSearch onPick={(p) => { setSpot({ lat: p.lat, lng: p.lng }); if (!landmark.trim()) setLandmark(p.name); }} />
      <PickupMap height={220} pick={spot} onPick={setSpot} />
      <p className="hint"><MapPin size={13} /> {t("Tap the map to move the pin.")}</p>
      <div className="field">
        <label className="label" htmlFor="landmark">{t("How the rider finds you")}</label>
        <input id="landmark" className="input" maxLength={200} value={landmark} onChange={(e) => setLandmark(e.target.value)}
          placeholder={t("For example: behind Total Bonamoussadi, blue gate")} />
      </div>
      <button className="btn btn-primary" disabled={busy || !spot || landmark.trim().length < 3} onClick={save}>{busy ? t("Saving...") : saveLabel || t("Save delivery spot")}</button>
      {err && <p role="alert" className="hint-error">{t(err)}</p>}
      {msg && <p role="status" className="hint" style={{ color: "var(--emerald-press)", fontWeight: 600 }}>{t(msg)}</p>}
    </div>
  );
}
