const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Service Worker (sw.js)', () => {
  let context;
  let listeners = {};
  let mockCaches;
  let mockCache;
  let mockFetch;

  beforeEach(() => {
    listeners = {};

    mockCache = {
      addAll: jest.fn().mockResolvedValue(),
      put: jest.fn().mockResolvedValue(),
    };

    mockCaches = {
      open: jest.fn().mockResolvedValue(mockCache),
      keys: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(),
      match: jest.fn().mockResolvedValue(undefined),
    };

    mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      clone: jest.fn().mockReturnThis(),
    });

    const mockSelf = {
      addEventListener: jest.fn((event, callback) => {
        listeners[event] = callback;
      }),
      skipWaiting: jest.fn().mockResolvedValue(),
      clients: {
        claim: jest.fn().mockResolvedValue(),
      },
      location: {
        origin: 'https://example.com'
      }
    };

    context = vm.createContext({
      self: mockSelf,
      caches: mockCaches,
      fetch: mockFetch,
      URL: URL,
      Promise: Promise,
      console: console,
      setTimeout: setTimeout
    });

    const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf-8');
    vm.runInContext(swCode, context);
  });

  describe('install event', () => {
    it('should open cache, add CORE_ASSETS, and skip waiting', async () => {
      const waitUntilMock = jest.fn();
      const event = { waitUntil: waitUntilMock };

      listeners['install'](event);

      // Wait for the promise passed to waitUntil to resolve
      await waitUntilMock.mock.calls[0][0];

      expect(mockCaches.open).toHaveBeenCalledWith('eg-nexus-os-v5.1-pwa-cache');
      expect(mockCache.addAll).toHaveBeenCalledWith([
        './',
        './index.html',
        './manifest.json'
      ]);
      expect(context.self.skipWaiting).toHaveBeenCalled();
    });
  });

  describe('activate event', () => {
    it('should clean up old caches and claim clients', async () => {
      mockCaches.keys.mockResolvedValue(['old-cache-1', 'eg-nexus-os-v5.1-pwa-cache', 'old-cache-2']);
      const waitUntilMock = jest.fn();
      const event = { waitUntil: waitUntilMock };

      listeners['activate'](event);

      await waitUntilMock.mock.calls[0][0];

      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
      expect(mockCaches.delete).toHaveBeenCalledWith('old-cache-1');
      expect(mockCaches.delete).toHaveBeenCalledWith('old-cache-2');
      expect(context.self.clients.claim).toHaveBeenCalled();
    });
  });

  describe('fetch event', () => {
    it('should ignore non-GET requests', () => {
      const event = {
        request: { method: 'POST', url: 'https://example.com/api' },
        respondWith: jest.fn()
      };

      listeners['fetch'](event);
      expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('should ignore cross-origin requests', () => {
      const event = {
        request: { method: 'GET', url: 'https://other-domain.com/api' },
        respondWith: jest.fn()
      };

      listeners['fetch'](event);
      expect(event.respondWith).not.toHaveBeenCalled();
    });

    it('should use network-first strategy for navigation requests', async () => {
      const respondWithMock = jest.fn();
      const event = {
        request: { method: 'GET', url: 'https://example.com/page', mode: 'navigate' },
        respondWith: respondWithMock
      };

      const cloneMock = jest.fn().mockReturnThis();
      mockFetch.mockResolvedValueOnce({ status: 200, clone: cloneMock });

      listeners['fetch'](event);

      const responsePromise = respondWithMock.mock.calls[0][0];
      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledWith(event.request);
      expect(mockCaches.open).toHaveBeenCalledWith('eg-nexus-os-v5.1-pwa-cache');
      expect(response).toBeDefined();

      await new Promise(process.nextTick);
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should fallback to cached index.html for failed navigation requests', async () => {
      const respondWithMock = jest.fn();
      const event = {
        request: { method: 'GET', url: 'https://example.com/page', mode: 'navigate' },
        respondWith: respondWithMock
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const cachedResponse = { status: 200, body: 'cached index' };
      mockCaches.match.mockResolvedValueOnce(cachedResponse);

      listeners['fetch'](event);

      const responsePromise = respondWithMock.mock.calls[0][0];
      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledWith(event.request);

      await new Promise(process.nextTick);
      expect(mockCaches.match).toHaveBeenCalledWith('./index.html');
      expect(response).toBe(cachedResponse);
    });

    it('should use stale-while-revalidate for static same-origin assets', async () => {
      const respondWithMock = jest.fn();
      const event = {
        request: { method: 'GET', url: 'https://example.com/style.css' },
        respondWith: respondWithMock
      };

      const cachedResponse = { status: 200, body: 'cached style' };
      mockCaches.match.mockResolvedValueOnce(cachedResponse);

      const cloneMock = jest.fn().mockReturnThis();
      const networkResponse = { status: 200, clone: cloneMock };
      mockFetch.mockResolvedValueOnce(networkResponse);

      listeners['fetch'](event);

      const responsePromise = respondWithMock.mock.calls[0][0];
      const response = await responsePromise;

      expect(mockCaches.match).toHaveBeenCalledWith(event.request);
      expect(response).toBe(cachedResponse); // Returns cached immediately

      // Wait for the background network fetch to complete
      await new Promise(process.nextTick);
      await new Promise(process.nextTick);

      expect(mockFetch).toHaveBeenCalledWith(event.request);
      expect(mockCaches.open).toHaveBeenCalledWith('eg-nexus-os-v5.1-pwa-cache');
      expect(mockCache.put).toHaveBeenCalledWith(event.request, networkResponse);
    });

    it('should handle network fetch if static asset is not cached', async () => {
      const respondWithMock = jest.fn();
      const event = {
        request: { method: 'GET', url: 'https://example.com/script.js' },
        respondWith: respondWithMock
      };

      mockCaches.match.mockResolvedValueOnce(undefined);

      const cloneMock = jest.fn().mockReturnThis();
      const networkResponse = { status: 200, clone: cloneMock };
      mockFetch.mockResolvedValueOnce(networkResponse);

      listeners['fetch'](event);

      const responsePromise = respondWithMock.mock.calls[0][0];
      const response = await responsePromise;

      expect(mockCaches.match).toHaveBeenCalledWith(event.request);

      await new Promise(process.nextTick);

      expect(mockFetch).toHaveBeenCalledWith(event.request);
      expect(response).toBe(networkResponse);
    });
  });
});
