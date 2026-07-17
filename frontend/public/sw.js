// Pravah service worker — offline-first for the last mile.
// Precaches the app shell, the data bundle and the on-device model so the
// platform keeps working with zero connectivity after the first visit.

const CACHE = "pravah-v1";
const PRECACHE = [
  "/",
  "/officer",
  "/app",
  "/data/pravah_bundle.json",
  "/models/risk_trees.json",
  "/models/risk.onnx",
  "/models/flying-island.glb",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for the critical offline data + model artifacts.
  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/models/")) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Stale-while-revalidate for everything else on this origin.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
