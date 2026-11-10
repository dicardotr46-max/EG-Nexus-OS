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

  // Navigation requests: Network-first with instant fallback to cached index.html (Fixes Reviewer #20, #25 & #27)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      let res;
      try {
        res = await fetch(req);
      } catch (networkError) {
        const cachedShell = await caches.match('./index.html');
        if (cachedShell) return cachedShell;
        return new Response('EG Nexus OS Offline Shell Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      // Decoupled cache write: Cache quota/write errors must never hide healthy network responses (Fixes Reviewer #25)
      const isSuccessful = !res.status || ((res.ok || res.status === 200) && res.status >= 200 && res.status < 300);
      if (res && isSuccessful) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', res.clone());
        } catch (cacheErr) {
          console.warn('SW navigation cache.put error:', cacheErr);
        }
      }
      return res;
    })());
    return;
  }

  // Static same-origin assets check: Only cache static web assets, never arbitrary API/data GETs (Fixes Reviewer #26)
  const pathname = url.pathname.toLowerCase();
  const isStaticAsset = pathname === '/' ||
    pathname.endsWith('.html') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2');

  if (!isStaticAsset) {
    // Pass dynamic same-origin requests straight through without caching
    return;
  }

  // Static same-origin assets: Stale-While-Revalidate with decoupled cache write (Fixes Reviewer #25 & #27)
  event.respondWith((async () => {
    const cached = await caches.match(req);

    const fetchPromise = (async () => {
      let res;
      try {
        res = await fetch(req);
      } catch (networkError) {
        if (cached) return cached;
        return new Response('Asset Unavailable Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      // Decoupled cache write
      if (res && (res.ok || res.status === 200) && res.status >= 200 && res.status < 300) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, res.clone());
        } catch (cacheErr) {
          console.warn('SW asset cache.put error:', cacheErr);
        }
      }
      return res;
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
