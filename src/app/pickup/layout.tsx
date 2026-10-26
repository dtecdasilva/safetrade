import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PickupBase } from "@/components/pickup/Base";
import LangSwitch from "@/components/LangSwitch";
import { PickupMark } from "@/components/pickup/Mark";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: "Pickup by Zola", template: "%s · Pickup" },
  description: "Parcel delivery in Cameroon: riders collect at the bus agency and bring it to your door. Follow your parcel on the map.",
  applicationName: "Pickup",
  // Pickup installs as its own app, with its own name and icon
  manifest: "/pickup/manifest.webmanifest",
  icons: {
    icon: [{ url: "/pickup/icon.svg", type: "image/svg+xml" }, { url: "/pickup/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/pickup/apple-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Pickup", statusBarStyle: "default" },
  openGraph: { title: "Pickup by Zola", siteName: "Pickup", type: "website", description: "Send anything, anywhere in your city. Follow your parcel on the map." },
};

export const viewport: Viewport = { themeColor: "#F08A24" };

/** Light shell for pickup.zolahq.com: the name, the language, nothing else. */
export default async function PickupLayout({ children }: { children: React.ReactNode }) {
  const { t } = getT();
  const session = await getSession();
  const host = (headers().get("host") || "").toLowerCase();
  const base = host.startsWith("pickup.") ? "" : "/pickup";
  return (
    <PickupBase base={base}>
      <div className="pk">
        <header className="pk-top">
          <Link href={base || "/"} className="pk-brand" aria-label="Pickup">
            <PickupMark /> <span>Pickup</span> <small>by Zola</small>
          </Link>
          <div className="pk-top-right">
            <Link href={`${base}${session ? "/my" : "/signin"}`} className="pk-account">{session ? t("My deliveries") : t("Sign in")}</Link>
            <LangSwitch />
          </div>
        </header>
        <main className="pk-main">{children}</main>
      </div>
    </PickupBase>
  );
}
