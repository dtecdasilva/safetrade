"use client";
import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { useT } from "@/components/I18n";
import PickupMap from "@/components/pickup/Map";
import PlaceSearch from "@/components/pickup/PlaceSearch";

/**
 * Where the Pickup rider collects the parcel:
 *   same city    a spot the sender marks on the map (their shop, their home)
 *   another city the receiver's city, the bus agency the sender uses, and the
 *                agency office's quarter on the map (the price is worked out
 *                from there). Senders who don't know the quarter tick a box and
 *                the city centre is used. Offices others have used are suggested.
 * The value is sent as is to the API (deliveryMode, originLat/Lng/City/Landmark,
 * destCity, agencyName, agencyQuarter, agencyLat/Lng, agencyUnknown).
 */
export interface OriginValue {
  deliveryMode: "same_city" | "out_of_town" | "";
  originLat?: number; originLng?: number; originCity?: string; originLandmark?: string;
  destCity?: string;
  agencyName?: string; agencyQuarter?: string; agencyLat?: number; agencyLng?: number; agencyUnknown?: boolean;
  /** Older transactions only */
  destBranchId?: string;
}

export function originReady(v: OriginValue): boolean {
  if (v.deliveryMode === "out_of_town") return !!v.destBranchId
    || (!!v.destCity && (v.agencyName || "").trim().length >= 2 && (!!v.agencyUnknown || Number.isFinite(v.agencyLat)));
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
  const [spots, setSpots] = useState<{ id: string; agency: string; quarter: string; lat: number; lng: number }[]>([]);

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

  // Agency offices other senders used in that city
  useEffect(() => {
    setSpots([]);
    if (value.deliveryMode !== "out_of_town" || !value.destCity) return;
    fetch(`/api/pickup/agencies?city=${encodeURIComponent(value.destCity)}`).then((r) => r.json()).then((d) => setSpots(d.agencies || [])).catch(() => {});
  }, [value.deliveryMode, value.destCity]);

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
            <select id={`${idPrefix}-dest`} className="select" value={value.destCity || ""}
              onChange={(e) => set({ destCity: e.target.value, destBranchId: undefined, agencyLat: undefined, agencyLng: undefined, agencyQuarter: "" })}>
              <option value="">{t("Choose a city")}</option>
              {info.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {value.destCity && (
            <>
              {spots.length > 0 && (
                <div className="field">
                  <span className="label">{t("Agencies others send to in {city}", { city: value.destCity })}</span>
                  <div className="choice-row">
                    {spots.slice(0, 8).map((s) => {
                      const on = value.agencyName === s.agency && value.agencyLat === s.lat && value.agencyLng === s.lng;
                      return <button key={s.id} type="button" className="choice" aria-pressed={on}
                        onClick={() => set({ agencyName: s.agency, agencyQuarter: s.quarter, agencyLat: s.lat, agencyLng: s.lng, agencyUnknown: false })}>
                        {s.agency}{s.quarter ? ` · ${s.quarter}` : ""}</button>;
                    })}
                  </div>
                </div>
              )}
              <div className="field">
                <label className="label" htmlFor={`${idPrefix}-agency`}>{t("Bus agency you'll send it with")}</label>
                <input id={`${idPrefix}-agency`} className="input" maxLength={80} value={value.agencyName || ""}
                  onChange={(e) => set({ agencyName: e.target.value })} placeholder={t("For example: Touristique Express")} />
              </div>
              <div className="field">
                <span className="label">{t("Where is that agency in {city}?", { city: value.destCity })}</span>
                {!value.agencyUnknown && (
                  <>
                    <PlaceSearch city={value.destCity} placeholder={t("Search the quarter, for example Mvan")}
                      onPick={(p) => set({ agencyLat: p.lat, agencyLng: p.lng, agencyQuarter: (value.agencyQuarter || "").trim() ? value.agencyQuarter : p.name.split(",")[0] })} />
                    <PickupMap height={200} pick={Number.isFinite(value.agencyLat) ? { lat: value.agencyLat!, lng: value.agencyLng! } : null}
                      onPick={(p) => set({ agencyLat: p.lat, agencyLng: p.lng })} />
                    <input className="input" maxLength={80} aria-label={t("Quarter")} value={value.agencyQuarter || ""}
                      onChange={(e) => set({ agencyQuarter: e.target.value })} placeholder={t("Quarter, for example Mvan")} />
                  </>
                )}
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}>
                  <input type="checkbox" checked={!!value.agencyUnknown} onChange={(e) => set({ agencyUnknown: e.target.checked })} style={{ marginTop: 3 }} />
                  <span>{t("I don't know where the agency is in {city}. Use the city centre for the price.", { city: value.destCity })}</span>
                </label>
              </div>
            </>
          )}
          <p className="hint">{who === "seller"
            ? t("Once the buyer pays, we give you a Zola rider in that city. You send the parcel to them through this agency, and they collect it there and deliver it to the buyer.")
            : t("Once you pay, we give you a Pickup rider in that city. You send the parcel to them through this agency, and they collect it there and deliver it.")}</p>
        </>
      )}
    </div>
  );
}
