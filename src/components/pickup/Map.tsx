"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A small map, using Leaflet and OpenStreetMap. Leaflet is loaded from a CDN
 * the first time a map is shown, so pages without a map stay light, and
 * nothing extra has to be installed in the project.
 */

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";

let loading: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = `${LEAFLET}/leaflet.css`;
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = `${LEAFLET}/leaflet.js`; js.async = true;
    js.onload = () => resolve(w.L);
    js.onerror = () => { loading = null; reject(new Error("map failed to load")); };
    document.head.appendChild(js);
  });
  return loading;
}

export interface MapMarker { id: string; lat: number; lng: number; kind: "branch" | "rider" | "dest" | "me"; label?: string }

export default function PickupMap({
  markers = [], height = 260, pick, onPick, follow,
}: {
  markers?: MapMarker[];
  height?: number;
  /** The point being chosen, when the map is used to pick a place. */
  pick?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  /** Keep this marker in view as it moves (the rider). */
  follow?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layers = useRef<Record<string, any>>({});
  const fitted = useRef(false);
  const pickCb = useRef(onPick);
  pickCb.current = onPick;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // Create the map once
  useEffect(() => {
    let gone = false;
    loadLeaflet().then((L) => {
      if (gone || !box.current || map.current) return;
      const first = pick || markers[0] || { lat: 4.05, lng: 9.7 }; // Douala until we know better
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([first.lat, first.lng], pick || markers.length ? 14 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: any) => pickCb.current?.({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 }));
      map.current = m;
      setReady(true);
    }).catch(() => setFailed(true));
    return () => { gone = true; map.current?.remove(); map.current = null; layers.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers
  useEffect(() => {
    const L = (window as any).L;
    const m = map.current;
    if (!ready || !L || !m) return;
    const all: MapMarker[] = [...markers, ...(pick ? [{ id: "__pick", lat: pick.lat, lng: pick.lng, kind: "dest" as const }] : [])];
    const keep = new Set(all.map((x) => x.id));
    for (const id of Object.keys(layers.current)) if (!keep.has(id)) { layers.current[id].remove(); delete layers.current[id]; }
    for (const x of all) {
      const icon = L.divIcon({ className: "", html: `<span class="pk-pin pk-pin-${x.kind}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      if (layers.current[x.id]) layers.current[x.id].setLatLng([x.lat, x.lng]);
      else {
        layers.current[x.id] = L.marker([x.lat, x.lng], { icon, keyboard: false }).addTo(m);
        if (x.label) layers.current[x.id].bindTooltip(x.label, { direction: "top", offset: [0, -10] });
      }
    }
    if (!fitted.current && all.length) {
      fitted.current = true;
      if (all.length === 1) m.setView([all[0].lat, all[0].lng], 15);
      else m.fitBounds(all.map((x) => [x.lat, x.lng]), { padding: [36, 36], maxZoom: 16 });
    } else if (follow && layers.current[follow]) {
      const ll = layers.current[follow].getLatLng();
      if (!m.getBounds().pad(-0.15).contains(ll)) m.panTo(ll);
    }
  }, [markers, pick, ready, follow]);

  // Move the view when the picked point changes from outside (e.g. "Use my location")
  useEffect(() => {
    if (ready && pick && map.current) map.current.setView([pick.lat, pick.lng], Math.max(map.current.getZoom(), 16));
  }, [pick?.lat, pick?.lng, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className="pk-map pk-map-off" style={{ height }}>Map unavailable. Check your connection.</div>;
  return <div ref={box} className="pk-map" style={{ height }} role="application" aria-label="Map" />;
}
