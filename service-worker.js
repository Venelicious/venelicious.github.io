const APP_REVISION = "2026-02-25-01";
const CACHE_NAME = `provision-pwa-${APP_REVISION}`;


const EXTERNAL_ASSET_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.29/dist/jspdf.plugin.autotable.min.js"
];
const EXTERNAL_ASSET_SET = new Set(EXTERNAL_ASSET_URLS);
const FILES_TO_CACHE = [
  "./",
  "./README.md",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/styles.css",
  "./assets/ui.js",
  "./assets/calculations.js",
  "./assets/db.js",
  "./assets/lohnsteuer2025.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("provision-pwa-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./", responseClone));
          return response;
        })
        .catch(() => caches.match("./").then((response) => response || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || !networkResponse.ok) return networkResponse;

        const requestUrl = new URL(event.request.url);
        const isSameOrigin = requestUrl.origin === self.location.origin;
        const isExternalPdfDependency = EXTERNAL_ASSET_SET.has(event.request.url);

        if (isSameOrigin || isExternalPdfDependency) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }

        return networkResponse;
      });
    })
  );
});
