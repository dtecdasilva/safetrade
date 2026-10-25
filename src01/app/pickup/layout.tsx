import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PickupBase } from "@/components/pickup/Base";
import LangSwitch from "@/components/LangSwitch";
import { PickupMark } from "@/components/pickup/Mark";

export const metadata: Metadata = {
  title: { default: "Pickup by Zola", template: "%s · Pickup" },
  description: "Parcel delivery in Cameroon: riders collect at the bus agency and bring it to your door. Follow your parcel on the map.",
  applicationName: "Pickup",
  manifest: null,
};

/** Light shell for pickup.zolahq.com: the name, the language, nothing else. */
export default function PickupLayout({ children }: { children: React.ReactNode }) {
  const host = (headers().get("host") || "").toLowerCase();
  const base = host.startsWith("pickup.") ? "" : "/pickup";
  return (
    <PickupBase base={base}>
      <div className="pk">
        <header className="pk-top">
          <Link href={base || "/"} className="pk-brand" aria-label="Pickup">
            <PickupMark /> <span>Pickup</span> <small>by Zola</small>
          </Link>
          <LangSwitch />
        </header>
        <main className="pk-main">{children}</main>
      </div>
    </PickupBase>
  );
}
