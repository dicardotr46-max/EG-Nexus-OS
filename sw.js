// ============================================================================
// EG NEXUS OS v5.1 — STANDARD PWA SERVICE WORKER (OFFLINE-FIRST SHELL)
// ============================================================================
const CACHE_NAME = 'eg-nexus-os-v5.1-pwa-cache';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Bypass external API calls (Gemini, OpenRouter, Tavily, Telegram, Local Termux Bridge, Supabase)
  if (url.origin !== self.location.origin) return;

  // Navigation requests: Network-first with instant fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static same-origin assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const netFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || netFetch;
    })
  );
});
