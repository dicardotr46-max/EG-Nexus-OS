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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldCaches = keys.filter(key => key !== CACHE_NAME);
    await Promise.all(oldCaches.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Bypass external API calls (Gemini, OpenRouter, Tavily, Telegram, Local Termux Bridge, Supabase)
  if (url.origin !== self.location.origin) return;

  // Navigation requests: Network-first with instant fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', res.clone());
        return res;
      } catch (error) {
        return await caches.match('./index.html');
      }
    })());
    return;
  }

  // Static same-origin assets: Stale-While-Revalidate
  event.respondWith((async () => {
    const cached = await caches.match(req);

    const fetchPromise = (async () => {
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch (error) {
        return cached;
      }
    })();

    return cached || fetchPromise;
  })());
});
