import type { MetadataRoute } from "next";

/**
 * Web app manifest: lets people install Zola on their phone's home screen
 * ("Add to Home screen"), where it opens full-screen like an app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zola",
    short_name: "Zola",
    description: "Secure transactions. Simple payments. Zola holds the payment until delivery is confirmed.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8FAFC",
    theme_color: "#087F5B",
    lang: "en",
    categories: ["finance", "shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png",     sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png",     sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Transactions", url: "/transactions", description: "See all your transactions" },
    ],
  };
}
