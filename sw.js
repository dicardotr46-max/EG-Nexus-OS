// ============================================================================
// EG NEXUS OS v6.2.1 — STANDARD PWA SERVICE WORKER (OFFLINE-FIRST SHELL)
// ============================================================================
const CACHE_NAME = 'eg-nexus-os-v6.2.1-pwa-cache';
const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/core/sanitization.js',
  './src/security/secrets.js',
  './src/security/approvals.js',
  './src/core/state.js',
  './src/core/persistence.js',
  './src/providers/registry.js',
  './src/sanitization.js',
  './src/secrets.js',
  './src/approvals.js',
  './src/state.js',
  './src/persistence.js',
  './src/registry.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Atomic pre-cache: fail installation if core assets cannot be securely cached (Fixes Reviewer #11)
    await cache.addAll(CORE_ASSETS);
    try {
      await self.skipWaiting();
    } catch (e) {}
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      // Ensure the new active cache exists and contains the offline shell before purging previous caches (Fixes Reviewer #11)
      if (keys.includes(CACHE_NAME)) {
        const currentCache = await caches.open(CACHE_NAME);
        const shell = await currentCache.match('./index.html').catch(() => null);
        if (shell) {
          // Only delete previous versions of EG Nexus OS caches, never other apps on the same origin (Fixes Reviewer #28)
          const oldCaches = keys.filter(key => key.startsWith('eg-nexus-os-') && key !== CACHE_NAME);
          await Promise.all(oldCaches.map(key => caches.delete(key)));
        }
      }
    } catch (e) {
      console.warn('[SW] Caches cleanup failed during activate:', e);
    }
    try {
      await self.clients.claim();
    } catch (e) {}
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Handle external Google Identity Services (GIS) gracefully in offline mode
  if (url.hostname === 'accounts.google.com' && url.pathname.includes('/gsi/client')) {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (_) {
        return new Response(
          '/* Google GIS Offline Fallback */ window.google = window.google || {}; window.google.accounts = window.google.accounts || { id: { initialize: function(){}, prompt: function(){}, renderButton: function(){} }, oauth2: { initTokenClient: function(){ return { requestAccessToken: function(){} }; } } };',
          {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          }
        );
      }
    })());
    return;
  }

  // Handle external fonts and CDNs gracefully in offline mode
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (_) {
        return new Response('', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/plain' }
        });
      }
    })());
    return;
  }

  // Bypass external API calls (Gemini, OpenRouter, Tavily, Telegram, Local Termux Bridge, Supabase)
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname.toLowerCase();

  // AUD-PWA-01: Serve cached SVG response for /favicon.ico so it never 404s/503s
  if (pathname === '/favicon.ico' || pathname.endsWith('/favicon.ico')) {
    event.respondWith(new Response(FAVICON_SVG, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    }));
    return;
  }

  // Navigation requests: Network-first with instant fallback to cached index.html (Fixes Reviewer #20, #25 & #27)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      let res;
      try {
        res = await fetch(req);
      } catch (networkError) {
        const cachedShell = await caches.match('./index.html').catch(() => null);
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
    const cached = await caches.match(req).catch(() => null);

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
