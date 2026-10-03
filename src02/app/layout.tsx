import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zola — Secure transactions. Simple payments.",
    template: "%s · Zola",
  },
  description:
    "Zola securely holds your payment until your transaction is completed, protecting both buyers and sellers every step of the way.",
  applicationName: "Zola",
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
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script type="text/javascript" src="https://www.monetbil.com/widget/v2/monetbil.min.js"></script>
      </body>
    </html>
  );
}
