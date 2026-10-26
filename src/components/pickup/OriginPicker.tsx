"use client";
import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { useT } from "@/components/I18n";
import PickupMap from "@/components/pickup/Map";
import PlaceSearch from "@/components/pickup/PlaceSearch";

/**
 * Where the Pickup rider collects the parcel:
 *   same city    a spot the sender marks on the map (their shop, their home)
 *   another city the receiver's city: once paid, a rider there is chosen and the
 *                sender sends it to them by any bus agency (no agency to pick)
 * The value is sent as is to the API (deliveryMode, originLat/Lng/City/Landmark, destCity).
 */
export interface OriginValue {
  deliveryMode: "same_city" | "out_of_town" | "";
  originLat?: number; originLng?: number; originCity?: string; originLandmark?: string;
  destCity?: string;
  /** Older transactions only */
  destBranchId?: string;
}

export function originReady(v: OriginValue): boolean {
  if (v.deliveryMode === "out_of_town") return !!v.destCity || !!v.destBranchId;
  if (v.deliveryMode === "same_city") return Number.isFinite(v.originLat) && !!v.originCity && (v.originLandmark || "").trim().length >= 3;
  return false;
}

export default function OriginPicker({
  value, onChange, onLoaded, who = "seller", initialSpot, idPrefix = "og",
}: {
  value: OriginValue; onChange: (v: OriginValue) => void;
  /** Called with whether Pickup is on, once known. */
  onLoaded?: (enabled: boolean) => void;
  who?: "seller" | "sender";
  initialSpot?: { lat: number; lng: number; city?: string; landmark?: string; label?: string } | null;
  idPrefix?: string;
}) {
  const { t } = useT();
  const [info, setInfo] = useState<{ enabled: boolean; cities: string[] } | null>(null);
  const [locErr, setLocErr] = useState("");

  useEffect(() => {
    fetch("/api/pickup/cities").then((r) => r.json()).then((d) => { setInfo(d); onLoaded?.(!!d.enabled); }).catch(() => { setInfo({ enabled: false, cities: [] }); onLoaded?.(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start from the spot used last time
  useEffect(() => {
    if (value.deliveryMode === "same_city" && value.originLat === undefined && initialSpot) {
      onChange({ ...value, originLat: initialSpot.lat, originLng: initialSpot.lng, originCity: initialSpot.city || value.originCity, originLandmark: initialSpot.landmark || initialSpot.label || "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.deliveryMode]);

  if (!info || !info.enabled) return null;
  const set = (p: Partial<OriginValue>) => onChange({ ...value, ...p });
  const spot = Number.isFinite(value.originLat) ? { lat: value.originLat!, lng: value.originLng! } : null;

  function locate() {
    setLocErr("");
    if (!navigator.geolocation) { setLocErr("Your phone can't share its location. Tap the map instead."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => set({ originLat: Math.round(p.coords.latitude * 1e6) / 1e6, originLng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => setLocErr("Location is blocked. Allow it for this site, or tap the map instead."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="field">
        <span className="label">{who === "seller" ? t("Where is the buyer?") : t("Where is it going?")}</span>
        <div className="seg" role="group" aria-label={t("Where is the buyer?")}>
          <button type="button" className="seg-item" aria-pressed={value.deliveryMode === "same_city"} onClick={() => set({ deliveryMode: "same_city" })}>{t("Same city")}</button>
          <button type="button" className="seg-item" aria-pressed={value.deliveryMode === "out_of_town"} onClick={() => set({ deliveryMode: "out_of_town" })}>{t("Another city")}</button>
        </div>
      </div>

      {value.deliveryMode === "same_city" && (
        <>
          <p className="hint">{who === "seller" ? t("A Pickup rider comes to collect it from you and takes it to the buyer. No agency needed.") : t("A Pickup rider comes to collect it from you. No agency needed.")}</p>
          <div className="field">
            <label className="label" htmlFor={`${idPrefix}-city`}>{t("Your city")}</label>
            <select id={`${idPrefix}-city`} className="select" value={value.originCity || ""} onChange={(e) => set({ originCity: e.target.value })}>
              <option value="">{t("Choose a city")}</option>
              {info.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="label">{t("Where the rider collects it")}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={locate} style={{ alignSelf: "flex-start" }}><LocateFixed size={15} /> {t("Use my location")}</button>
            {locErr && <p className="hint-error">{t(locErr)}</p>}
            <PlaceSearch city={value.originCity} onPick={(p) => set({ originLat: p.lat, originLng: p.lng, ...(!(value.originLandmark || "").trim() ? { originLandmark: p.name } : {}) })} />
            <PickupMap height={200} pick={spot} onPick={(p) => set({ originLat: p.lat, originLng: p.lng })} />
            <input className="input" aria-label={t("How the rider finds you")} maxLength={160} value={value.originLandmark || ""}
              onChange={(e) => set({ originLandmark: e.target.value })} placeholder={t("For example: Akwa, shop next to Orange, ask for Awa")} />
          </div>
        </>
      )}

      {value.deliveryMode === "out_of_town" && (
        <>
          <div className="field">
            <label className="label" htmlFor={`${idPrefix}-dest`}>{who === "seller" ? t("Buyer's city") : t("Receiver's city")}</label>
            <select id={`${idPrefix}-dest`} className="select" value={value.destCity || ""} onChange={(e) => set({ destCity: e.target.value, destBranchId: undefined })}>
              <option value="">{t("Choose a city")}</option>
              {info.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="hint">{who === "seller"
            ? t("Once the buyer pays, we give you a Zola rider in that city. You send the parcel to them by any bus agency, and they deliver it to the buyer.")
            : t("Once you pay, we give you a Pickup rider in that city. You send the parcel to them by any bus agency, and they deliver it.")}</p>
        </>
      )}
    </div>
  );
}
