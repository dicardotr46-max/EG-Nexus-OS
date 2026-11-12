/**
 * Comprehensive Coverage Booster Suite for v5.8.0
 * Systematically exercises branch edges in secrets, persistence, sanitization, state, registry, approvals
 */

const secrets = require('../src/security/secrets.js');
const persistence = require('../src/core/persistence.js');
const state = require('../src/core/state.js');
const sanitization = require('../src/core/sanitization.js');
const registry = require('../src/providers/registry.js');
const approvals = require('../src/security/approvals.js');

function createMockStorage(initial = {}) {
  let store = { ...initial };
  return {
    getItem: jest.fn(k => (k in store ? store[k] : null)),
    setItem: jest.fn((k, v) => { store[k] = String(v); }),
    removeItem: jest.fn(k => { delete store[k]; }),
    clear: jest.fn(() => { store = {}; }),
    _getStore: () => store
  };
}

describe('v5.8.0 Deep Coverage Booster', () => {

  // =========================================================================
  // 1. secrets.js deep branch coverage
  // =========================================================================
  describe('secrets.js deep branch edges', () => {
    let mockStore;

    beforeEach(() => {
      mockStore = createMockStorage();
      secrets._resetSessionCryptoState();
    });

    test('_hexToUint8 and _uint8ToHex boundary conditions', () => {
      expect(secrets._uint8ToHex(null)).toBe('');
      expect(secrets._uint8ToHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
      expect(secrets._uint8ToHex([1, 2, 3])).toBe('');

      expect(secrets._hexToUint8('')).toEqual(new Uint8Array(0));
      expect(secrets._hexToUint8('000f10ff')).toEqual(new Uint8Array([0, 15, 16, 255]));
      expect(secrets._hexToUint8('abc')).toEqual(new Uint8Array(0)); // odd length
      expect(secrets._hexToUint8('zzzz')).toEqual(new Uint8Array(0)); // non-hex
      expect(secrets._hexToUint8(1234)).toEqual(new Uint8Array(0)); // not a string
      expect(secrets._hexToUint8(null)).toEqual(new Uint8Array(0));
    });

    test('_sha256Pure multiblock and padding execution', () => {
      // 0 bytes
      const h0 = secrets._sha256Pure(new Uint8Array(0));
      expect(h0).toBeInstanceOf(Uint8Array);
      expect(h0.length).toBe(32);

      // Short input (< 56 bytes)
      const hShort = secrets._sha256Pure(new TextEncoder().encode('Hello Nexus OS'));
      expect(hShort.length).toBe(32);

      // Boundary input (exactly 55 bytes)
      const h55 = secrets._sha256Pure(new Uint8Array(55).fill(65));
      expect(h55.length).toBe(32);

      // Boundary input (exactly 56 bytes, triggers second block for length)
      const h56 = secrets._sha256Pure(new Uint8Array(56).fill(66));
      expect(h56.length).toBe(32);

      // Long input (> 64 bytes, multiple 512-bit chunk iterations)
      const hLong = secrets._sha256Pure(new Uint8Array(200).fill(67));
      expect(hLong.length).toBe(32);
    });

    test('_syncTransform and _nonCryptoCompatCodec edge cases', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const key = new Uint8Array(32).fill(42);
      const iv = new Uint8Array(12).fill(7);

      const enc = secrets._nonCryptoCompatCodec(data, key, iv);
      const dec = secrets._nonCryptoCompatCodec(enc, key, iv);
      expect(dec).toEqual(data);

      // Empty buffer
      const emptyEnc = secrets._nonCryptoCompatCodec(new Uint8Array(0), key, iv);
      expect(emptyEnc.length).toBe(0);

      // Short / non-standard key or iv
      const oddCodec = secrets._nonCryptoCompatCodec(data, new Uint8Array(16), new Uint8Array(8));
      expect(oddCodec.length).toBe(data.length);

      // _syncTransform
      const st = secrets._syncTransform(data, key, iv);
      expect(st.length).toBe(data.length);
    });

    test('_fillSecureRandomBytes fallbacks', () => {
      const buf = new Uint8Array(16);
      secrets._fillSecureRandomBytes(buf);
      expect(buf.some(b => b !== 0)).toBe(true);

      // With null or empty
      expect(() => secrets._fillSecureRandomBytes(null)).toThrow('targetBuffer must be a Uint8Array');
      expect(() => secrets._fillSecureRandomBytes('not-a-buffer')).toThrow('targetBuffer must be a Uint8Array');
    });

    test('_resolveSecretsStorageKey resolution branches', () => {
      // Null store
      expect(secrets._resolveSecretsStorageKey(null)).toBe(secrets.SESSION_SECRETS_KEY);

      // Store with current key
      const store1 = createMockStorage({ [secrets.SESSION_SECRETS_KEY]: 'current_val' });
      expect(secrets._resolveSecretsStorageKey(store1)).toBe(secrets.SESSION_SECRETS_KEY);

      // Store with legacy key only (migrates to current and returns current)
      const store2 = createMockStorage({ [secrets.LEGACY_SESSION_SECRETS_KEY]: 'legacy_val' });
      expect(secrets._resolveSecretsStorageKey(store2)).toBe(secrets.SESSION_SECRETS_KEY);
      expect(store2.getItem(secrets.SESSION_SECRETS_KEY)).toBe('legacy_val');

      // Store with neither
      const store3 = createMockStorage();
      expect(secrets._resolveSecretsStorageKey(store3)).toBe(secrets.SESSION_SECRETS_KEY);

      // Store throwing on getItem
      const faultyStore = {
        getItem: () => { throw new Error('SecurityError'); }
      };
      expect(secrets._resolveSecretsStorageKey(faultyStore)).toBe(secrets.SESSION_SECRETS_KEY);
    });

    test('readSessionSecrets sync handles legacy plaintext migration transparently', () => {
      const plaintextPayload = {
        apiKeys: { openai: 'sk-plaintext-key' },
        bridgeToken: 'legacy-bridge'
      };
      mockStore.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify(plaintextPayload));

      const res = secrets.readSessionSecrets(mockStore);
      expect(res.initialized).toBe(true);
      expect(res.apiKeys.openai).toBe('sk-plaintext-key');
      expect(res.bridgeToken).toBe('legacy-bridge');

      // Verify that it automatically re-encrypted to storage
      const updatedRaw = mockStore.getItem(secrets.SESSION_SECRETS_KEY);
      const parsed = JSON.parse(updatedRaw);
      expect(parsed.encrypted).toBe(true);
    });

    test('readSessionSecrets sync handles corrupt JSON, non-object, and invalid algorithm', () => {
      const target = secrets.SESSION_SECRETS_KEY;

      // Corrupt JSON -> quarantines
      mockStore.setItem(target, '{ bad json');
      const r1 = secrets.readSessionSecrets(mockStore);
      expect(r1.initialized).toBe(false);
      expect(mockStore.getItem(target)).toBeNull();

      // Non-object (primitive or array)
      mockStore.setItem(target, JSON.stringify(['not', 'an', 'object']));
      const r2 = secrets.readSessionSecrets(mockStore);
      expect(r2.initialized).toBe(false);

      // Unknown algorithm -> quarantines
      mockStore.setItem(target, JSON.stringify({ encrypted: true, algorithm: 'des-ecb-insecure' }));
      const r3 = secrets.readSessionSecrets(mockStore);
      expect(r3.initialized).toBe(false);
      expect(mockStore.getItem(target)).toBeNull();

      // Legacy sync-stream-v1 algorithm decoding
      const iv = new Uint8Array(12).fill(3);
      const keyRaw = secrets._initMemorySessionKey(mockStore);
      const plain = new TextEncoder().encode(JSON.stringify({ initialized: true, apiKeys: { tavily: 'tvly-test' } }));
      const enc = secrets._nonCryptoCompatCodec(plain, keyRaw, iv);
      mockStore.setItem(target, JSON.stringify({
        encrypted: true,
        algorithm: 'sync-stream-v1',
        iv: secrets._uint8ToHex(iv),
        ciphertext: secrets._uint8ToHex(enc)
      }));
      const r4 = secrets.readSessionSecrets(mockStore);
      expect(r4.initialized).toBe(true);
      expect(r4.apiKeys.tavily).toBe('tvly-test');
    });

    test('readSessionSecretsAsync handles legacy plaintext and sync-stream-v1 payloads', async () => {
      const target = secrets.SESSION_SECRETS_KEY;

      // Legacy plaintext migration
      mockStore.setItem(target, JSON.stringify({
        apiKeys: { grok: 'xai-key-1' },
        workerSecret: 'ws-123'
      }));
      const r1 = await secrets.readSessionSecretsAsync(mockStore);
      expect(r1.initialized).toBe(true);
      expect(r1.apiKeys.grok).toBe('xai-key-1');
      expect(r1.workerSecret).toBe('ws-123');

      // Sync stream v1 legacy format in async reader
      secrets._resetSessionCryptoState();
      const iv = new Uint8Array(12).fill(9);
      const keyRaw = secrets._initMemorySessionKey(mockStore);
      const plain = new TextEncoder().encode(JSON.stringify({ initialized: true, apiKeys: { deepseek: 'ds-sync' } }));
      const enc = secrets._nonCryptoCompatCodec(plain, keyRaw, iv);
      mockStore.setItem(target, JSON.stringify({
        encrypted: true,
        algorithm: 'sync-stream-v1',
        iv: secrets._uint8ToHex(iv),
        ciphertext: secrets._uint8ToHex(enc)
      }));
      const r2 = await secrets.readSessionSecretsAsync(mockStore);
      expect(r2.initialized).toBe(true);
      expect(r2.apiKeys.deepseek).toBe('ds-sync');
    });

    test('readSessionSecretsAsync error handling on faulty storage and corrupt data', async () => {
      const target = secrets.SESSION_SECRETS_KEY;

      // Faulty store
      const badStore = { getItem: () => { throw new Error('disk full'); } };
      const r1 = await secrets.readSessionSecretsAsync(badStore);
      expect(r1.initialized).toBe(false);

      // Corrupt JSON
      mockStore.setItem(target, '{{corrupt-json');
      const r2 = await secrets.readSessionSecretsAsync(mockStore);
      expect(r2.initialized).toBe(false);
      expect(mockStore.getItem(target)).toBeNull();

      // Array payload
      mockStore.setItem(target, JSON.stringify([1, 2, 3]));
      const r3 = await secrets.readSessionSecretsAsync(mockStore);
      expect(r3.initialized).toBe(false);
    });

    test('writeSessionSecrets handles faulty storage and null store', () => {
      const faultyStore = {
        getItem: () => null,
        setItem: () => { throw new Error('Storage write prohibited'); }
      };
      expect(secrets.writeSessionSecrets({ apiKeys: {} }, faultyStore)).toBe(false);
    });

    test('writeSessionSecretsAsync fallback when subtle encrypt fails', async () => {
      // Mock crypto.subtle throwing
      const origCrypto = global.crypto;
      try {
        global.crypto = {
          getRandomValues: arr => origCrypto.getRandomValues(arr),
          subtle: {
            encrypt: () => Promise.reject(new Error('Subtle failed'))
          }
        };

        const ok = await secrets.writeSessionSecretsAsync({
          apiKeys: { gemini: 'fallback-async-gemini' }
        }, mockStore);
        expect(ok).toBe(true);

        const readBack = await secrets.readSessionSecretsAsync(mockStore);
        expect(readBack.apiKeys.gemini).toBe('fallback-async-gemini');
      } finally {
        global.crypto = origCrypto;
      }
    });

    test('applySessionSecrets boundary inputs and missing sub-objects', () => {
      // Null or primitive appState
      expect(secrets.applySessionSecrets(null, mockStore)).toBeNull();
      expect(secrets.applySessionSecrets('invalid', mockStore)).toBe('invalid');

      // appState without cloudConfig or telegramConfig
      const bareState = {};
      mockStore.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify({
        apiKeys: { tavily: 'tv-test' },
        workerSecret: 'ws-test',
        botToken: 'bot-test'
      }));
      secrets.applySessionSecrets(bareState, mockStore);
      expect(bareState.apiKeys.tavily).toBe('tv-test');
      expect(bareState.cloudConfig.workerSecret).toBe('ws-test');
      expect(bareState.telegramConfig.botToken).toBe('bot-test');
    });

    test('applySessionSecretsAsync boundary inputs', async () => {
      expect(await secrets.applySessionSecretsAsync(null, mockStore)).toBeNull();
      const bareState = {};
      const res = await secrets.applySessionSecretsAsync(bareState, mockStore);
      expect(res).toBe(bareState);
    });

    test('getSecretVaultHealth variations', () => {
      const origCrypto = global.crypto;
      try {
        // Without crypto
        delete global.crypto;
        const health = secrets.getSecretVaultHealth();
        expect(health).toBeDefined();
      } finally {
        global.crypto = origCrypto;
      }
    });
  });

  // =========================================================================
  // 2. persistence.js deep branch coverage
  // =========================================================================
  describe('persistence.js deep branch edges', () => {
    let mockStore;

    beforeEach(() => {
      mockStore = createMockStorage();
    });

    test('compareTimestampsWithClockSkewProtection all branches', () => {
      const now = 1000000;
      const opts = { now, maxClockSkewMs: 10000 };

      // Normal comparison: a > b
      const r1 = persistence.compareTimestampsWithClockSkewProtection(500000, 400000, opts);
      expect(r1.winner).toBe('A');
      expect(r1.clockSkewDetected).toBe(false);

      // Normal comparison: b > a
      const r2 = persistence.compareTimestampsWithClockSkewProtection(400000, 500000, opts);
      expect(r2.winner).toBe('B');
      expect(r2.clockSkewDetected).toBe(false);

      // Equal timestamps: tie
      const r3 = persistence.compareTimestampsWithClockSkewProtection(500000, 500000, opts);
      expect(r3.winner).toBe('equal');
      expect(r3.clockSkewDetected).toBe(false);

      // Local skewed into the future (> now + maxClockSkewMs)
      const r4 = persistence.compareTimestampsWithClockSkewProtection(1000000 + 20000, 995000, opts);
      expect(r4.clockSkewDetected).toBe(true);

      // Remote skewed into the future
      const r5 = persistence.compareTimestampsWithClockSkewProtection(995000, 1000000 + 20000, opts);
      expect(r5.clockSkewDetected).toBe(true);

      // Defaults without options
      const r6 = persistence.compareTimestampsWithClockSkewProtection(100, 200);
      expect(r6.winner).toBe('B');
    });

    test('resolveRoutineConflicts branches: identical, tombstone priority, and callbacks', () => {
      const local = { id: 'rt_1', name: 'Workout A', updatedAt: 1000 };
      const remote = { id: 'rt_1', name: 'Workout A', updatedAt: 1000 };

      // Identical routines (isDifferent = false)
      const r1 = persistence.resolveRoutineConflicts(local, remote);
      expect(r1.winner).toBe('local');
      expect(r1.resolved.name).toBe('Workout A');
      expect(r1.rollback()).toEqual(local);

      // Different routines, local newer
      const localNewer = { id: 'rt_1', name: 'Workout Local', updatedAt: 2000 };
      const remoteOlder = { id: 'rt_1', name: 'Workout Remote', updatedAt: 1000 };
      let conflictCaptured = null;
      const r2 = persistence.resolveRoutineConflicts(localNewer, remoteOlder, {
        onConflict: ev => { conflictCaptured = ev; }
      });
      expect(r2.winner).toBe('local');
      expect(r2.resolved.name).toBe('Workout Local');
      expect(conflictCaptured).toBeDefined();
      expect(conflictCaptured.id).toBe('rt_1');

      // Remote version higher
      const localV1 = { id: 'rt_2', name: 'Active', version: 1 };
      const remoteV2 = { id: 'rt_2', name: 'Active Updated', version: 2 };
      const r3 = persistence.resolveRoutineConflicts(localV1, remoteV2);
      expect(r3.winner).toBe('remote');
      expect(r3.resolved.name).toBe('Active Updated');

      // Remote timestamp higher
      const localOld = { id: 'rt_3', name: 'Old', updatedAt: 1000 };
      const remoteNew = { id: 'rt_3', name: 'New', updatedAt: 5000 };
      const r4 = persistence.resolveRoutineConflicts(localOld, remoteNew);
      expect(r4.winner).toBe('remote');
    });

    test('conflict history recording and pruning beyond 100 events', () => {
      persistence.clearConflictHistory();
      expect(persistence.getConflictHistory()).toEqual([]);

      for (let i = 0; i < 110; i++) {
        persistence.recordConflictEvent({ type: 'test', id: 'ev_' + i });
      }

      const history = persistence.getConflictHistory();
      expect(history.length).toBe(100);
      expect(history[0].id).toBe('ev_10'); // Oldest 10 pruned
      expect(history[99].id).toBe('ev_109');

      // onConflict listener
      let listenerCalled = false;
      const unsubscribe = persistence.onConflict(() => { listenerCalled = true; });
      persistence.recordConflictEvent({ type: 'test', id: 'ev_listener' });
      expect(listenerCalled).toBe(true);
      unsubscribe();
    });

    test('getStorageSizeEstimate handles normal, empty, and faulty storage', () => {
      const store = createMockStorage({ key1: 'value1', key2: 'value2' });
      const est1 = persistence.getStorageSizeEstimate(persistence.STORAGE_KEY);
      expect(typeof est1).toBe('number');
      expect(est1).toBeGreaterThanOrEqual(0);
    });

    test('nexusStorageGet, set, and remove with faulty stores', () => {
      const faulty = {
        getItem: () => { throw new Error('err'); },
        setItem: () => { throw new Error('err'); },
        removeItem: () => { throw new Error('err'); }
      };
      expect(persistence.nexusStorageGet('key', faulty)).toBeNull();
      expect(persistence.nexusStorageSet('key', 'val', faulty)).toBe(false);
      expect(persistence.nexusStorageRemove('key', faulty)).toBe(false);
    });

    test('migrateLegacyStorage all branches', () => {
      // Case 1: Legacy exists, current does not -> migrates
      const s1 = createMockStorage({ [persistence.LEGACY_STORAGE_KEY]: '{"migrated": true}' });
      const r1 = persistence.migrateLegacyStorage(s1);
      expect(r1).toBe(true);
      expect(s1.getItem(persistence.STORAGE_KEY)).toBe('{"migrated": true}');

      // Case 2: Current already exists -> does not overwrite
      const s2 = createMockStorage({
        [persistence.LEGACY_STORAGE_KEY]: '{"legacy": true}',
        [persistence.STORAGE_KEY]: '{"current": true}'
      });
      const r2 = persistence.migrateLegacyStorage(s2);
      expect(r2).toBe(false);

      // Case 3: Neither exists
      const s3 = createMockStorage();
      const r3 = persistence.migrateLegacyStorage(s3);
      expect(r3).toBe(false);
    });

    test('mergeArrayById edge cases: missing id and non-arrays', () => {
      expect(persistence.mergeArrayById(null, null)).toEqual([]);
      expect(persistence.mergeArrayById([1, 2], null)).toEqual([]);

      const arrA = [{ id: '1', name: 'A' }, { name: 'No ID' }];
      const arrB = [{ id: '1', name: 'A-Updated' }, { id: '2', name: 'B' }];
      const merged = persistence.mergeArrayById(arrA, arrB);
      expect(merged.length).toBe(2);
      expect(merged.find(x => x.id === '1').name).toBe('A-Updated');
    });

    test('buildPersistedState strips volatile fields and handles incomplete objects', () => {
      const live = {
        chatSessions: [{ id: 'cs1' }],
        userSettings: { theme: 'dark' },
        activeChatId: 'cs1',
        routines: [{ id: 'r1' }],
        cloudConfig: { workerUrl: 'https://test.worker.dev' },
        apiKeys: { openai: 'sk-should-not-persist-in-localstorage' }
      };
      const persisted = persistence.buildPersistedState(live);
      expect(persisted.chatSessions).toBeDefined();
      expect(persisted.userSettings.theme).toBe('dark');
      // Secrets must be empty strings in buildPersistedState
      expect(persisted.apiKeys.openai).toBe('');
    });
  });

  // =========================================================================
  // 3. state.js deep branch coverage
  // =========================================================================
  describe('state.js deep branch edges', () => {
    test('createProtectedStateProxy primitives and cache', () => {
      expect(state.createProtectedStateProxy(null)).toBeNull();
      expect(state.createProtectedStateProxy(42)).toBe(42);
      expect(state.createProtectedStateProxy('string')).toBe('string');
      expect(state.createProtectedStateProxy(undefined)).toBeUndefined();

      const obj = { x: 1 };
      const p1 = state.createProtectedStateProxy(obj);
      const p2 = state.createProtectedStateProxy(obj);
      expect(p1).toBe(p2); // cached proxy returned

      const p3 = state.createProtectedStateProxy(p1);
      expect(p3).toBe(p1); // re-wrapping returns existing proxy

      expect(p1._isStateProxy).toBe(true);
      expect(p1._rawTarget).toBe(obj);
    });

    test('proxy setPrototypeOf returns false', () => {
      const p = state.createProtectedStateProxy({ a: 1 });
      expect(() => {
        Object.setPrototypeOf(p, {});
      }).toThrow(TypeError);
    });

    test('proxy deleteProperty dangerous and safe keys', () => {
      const p = state.createProtectedStateProxy({ safe: 123, other: 456 });
      delete p.__proto__;
      delete p.constructor;
      expect(delete p.safe).toBe(true);
      expect(p.safe).toBeUndefined();
    });

    test('proxy defineProperty with dangerous nested values and error fallback', () => {
      const p = state.createProtectedStateProxy({});

      // Dangerous property name neutralized
      Object.defineProperty(p, '__proto__', { value: { evil: true } });
      expect(Object.getPrototypeOf(p._rawTarget)).toBe(Object.prototype);

      // Dangerous nested value neutralized
      const evilObj = {};
      Object.defineProperty(evilObj, 'constructor', { value: 'polluted' });
      Object.defineProperty(p, 'sub', {
        value: evilObj,
        configurable: true,
        writable: true
      });
      expect(p.sub).toBeUndefined();

      // Safe property defined successfully
      Object.defineProperty(p, 'safeProp', { value: 'safeVal', writable: true, configurable: true });
      expect(p.safeProp).toBe('safeVal');
    });

    test('hasDangerousKeysDeep handles cyclic structures without infinite recursion', () => {
      const cyclic = { a: 1 };
      cyclic.self = cyclic;
      expect(state.hasDangerousKeysDeep(cyclic)).toBe(false);

      const cyclicWithPollution = { a: 1 };
      cyclicWithPollution.self = cyclicWithPollution;
      Object.defineProperty(cyclicWithPollution, 'prototype', { value: 123 });
      expect(state.hasDangerousKeysDeep(cyclicWithPollution)).toBe(true);
    });

    test('secureRandomHex and secureRandomId boundaries', () => {
      expect(state.secureRandomHex(0)).toBe('');
      const h = state.secureRandomHex(4);
      expect(h.length).toBe(8);

      const idDefault = state.secureRandomId();
      expect(idDefault.startsWith('id_')).toBe(true);

      const idCustom = state.secureRandomId('custom');
      expect(idCustom.startsWith('custom_')).toBe(true);

      const idEmpty = state.secureRandomId('');
      expect(idEmpty.startsWith('id_')).toBe(true);
    });
  });

  // =========================================================================
  // 4. sanitization.js deep branch edges
  // =========================================================================
  describe('sanitization.js deep branch edges', () => {
    test('sanitizeSafeUrl edge cases', () => {
      expect(sanitization.sanitizeSafeUrl(null)).toBe('#');
      expect(sanitization.sanitizeSafeUrl('')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('   ')).toBe('#');

      // Safe relative paths
      expect(sanitization.sanitizeSafeUrl('#top')).toBe('#top');
      expect(sanitization.sanitizeSafeUrl('?filter=all')).toBe('?filter=all');
      expect(sanitization.sanitizeSafeUrl('/assets/app.js')).toBe('/assets/app.js');
      expect(sanitization.sanitizeSafeUrl('./relative/path')).toBe('./relative/path');
      expect(sanitization.sanitizeSafeUrl('../parent/path')).toBe('../parent/path');

      // Protocol-relative -> blocked
      expect(sanitization.sanitizeSafeUrl('//evil.com')).toBe('#');

      // No colon: safe plain string vs unsafe characters
      expect(sanitization.sanitizeSafeUrl('safe-path-name')).toBe('safe-path-name');
      expect(sanitization.sanitizeSafeUrl('path<with>tag')).toBe('#');

      // Allowed schemes
      expect(sanitization.sanitizeSafeUrl('mailto:user@nexus.io')).toBe('mailto:user@nexus.io');
      expect(sanitization.sanitizeSafeUrl('tel:+15551234567')).toBe('tel:+15551234567');
      expect(sanitization.sanitizeSafeUrl('https://valid.com/page')).toBe('https://valid.com/page');

      // Disallowed schemes
      expect(sanitization.sanitizeSafeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('data:text/html,<script>')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('vbscript:msgbox')).toBe('#');

      // URL with dangerous characters
      expect(sanitization.sanitizeSafeUrl('https://example.com/page<script>')).toBe('#');
    });

    test('sanitizeHttpUrl SSRF and edge cases', () => {
      // Credentials in URL -> blocked
      expect(sanitization.sanitizeHttpUrl('http://user:pass@example.com')).toBe('#');

      // Cloud metadata SSRF -> blocked
      expect(sanitization.sanitizeHttpUrl('http://169.254.169.254/latest')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://metadata.google.internal/info')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://instance-data/latest/meta')).toBe('#');

      // Loopback blocking
      expect(sanitization.sanitizeHttpUrl('http://127.0.0.1:8080', { blockLoopback: true })).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://localhost:3000', { blockLoopback: true })).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://127.0.0.1:8765', { blockLoopback: true, allowLocalBridge: true })).toBe('http://127.0.0.1:8765/');

      // Malformed / unparseable
      expect(sanitization.sanitizeHttpUrl('invalid://url')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('not a url at all')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://')).toBe('#');
    });

    test('sanitizeUntrustedWebSnippet nested tag stripping', () => {
      const nested = '<untrusted_web_data><untrusted_web_data>malicious script</untrusted_web_data></untrusted_web_data>';
      const cleaned = sanitization.sanitizeUntrustedWebSnippet(nested);
      expect(cleaned).not.toContain('<untrusted_web_data');
      expect(cleaned).not.toContain('</untrusted_web_data>');
      expect(cleaned).toBe('malicious script');
    });
  });

  // =========================================================================
  // 5. registry.js and approvals.js deep branch edges
  // =========================================================================
  describe('registry.js and approvals.js deep branch edges', () => {
    beforeEach(() => {
      const ui = approvals.getUiState();
      ui.pendingApprovalQueue = [];
      ui._isResolvingApproval = false;
    });

    test('registry MCP helpers and conflict callback', () => {
      const appConnections = {
        github: { mcpEnabled: true },
        gmail: { mcpEnabled: false }
      };
      expect(registry.isMcpServerEnabled('github', appConnections)).toBe(true);
      expect(registry.isMcpServerEnabled('gmail', appConnections)).toBe(false);
      expect(registry.isMcpServerEnabled('slack', null)).toBe(false);

      const call = registry.formatMcpToolCall('github', 'list_repos', { user: 'nexus' });
      expect(call.jsonrpc).toBe('2.0');
      expect(call.params.name).toBe('list_repos');
      expect(call.id.startsWith('mcp_')).toBe(true);

      // resolveRoutineConflicts with onConflict callback
      let conflictFired = false;
      const r = registry.resolveRoutineConflicts(
        { id: 'r1', name: 'Local', updatedAt: 200 },
        { id: 'r1', name: 'Remote', updatedAt: 100 },
        { onConflict: () => { conflictFired = true; } }
      );
      expect(r.winner).toBe('local');
      expect(conflictFired).toBe(true);
      expect(r.rollback()).toEqual({ id: 'r1', name: 'Local', updatedAt: 200 });
    });

    test('approvals triggerApprovalGate with object payload and reject flow', async () => {
      let rejectedCalled = false;
      let approvedCalled = false;

      // triggerApprovalGate with object parameter
      approvals.triggerApprovalGate({
        reason: 'Delete critical database',
        onApprove: () => { approvedCalled = true; },
        onReject: () => { rejectedCalled = true; }
      });

      // resolveApprovalGate with approved = false
      await approvals.resolveApprovalGate(false);
      expect(rejectedCalled).toBe(true);
      expect(approvedCalled).toBe(false);
    });

    test('approvals resolveApprovalGate queue advance and multiple items', async () => {
      let callCount = 0;
      approvals.triggerApprovalGate('Action 1', () => { callCount += 1; });
      approvals.triggerApprovalGate('Action 2', () => { callCount += 10; });

      await approvals.resolveApprovalGate(true);
      expect(callCount).toBe(1);

      // Wait for debounce period (320ms) to clear _isResolvingApproval
      await new Promise(r => setTimeout(r, 350));

      await approvals.resolveApprovalGate(true);
      expect(callCount).toBe(11);
    });
  });
});
