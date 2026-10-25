"use client";
import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { useT } from "@/components/I18n";

/**
 * Find a place by name and drop the pin there. Searches when the person
 * presses Search (OpenStreetMap doesn't allow search-as-you-type).
 */
export default function PlaceSearch({ city, onPick, placeholder }: {
  city?: string;
  onPick: (p: { lat: number; lng: number; name: string }) => void;
  placeholder?: string;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    if (q.trim().length < 3) { setErr("Type at least 3 letters"); return; }
    setBusy(true); setErr(""); setResults(null);
    try {
      const res = await fetch(`/api/pickup/places?q=${encodeURIComponent(q.trim())}${city ? `&city=${encodeURIComponent(city)}` : ""}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "Search isn't available right now. Tap the map instead."); return; }
      setResults(d.results || []);
    } catch { setErr("Search isn't available right now. Tap the map instead."); }
    finally { setBusy(false); }
  }

  return (
    <div className="pk-search">
      <div className="pk-row">
        <input className="input" type="search" value={q} aria-label={t("Search for a place")}
          placeholder={placeholder || t("Search a place, for example Carrefour Bastos")}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <button type="button" className="btn btn-secondary" onClick={search} disabled={busy}><Search size={16} /> {busy ? t("Searching...") : t("Search")}</button>
      </div>
      {err && <p className="hint-error">{t(err)}</p>}
      {results && results.length === 0 && <p className="hint">{t("Nothing found. Try another name, or tap the map.")}</p>}
      {results && results.length > 0 && (
        <ul className="pk-results" role="listbox" aria-label={t("Places found")}>
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button type="button" onClick={() => { onPick({ lat: r.lat, lng: r.lng, name: r.name }); setResults(null); }}>
                <MapPin size={15} />
                <span><strong>{r.name}</strong>{r.address && <span className="hint"> · {r.address}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
