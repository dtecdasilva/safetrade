/*
 * Zola service worker.
 *
 * Deliberately minimal. It does NOT cache pages, API responses or anything
 * about a person's account: every request goes to the network as normal.
 * Its only job is to show a friendly "You're offline" page when a page can't
 * be loaded because there is no connection.
 *
 * It never touches /api/ addresses, so sign-in (including Google) and
 * payment hand-offs go straight to the server exactly as they would without it.
 */
const CACHE = "zola-offline-v3";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only full page loads; everything else is left completely alone
  if (event.request.mode !== "navigate") return;
  // Never sit in the middle of sign-in or payment hand-offs
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
