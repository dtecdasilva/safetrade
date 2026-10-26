"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { useT } from "@/components/I18n";
import PickupMap, { MapMarker } from "@/components/pickup/Map";
import { DELIVERY_STATUS, DELIVERY_STEPS, DeliveryStatus } from "@/lib/pickup/config";
import { fmtDateTime } from "@/lib/zola";

/** Follow a parcel: where it is, on a map, and what has happened so far. */
export default function TrackPage() {
  const { t, lang } = useT();
  const { code } = useParams() as { code: string };
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/pickup/track/${encodeURIComponent(code)}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || "Tracking code not found"); return; }
    setError(""); setD(j);
  }, [code]);

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);

  if (error) return <section className="pk-card pk-narrow"><h1 className="pk-h1">{t("Track a parcel")}</h1><p className="notice notice-danger">{t(error)}</p></section>;
  if (!d) return <div className="pk-card" style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>;

  const meta = DELIVERY_STATUS[d.status as DeliveryStatus] || DELIVERY_STATUS.waiting_rider;
  const markers: MapMarker[] = [
    { id: "branch", lat: d.origin.lat, lng: d.origin.lng, kind: "branch", label: d.origin.label },
    ...(d.dest ? [{ id: "dest", lat: d.dest.lat, lng: d.dest.lng, kind: "dest" as const, label: t("You") }] : []),
    ...(d.rider_loc ? [{ id: "rider", lat: d.rider_loc.lat, lng: d.rider_loc.lng, kind: "rider" as const, label: d.rider || t("Rider") }] : []),
  ];
  const at = (s: string) => d.history.filter((h: any) => h.status === s).slice(-1)[0]?.at;
  const steps: [string, string][] = d.mode === "same_city"
    ? [["Paid", "paid"], ["Rider assigned", "assigned"], ["With the rider", "collected"], ["Delivered", "delivered"]]
    : DELIVERY_STEPS.map((s, i) => [s, ["assigned", "sent", "collected", "delivered"][i]] as [string, string]);
  const stepAt = steps.map(([, st]) => st === "paid" ? at("paid") || at("waiting_rider") : at(st));

  const sameCity = d.mode === "same_city";
  // Where it arrives: the chosen branch (older deliveries), the agency the sender used, or the city
  const arrive = d.branch ? `${d.branch.agency} ${d.branch.name}` : d.sent_agency ? `${d.sent_agency}, ${d.city}` : d.city;
  const line =
    d.status === "awaiting_payment" ? t("This delivery starts once it has been paid.")
    : d.status === "waiting_rider" ? (sameCity ? t("We're finding a rider near the sender.") : t("We're finding a rider near {branch}.", { branch: arrive }))
    : d.status === "assigned" ? (sameCity ? t("{rider} is on the way to collect your parcel.", { rider: d.rider }) : t("{rider} will collect your parcel at {branch} once the seller sends it.", { rider: d.rider, branch: d.branch ? arrive : t("the bus agency in {city}", { city: d.city }) }))
    : d.status === "sent" ? (d.branch
        ? t("Your parcel is travelling with {agency} to the {branch} branch. {rider} collects it when it arrives.", { agency: d.branch.agency, branch: d.branch.name, rider: d.rider })
        : t("Your parcel is travelling by bus to {city}{agency}. {rider} collects it when it arrives.", { city: d.city, agency: d.sent_agency ? ` (${d.sent_agency})` : "", rider: d.rider }))
    : d.status === "collected" ? t("{rider} has your parcel and is on the way.", { rider: d.rider })
    : d.status === "delivered" ? t("Your parcel was delivered.")
    : t("This delivery was cancelled.");

  return (
    <div className="pk-app">
      <section className="pk-card">
        <p className="pk-tag">{t(meta.label)}</p>
        <h1 className="pk-h1" style={{ marginBottom: 4 }}>{d.title}</h1>
        <p className="hint" style={{ marginBottom: 12 }}>{line}</p>
        <PickupMap markers={markers} height={320} follow="rider" />
        {d.status === "collected" && !d.rider_loc && <p className="hint" style={{ marginTop: 8 }}>{t("The rider's location will appear here as they move.")}</p>}
        <div className="pk-legend">
          <span><i className="pk-pin pk-pin-branch" /> {sameCity ? t("Pickup point") : d.branch ? t("Agency branch") : t("City")}</span>
          <span><i className="pk-pin pk-pin-rider" /> {t("Rider")}</span>
          <span><i className="pk-pin pk-pin-dest" /> {t("You")}</span>
        </div>
      </section>
      <section className="pk-card">
        <ol className="pk-track">
          {steps.map(([s], i) => (
            <li key={s} className={stepAt[i] ? "is-done" : ""}>
              <span className="pk-dot">{stepAt[i] && <Check size={12} strokeWidth={3} />}</span>
              <div><p>{t(s)}</p>{stepAt[i] && <p className="hint" suppressHydrationWarning>{fmtDateTime(stepAt[i], lang)}</p>}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
