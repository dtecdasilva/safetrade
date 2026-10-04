/*
 * Zola no longer uses a service worker.
 *
 * An earlier version installed one to show an offline page. It sat in the
 * path of every page load and interfered with signing in through Google, so
 * it has been removed. This file exists only to clean up: any phone or
 * browser that still has the old one will load this, which deletes what the
 * old one stored, removes itself, and reloads the page without it.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    await self.registration.unregister();
    const pages = await self.clients.matchAll({ type: "window" });
    pages.forEach((page) => { try { page.navigate(page.url); } catch (e) {} });
  })());
});
