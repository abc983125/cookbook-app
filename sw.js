const CACHE = "xs-v2";
const VERSION = "2.0.0";
const URLS = ["index.html","manifest.json","css/style.css","js/app.js","js/dishes.js","version.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
    ])
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response("离线中", {status: 503})))
  );
});
