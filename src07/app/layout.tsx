import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import PwaSetup from "@/components/PwaSetup";

export const metadata: Metadata = {
  title: {
    default: "Zola — Secure transactions. Simple payments.",
    template: "%s · Zola",
  },
  description:
    "Zola securely holds your payment until your transaction is completed, protecting both buyers and sellers every step of the way.",
  applicationName: "Zola",
  // Lets iPhones open Zola full-screen when it is added to the home screen
  appleWebApp: { capable: true, title: "Zola", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Zola — Buy and sell online with confidence.",
    description:
      "Zola securely holds your payment until your transaction is completed, protecting both buyers and sellers every step of the way.",
    siteName: "Zola",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#087F5B",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved or device theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <PwaSetup />
        <script type="text/javascript" src="https://www.monetbil.com/widget/v2/monetbil.min.js"></script>
      </body>
    </html>
  );
}
