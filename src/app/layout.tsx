import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeTrade — Escrow-protected trades",
  description: "No scams. No disputes without a referee.",
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
