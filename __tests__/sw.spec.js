const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Service Worker (sw.js)', () => {
  let listeners;
  let mockCache;
  let mockCaches;
  let mockFetch;
  let mockSelf;

  if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = init.headers || {};
    }
  };
}

beforeEach(() => {
    listeners = {};

    mockCache = {
      addAll: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(undefined),
      match: jest.fn().mockImplementation((key) => Promise.resolve(key === './index.html' ? new global.Response('<html></html>') : undefined))
    };

    mockCaches = {
      open: jest.fn().mockResolvedValue(mockCache),
      keys: jest.fn().mockResolvedValue(['eg-nexus-os-v5.0-old-cache', 'eg-nexus-os-v5.9.0-pwa-cache', 'other-origin-cache']),
      delete: jest.fn().mockResolvedValue(true),
      match: jest.fn().mockResolvedValue(undefined)
    };

    mockFetch = jest.fn();

    mockSelf = {
      addEventListener: (event, cb) => { listeners[event] = cb; },
      skipWaiting: jest.fn().mockResolvedValue(undefined),
      clients: {
        claim: jest.fn().mockResolvedValue(undefined)
      },
      location: { origin: 'https://example.com' }
    };

    const context = vm.createContext({
      self: mockSelf,
      caches: mockCaches,
      fetch: mockFetch,
      URL: URL,
      Promise: Promise,
      console: console,
      Response: global.Response
    });

    const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
    vm.runInContext(swCode, context);
  });

  it('should register install, activate, and fetch listeners', () => {
    expect(listeners.install).toBeDefined();
    expect(listeners.activate).toBeDefined();
    expect(listeners.fetch).toBeDefined();
  });

  describe('install event', () => {
    it('should open cache, add CORE_ASSETS, and skip waiting', async () => {
      const waitUntil = jest.fn();
      const event = { waitUntil };

      listeners.install(event);

      // Wait for the promise passed to waitUntil to resolve
      await event.waitUntil.mock.calls[0][0];

      expect(mockCaches.open).toHaveBeenCalledWith('eg-nexus-os-v5.9.0-pwa-cache');
      expect(mockCache.addAll).toHaveBeenCalledWith([
        './',
        './index.html',
        './manifest.json',
        './src/core/sanitization.js',
        './src/security/secrets.js',
        './src/security/approvals.js',
        './src/core/state.js',
        './src/core/persistence.js',
        './src/providers/registry.js'
      ]);
      expect(mockSelf.skipWaiting).toHaveBeenCalled();
    });
  });

  describe('activate event', () => {
    it('should delete old caches and claim clients', async () => {
      const waitUntil = jest.fn();
      const event = { waitUntil };

      listeners.activate(event);

      await event.waitUntil.mock.calls[0][0];

      expect(mockCaches.keys).toHaveBeenCalled();
      expect(mockCaches.delete).toHaveBeenCalledWith('eg-nexus-os-v5.0-old-cache');
      expect(mockCaches.delete).not.toHaveBeenCalledWith('other-origin-cache');
      expect(mockCaches.delete).not.toHaveBeenCalledWith('eg-nexus-os-v5.9.0-pwa-cache');
      expect(mockSelf.clients.claim).toHaveBeenCalled();
    });
  });

  describe('fetch event', () => {
    it('should ignore non-GET requests', () => {
      const respondWith = jest.fn();
      const event = {
        request: { method: 'POST', url: 'https://example.com/api' },
        respondWith
      };

      listeners.fetch(event);

      expect(respondWith).not.toHaveBeenCalled();
    });

    it('should ignore cross-origin requests', () => {
      const respondWith = jest.fn();
      const event = {
        request: { method: 'GET', url: 'https://api.telegram.org/bot123' },
        respondWith
      };

      listeners.fetch(event);

      expect(respondWith).not.toHaveBeenCalled();
    });

    describe('navigation requests (mode: navigate)', () => {
      it('should return network response and update cache on success', async () => {
        const mockResponse = { clone: jest.fn().mockReturnValue('cloned-response') };
        mockFetch.mockResolvedValue(mockResponse);

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/page', mode: 'navigate' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(mockFetch).toHaveBeenCalledWith(event.request);
        expect(res).toBe(mockResponse);

        // Allow the async cache.put promise to resolve
        await new Promise(process.nextTick);

        expect(mockCaches.open).toHaveBeenCalledWith('eg-nexus-os-v5.9.0-pwa-cache');
        expect(mockCache.put).toHaveBeenCalledWith('./index.html', 'cloned-response');
      });

      it('should fallback to cached index.html on network failure', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));
        mockCaches.match.mockResolvedValue('cached-index');

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/page', mode: 'navigate' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(mockFetch).toHaveBeenCalledWith(event.request);
        expect(mockCaches.match).toHaveBeenCalledWith('./index.html');
        expect(res).toBe('cached-index');
      });
    });

    describe('static same-origin assets (stale-while-revalidate)', () => {
      it('should return cached response and fetch from network to update cache', async () => {
        mockCaches.match.mockResolvedValue('cached-asset');
        const mockResponse = { status: 200, clone: jest.fn().mockReturnValue('cloned-asset') };
        mockFetch.mockResolvedValue(mockResponse);

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/style.css', mode: 'no-cors' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(res).toBe('cached-asset');

        // Wait for background network fetch and cache.put
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(mockFetch).toHaveBeenCalledWith(event.request);
        expect(mockCaches.open).toHaveBeenCalledWith('eg-nexus-os-v5.9.0-pwa-cache');
        expect(mockCache.put).toHaveBeenCalledWith(event.request, 'cloned-asset');
      });

      it('should return network response if not in cache', async () => {
        mockCaches.match.mockResolvedValue(undefined);
        const mockResponse = { status: 200, clone: jest.fn().mockReturnValue('cloned-asset') };
        mockFetch.mockResolvedValue(mockResponse);

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/style.css', mode: 'no-cors' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(res).toBe(mockResponse);

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(mockCache.put).toHaveBeenCalledWith(event.request, 'cloned-asset');
      });

      it('should not update cache if network response is not 200', async () => {
        mockCaches.match.mockResolvedValue('cached-asset');
        const mockResponse = { status: 404 };
        mockFetch.mockResolvedValue(mockResponse);

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/style.css', mode: 'no-cors' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(res).toBe('cached-asset');

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(mockCache.put).not.toHaveBeenCalled();
      });

      it('should fallback to cached asset if network fetch fails', async () => {
        mockCaches.match.mockResolvedValue('cached-asset');
        mockFetch.mockRejectedValue(new Error('Network error'));

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/style.css', mode: 'no-cors' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(res).toBe('cached-asset');
      });

      it('should return offline fallback response if not in cache and network fails (Reviewer #27 fix)', async () => {
        mockCaches.match.mockResolvedValue(undefined);
        mockFetch.mockRejectedValue(new Error('Network error'));

        const respondWith = jest.fn();
        const event = {
          request: { method: 'GET', url: 'https://example.com/style.css', mode: 'no-cors' },
          respondWith
        };

        listeners.fetch(event);

        const responsePromise = event.respondWith.mock.calls[0][0];
        const res = await responsePromise;

        expect(res).toBeDefined();
        expect(res.status).toBe(503);
      });
    });
  });
});
