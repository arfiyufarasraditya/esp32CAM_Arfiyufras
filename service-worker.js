
const CACHE_NAME = "camvision-offline-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Simpan dashboard ketika pertama kali dibuka
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

// Aktifkan cache
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// Buka dashboard dari cache ketika offline
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Jangan cache stream kamera atau API ESP32
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.includes("/stream") ||
    url.pathname.includes("/flash")
  ) return;

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    }).catch(() => {
      return caches.match("./index.html");
    })
  );
});
