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
    // Only delete previous versions of EG Nexus OS caches, never other apps on the same origin (Fixes Reviewer #28)
    const oldCaches = keys.filter(key => key.startsWith('eg-nexus-os-') && key !== CACHE_NAME);
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

  // Navigation requests: Network-first with instant fallback to cached index.html (Fixes Reviewer #27)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', res.clone());
        return res;
      } catch (error) {
        const cachedShell = await caches.match('./index.html');
        if (cachedShell) return cachedShell;
        return new Response('EG Nexus OS Offline Shell Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Static same-origin assets: Stale-While-Revalidate (Fixes Reviewer #27 - Never returns undefined)
  event.respondWith((async () => {
    const cached = await caches.match(req);

    const fetchPromise = (async () => {
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, res.clone());
        }
        return res;
      } catch (error) {
        if (cached) return cached;
        return new Response('Asset Unavailable Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })();

    if (cached) {
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(fetchPromise);
      }
      return cached;
    }
    return fetchPromise;
  })());
});
