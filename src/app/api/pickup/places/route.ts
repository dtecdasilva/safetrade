import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Search for a place by name ("Carrefour Bastos", "Total Bonamoussadi") so
 * people don't have to find it on the map themselves.
 *
 * Uses OpenStreetMap's free search (Nominatim) from the server, limited to
 * Cameroon and biased to the city chosen. Its rules: at most one search per
 * second, a name for our app, and no search-as-you-type. So people press
 * Search, results are kept for a day, and searches are spaced out here.
 */
const SEARCH_URL = process.env.PLACES_URL || "https://nominatim.openstreetmap.org/search";
const cache = new Map<string, { at: number; results: any[] }>();
let last = 0;

export async function GET(req: NextRequest) {
  const q = String(req.nextUrl.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const city = String(req.nextUrl.searchParams.get("city") || "").trim().slice(0, 60);
  if (q.length < 3) return NextResponse.json({ error: "Type at least 3 letters" }, { status: 400 });

  const key = `${q}|${city}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600e3) return NextResponse.json({ results: hit.results });

  // Space searches at least a second apart
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 3000)));
  last = Date.now();

  try {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", city && !q.toLowerCase().includes(city.toLowerCase()) ? `${q}, ${city}` : q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "cm");
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "0");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "ZolaPickup/1.0 (https://www.zolahq.com)", "Accept-Language": "fr,en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: "Search isn't available right now. Tap the map instead." }, { status: 502 });
    const data = await res.json();
    const results = (Array.isArray(data) ? data : []).map((p: any) => {
      const parts = String(p.display_name || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      return { name: p.name || parts[0] || "", address: parts.slice(p.name ? 1 : 1, 4).join(", "), lat: Number(p.lat), lng: Number(p.lon) };
    }).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    cache.set(key, { at: Date.now(), results });
    if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Search isn't available right now. Tap the map instead." }, { status: 502 });
  }
}
