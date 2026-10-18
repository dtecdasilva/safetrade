import Link from "next/link";
import { headers } from "next/headers";
import { Bike, Wallet, MapPin, PackageCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import TrackBox from "@/components/pickup/TrackBox";
import { VALUE_RATIO } from "@/lib/pickup/config";

/** pickup.zolahq.com: for riders, and for buyers following a parcel. */
export default function PickupHome() {
  const { t } = getT();
  const base = (headers().get("host") || "").toLowerCase().startsWith("pickup.") ? "" : "/pickup";
  const steps = [
    { icon: <Wallet size={18} />, title: t("Top up your balance"), text: t("Your balance is your guarantee. With FCFA 5,000 you can carry parcels worth up to FCFA {max}.", { max: (5000 * VALUE_RATIO).toLocaleString("en-US") }) },
    { icon: <Bike size={18} />, title: t("Switch to available"), text: t("Pickup gives each parcel to the closest free rider. You carry one parcel at a time.") },
    { icon: <MapPin size={18} />, title: t("Collect at the agency"), text: t("The seller sends the parcel in your name through a bus agency. You collect it at the branch.") },
    { icon: <PackageCheck size={18} />, title: t("Deliver and get paid"), text: t("Bring it to the buyer, enter their 4-digit code, and the delivery fee is added to your balance.") },
  ];
  return (
    <div className="pk-home">
      <section className="pk-hero">
        <h1>{t("Deliver parcels in your city")}</h1>
        <p>{t("Pickup is Zola's delivery service. Riders collect parcels at bus agencies and bring them to buyers, who follow them on a map.")}</p>
        <div className="pk-actions">
          <Link href={`${base}/signup`} className="btn btn-primary btn-lg">{t("Become a rider")}</Link>
          <Link href={`${base}/login`} className="btn btn-secondary btn-lg">{t("Sign in")}</Link>
        </div>
      </section>

      <section className="pk-card">
        <h2 className="pk-h2">{t("Track a parcel")}</h2>
        <p className="hint" style={{ marginBottom: 10 }}>{t("Enter the tracking code from your Zola transaction.")}</p>
        <TrackBox />
      </section>

      <section className="pk-card">
        <h2 className="pk-h2">{t("How it works for riders")}</h2>
        <ol className="pk-steps">
          {steps.map((s) => (
            <li key={s.title}>
              <span className="pk-step-icon">{s.icon}</span>
              <div><p className="pk-step-title">{s.title}</p><p className="pk-step-text">{s.text}</p></div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
