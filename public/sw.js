// traincore service worker — hand-rolled (no bundler integration needed).
// Big win: the ~17 MB of ML assets (WASM runtime + pose model) are cached
// forever after the first attempt, so the counter starts instantly offline.
const ML_CACHE = "traincore-ml-v1";
const STATIC_CACHE = "traincore-static-v1";
const PAGE_CACHE = "traincore-pages-v1";
const KNOWN_CACHES = [ML_CACHE, STATIC_CACHE, PAGE_CACHE];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "traincore", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await clients.openWindow(url);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/models/") || url.pathname.startsWith("/mediapipe/")) {
    event.respondWith(cacheFirst(ML_CACHE, request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(STATIC_CACHE, request));
    return;
  }
  if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(PAGE_CACHE, request));
  }
});
