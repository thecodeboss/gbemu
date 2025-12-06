/* Minimal app-shell style service worker for GBEmu.
 * Caches the shell so install prompts work offline and serves static assets
 * from cache when available. */
const CACHE_VERSION = "v1";
const CACHE_NAME = `gbemu-pwa-${CACHE_VERSION}`;

const scopeUrl = new URL(self.registration.scope);
const cacheList = [
  new URL("./", scopeUrl).pathname,
  new URL("./index.html", scopeUrl).pathname,
  new URL("./manifest.webmanifest", scopeUrl).pathname,
  new URL("./icons/pwa-icon-192.png", scopeUrl).pathname,
  new URL("./icons/pwa-icon-512.png", scopeUrl).pathname,
  new URL("./icons/pwa-maskable-512.png", scopeUrl).pathname,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(cacheList))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key.startsWith("gbemu-pwa-")) {
              return caches.delete(key);
            }
            return undefined;
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const indexPath = new URL("./index.html", scopeUrl).pathname;
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(indexPath, copy));
          return response;
        } catch {
          const cached = await caches.match(indexPath);
          if (cached) return cached;
          return Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
