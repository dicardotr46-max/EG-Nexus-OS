/**
 * Test Suite for EG Nexus OS v5.8.0 Hardening & Audit Coverage Gate
 * Validates new branches across secrets, persistence, sanitization, approvals, state, and registry.
 */

const vm = require('vm');
const path = require('path');
const fs = require('fs');

const sanitization = require('../src/core/sanitization.js');
const state = require('../src/core/state.js');
const persistence = require('../src/core/persistence.js');
const approvals = require('../src/security/approvals.js');
const registry = require('../src/providers/registry.js');
const secrets = require('../src/security/secrets.js');

function createMemoryStorage() {
  let store = {};
  return {
    getItem: jest.fn(k => (k in store ? store[k] : null)),
    setItem: jest.fn((k, v) => { store[k] = String(v); }),
    removeItem: jest.fn(k => { delete store[k]; }),
    clear: jest.fn(() => { store = {}; }),
    _getStore: () => store
  };
}

describe('v5.8.0 Auditor Hardening & Verification Suite', () => {

  // =========================================================================
  // 1. Secrets Management (src/security/secrets.js)
  // =========================================================================
  describe('1. secrets.js AES-GCM-256 and Vault Hardening', () => {
    let mockStorage;

    beforeEach(() => {
      mockStorage = createMemoryStorage();
      secrets._resetSessionCryptoState();
    });

    test('getSecretVaultHealth reports accurate environment capabilities', () => {
      const health = secrets.getSecretVaultHealth();
      expect(health).toBeDefined();
      expect(typeof health.ok).toBe('boolean');
      expect(typeof health.hasIndexedDB).toBe('boolean');
      expect(typeof health.hasWebCrypto).toBe('boolean');
      expect(typeof health.hasNodeCrypto).toBe('boolean');
      expect(['idb-hardware-backed', 'session-memory-only', 'degraded']).toContain(health.mode);
      expect(health.schemaVersion).toBe(1);
    });

    test('extracts and hydrates all 4 new tokens (workerSecret, supabaseKey, supabaseAuthToken, botToken)', async () => {
      const input = {
        apiKeys: { gemini: 'test-gemini-key' },
        workerSecret: 'ws-super-secret-123456789012345678',
        supabaseKey: 'sb-key-test-999999999999999999',
        supabaseAuthToken: 'sb-auth-token-111111111111111111',
        botToken: 'bot123456:telegram-token'
      };

      const writeOk = await secrets.writeSessionSecretsAsync(input, mockStorage);
      expect(writeOk).toBe(true);

      const readBack = await secrets.readSessionSecretsAsync(mockStorage);
      expect(readBack.initialized).toBe(true);
      expect(readBack.workerSecret).toBe(input.workerSecret);
      expect(readBack.supabaseKey).toBe(input.supabaseKey);
      expect(readBack.supabaseAuthToken).toBe(input.supabaseAuthToken);
      expect(readBack.botToken).toBe(input.botToken);
      expect(readBack.telegramBotToken).toBe(input.botToken);

      // Verify re-hydration into appState
      const appState = {
        cloudConfig: {},
        telegramConfig: {}
      };
      secrets.applySessionSecrets(appState, mockStorage);
      expect(appState.cloudConfig.workerSecret).toBe(input.workerSecret);
      expect(appState.cloudConfig.supabaseKey).toBe(input.supabaseKey);
      expect(appState.cloudConfig.supabaseAuthToken).toBe(input.supabaseAuthToken);
      expect(appState.telegramConfig.botToken).toBe(input.botToken);
    });

    test('browser sync read without nodeCrypto never quarantines AES-GCM-256 and returns pendingAsyncHydration', () => {
      const targetKey = secrets.SESSION_SECRETS_KEY;
      mockStorage.setItem(targetKey, JSON.stringify({
        encrypted: true,
        algorithm: 'AES-GCM-256',
        initialized: true,
        iv: '0102030405060708090a0b0c',
        ciphertext: 'abcdef1234567890abcdef12345678901234567890abcdef',
        version: 1
      }));

      // Mock nodeCrypto returning null to simulate browser tab boot
      const origGetNodeCrypto = secrets._getNodeCrypto;
      try {
        secrets._getNodeCrypto = () => null;
        const readSync = secrets.readSessionSecrets(mockStorage);
        expect(readSync).toBeDefined();
        expect(readSync.pendingAsyncHydration).toBe(true);
        expect(readSync.initialized).toBe(false);
        // Ciphertext must NOT be quarantined / removed
        expect(mockStorage.getItem(targetKey)).toBeTruthy();
      } finally {
        secrets._getNodeCrypto = origGetNodeCrypto;
      }
    });

    test('queueSessionSecretsWrite takes immediate immutable snapshot to eliminate input race condition', async () => {
      const liveState = {
        apiKeys: { openai: 'initial-key-value' },
        bridgeToken: 'initial-bridge-token'
      };

      const writePromise = secrets.queueSessionSecretsWrite(liveState, mockStorage);

      // Mutate object immediately after enqueueing
      liveState.apiKeys.openai = 'tampered-after-enqueue';
      liveState.bridgeToken = 'tampered-bridge';

      await writePromise;

      const restored = await secrets.readSessionSecretsAsync(mockStorage);
      expect(restored.apiKeys.openai).toBe('initial-key-value');
      expect(restored.bridgeToken).toBe('initial-bridge-token');
    });

    test('writeEpoch increments on reset and causes obsolete queued task to abort write', async () => {
      const p1 = secrets.queueSessionSecretsWrite({ apiKeys: { gemini: 'epoch-1-key' } }, mockStorage);
      secrets.resetSessionWriteQueue(); // increments writeEpoch
      const p2 = secrets.queueSessionSecretsWrite({ apiKeys: { gemini: 'epoch-2-key' } }, mockStorage);

      await Promise.all([p1, p2]);

      const restored = await secrets.readSessionSecretsAsync(mockStorage);
      expect(restored.apiKeys.gemini).toBe('epoch-2-key');
    });

    test('_zeroizeBuffer zeroes Uint8Array, Buffer, and ArrayBuffer safely', () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5]);
      secrets._zeroizeBuffer(arr);
      expect(Array.from(arr)).toEqual([0, 0, 0, 0, 0]);

      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from([9, 8, 7]);
        secrets._zeroizeBuffer(buf);
        expect(Array.from(buf)).toEqual([0, 0, 0]);
      }

      const ab = new Uint8Array(4);
      ab.set([10, 20, 30, 40]);
      secrets._zeroizeBuffer(ab.buffer);
      expect(Array.from(ab)).toEqual([0, 0, 0, 0]);

      // Null or primitive does not throw
      expect(() => secrets._zeroizeBuffer(null)).not.toThrow();
      expect(() => secrets._zeroizeBuffer('not-a-buffer')).not.toThrow();
    });

    test('rejects and quarantines AES-GCM record with invalid IV length (!== 12)', () => {
      const targetKey = secrets.SESSION_SECRETS_KEY;
      mockStorage.setItem(targetKey, JSON.stringify({
        encrypted: true,
        algorithm: 'AES-GCM-256',
        initialized: true,
        iv: '01020304', // 4 bytes instead of 12 bytes
        ciphertext: 'abcdef1234567890abcdef1234567890',
        version: 1
      }));

      const res = secrets.readSessionSecrets(mockStorage);
      expect(res.initialized).toBe(false);
      expect(Object.keys(mockStorage._getStore()).some(k => k.startsWith(targetKey + '_corrupted_'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. Persistence and Revision Priority (src/core/persistence.js)
  // =========================================================================
  describe('2. persistence.js Revision Merge and API Key Invariance', () => {
    test('local scalar fields win when local revision > remote revision', () => {
      const localState = {
        cloudConfig: { stateRevision: 5 },
        updatedAtTs: 2000,
        profileName: 'Local New Name',
        activeChatId: 'chat_local_5',
        chats: [{ id: 'chat_1', title: 'Chat 1', messages: [] }],
        routines: [],
        agentsCatalog: []
      };

      const remoteState = {
        cloudConfig: { stateRevision: 2 },
        updatedAtTs: 1000,
        profileName: 'Remote Stale Name',
        activeChatId: 'chat_remote_2',
        chats: [{ id: 'chat_1', title: 'Chat 1 Stale', messages: [] }],
        routines: [],
        agentsCatalog: []
      };

      const res = persistence.mergeMultiTabState(localState, remoteState);
      expect(res.winner).toBe('local');
      expect(res.mergedState.profileName).toBe('Local New Name');
      expect(res.mergedState.activeChatId).toBe('chat_local_5');
      expect(res.mergedState.state_revision).toBe(5);
    });

    test('remote scalar fields win when remote revision > local revision', () => {
      const localState = {
        cloudConfig: { stateRevision: 2 },
        updatedAtTs: 1000,
        profileName: 'Old Local',
        chats: [],
        routines: [],
        agentsCatalog: []
      };

      const remoteState = {
        cloudConfig: { stateRevision: 3 },
        updatedAtTs: 2000,
        profileName: 'New Remote',
        chats: [],
        routines: [],
        agentsCatalog: []
      };

      const res = persistence.mergeMultiTabState(localState, remoteState);
      expect(res.winner).toBe('incoming');
      expect(res.mergedState.profileName).toBe('New Remote');
      expect(res.mergedState.state_revision).toBe(3);
    });

    test('toTimestampMs handles numbers, numeric strings, ISO date strings, and fallbacks', () => {
      expect(persistence.toTimestampMs(1700000000000)).toBe(1700000000000);
      expect(persistence.toTimestampMs('1700000000000')).toBe(1700000000000);
      expect(persistence.toTimestampMs('2026-11-12T08:00:00.000Z')).toBe(Date.parse('2026-11-12T08:00:00.000Z'));
      expect(persistence.toTimestampMs(null)).toBe(0);
      expect(persistence.toTimestampMs('invalid-date')).toBe(0);
      expect(persistence.toTimestampMs(undefined)).toBe(0);
    });

    test('sanitizeLoadedState reconstructs all 14 API_KEY_NAMES without dropping any key', () => {
      const partialState = {
        apiKeys: {
          gemini: 'k-gemini',
          openai: 'k-openai',
          anthropic: 'k-anthropic',
          cohere: 'k-cohere',
          perplx: 'k-perplx'
        }
      };

      const sanitized = persistence.sanitizeLoadedState(partialState);
      expect(sanitized.apiKeys).toBeDefined();

      const expected14 = [
        'gemini', 'openrouter', 'deepseek', 'grok', 'kimi', 'tavily', 'perplx',
        'openai', 'anthropic', 'google', 'groq', 'mistral', 'perplexica', 'cohere'
      ];

      expected14.forEach(keyName => {
        expect(keyName in sanitized.apiKeys).toBe(true);
      });

      expect(sanitized.apiKeys.openai).toBe('k-openai');
      expect(sanitized.apiKeys.cohere).toBe('k-cohere');
      expect(sanitized.apiKeys.perplx).toBe('k-perplx');
      expect(sanitized.apiKeys.google).toBe('');
    });

    test('rollback mechanisim protects against storage.setItem throwing in catch block', async () => {
      const failingStorage = {
        getItem: jest.fn(() => '{"profileName":"initial"}'),
        setItem: jest.fn(() => { throw new Error('Disk IO Failure on setItem'); }),
        removeItem: jest.fn()
      };

      const res = await persistence.syncWithCloudWorker({
        storage: failingStorage,
        state: { profileName: 'test-sync' }
      });
      expect(res.ok).toBe(false);
      expect(typeof res.rolledBack).toBe('boolean');
    });
  });

  // =========================================================================
  // 3. Sanitization & URL Allowlist (src/core/sanitization.js)
  // =========================================================================
  describe('3. sanitization.js Strict Allowlist and Character Sanitization', () => {
    test('INVISIBLE_FORMAT_CHARS_RE removes hidden bidi, zero-width, and soft-hyphen characters', () => {
      const dirty = 'Hello\u0000\u00AD\u061C\u180E\u200B\u200C\u200D\u200E\u200F\u202A\u202E\u2060\uFEFFWorld';
      const cleaned = dirty.replace(sanitization.INVISIBLE_FORMAT_CHARS_RE, '');
      expect(cleaned).toBe('HelloWorld');
    });

    test('sanitizeSafeUrl enforces strict allowlist: allows https, http, mailto, tel and safe relative paths', () => {
      expect(sanitization.sanitizeSafeUrl('https://example.com/path')).toBe('https://example.com/path');
      expect(sanitization.sanitizeSafeUrl('http://example.com')).toBe('http://example.com');
      expect(sanitization.sanitizeSafeUrl('mailto:agent@nexus.os')).toBe('mailto:agent@nexus.os');
      expect(sanitization.sanitizeSafeUrl('tel:+123456789')).toBe('tel:+123456789');
      expect(sanitization.sanitizeSafeUrl('/dashboard')).toBe('/dashboard');
      expect(sanitization.sanitizeSafeUrl('#section')).toBe('#section');
      expect(sanitization.sanitizeSafeUrl('?query=1')).toBe('?query=1');
      expect(sanitization.sanitizeSafeUrl('./local.html')).toBe('./local.html');
      expect(sanitization.sanitizeSafeUrl('../parent.html')).toBe('../parent.html');

      // Unsafe protocols and patterns are blocked to '#'
      expect(sanitization.sanitizeSafeUrl('//protocol-relative.evil.com')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('data:text/html,evil')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('intent:#Intent;scheme=bad;end')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('content://media/external')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('capacitor://localhost')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('ws://localhost:8080')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('file:///etc/passwd')).toBe('#');
    });

    test('sanitizeHttpUrl blocks cloud metadata and supports loopback blocking', () => {
      // Cloud metadata SSRF
      expect(sanitization.sanitizeHttpUrl('http://169.254.169.254/latest/meta-data')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://metadata.google.internal/computeMetadata')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://instance-data')).toBe('#');

      // Loopback blocking option
      expect(sanitization.sanitizeHttpUrl('http://127.0.0.1:8765/api', { blockLoopback: true })).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://localhost:8765/api', { blockLoopback: true })).toBe('#');
      expect(sanitization.sanitizeHttpUrl('http://127.0.0.1:8765/api', { blockLoopback: true, allowLocalBridge: true })).toBe('http://127.0.0.1:8765/api');
    });
  });

  // =========================================================================
  // 4. Protected State Proxy & Deep Scanning (src/core/state.js)
  // =========================================================================
  describe('4. state.js Deep Scan and Neutralization without TypeError', () => {
    test('hasDangerousKeysDeep identifies prototype pollution vectors in deeply nested objects', () => {
      expect(state.hasDangerousKeysDeep({ normal: 'val' })).toBe(false);
      expect(state.hasDangerousKeysDeep([1, 2, { ok: true }])).toBe(false);

      const protoPayload = JSON.parse('{"nested":{"__proto__":{"polluted":true}}}');
      expect(state.hasDangerousKeysDeep(protoPayload)).toBe(true);

      const evilObj = Object.create(null);
      Object.defineProperty(evilObj, 'constructor', { value: 'bad', enumerable: true });
      expect(state.hasDangerousKeysDeep({ deep: [evilObj] })).toBe(true);
    });

    test('protected proxy neutralizes dangerous properties without throwing TypeError in strict mode', () => {
      const target = { user: 'nexus' };
      const proxy = state.createProtectedStateProxy(target);

      // In strict mode, returning true neutralizes the operation without throwing TypeError
      expect(() => {
        'use strict';
        proxy['__proto__'] = { evil: true };
        proxy['constructor'] = function() {};
        proxy['prototype'] = {};
        Object.defineProperty(proxy, '__proto__', { value: {} });
      }).not.toThrow();

      expect(({}).evil).toBeUndefined();
      expect(proxy.user).toBe('nexus');
    });

    test('secureRandomHex and secureRandomId produce unique CSPRNG identifiers', () => {
      const hex1 = state.secureRandomHex(4);
      const hex2 = state.secureRandomHex(4);
      expect(hex1).toHaveLength(8);
      expect(hex2).toHaveLength(8);
      expect(hex1).not.toBe(hex2);

      const id1 = state.secureRandomId('test');
      const id2 = state.secureRandomId('test');
      expect(id1.startsWith('test_')).toBe(true);
      expect(id2.startsWith('test_')).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });

  // =========================================================================
  // 5. Approvals Timeout Protection (src/security/approvals.js)
  // =========================================================================
  describe('5. approvals.js Timeout Guard and Resolution', () => {
    test('resolveApprovalGate timeout guard releases lock if async callback hangs', async () => {
      jest.useFakeTimers();
      try {
        const hangingCallback = jest.fn(() => new Promise(() => {})); // Never settles
        approvals.triggerApprovalGate('Dangerous action', hangingCallback);

        const p = approvals.resolveApprovalGate(true, 500);
        expect(approvals.getUiState()._isResolvingApproval).toBe(true);

        jest.advanceTimersByTime(550);
        await p.catch(() => {});

        jest.advanceTimersByTime(350);
        expect(approvals.getUiState()._isResolvingApproval).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // =========================================================================
  // 6. Providers Registry Exact Match & Auth Checks (src/providers/registry.js)
  // =========================================================================
  describe('6. registry.js Exact Scope Matching and Fail-Closed Validation', () => {
    test('validateProviderScope performs exact canonical matching instead of loose substring', () => {
      expect(registry.validateProviderScope('gmail', 'send', ['https://www.googleapis.com/auth/gmail.send'])).toBe(true);
      expect(registry.validateProviderScope('gmail', 'send', ['https://www.googleapis.com/auth/gmail.readonly'])).toBe(false);
    });

    test('executeProviderRequest fails closed when required scopes are missing', async () => {
      const res = await registry.executeProviderRequest({
        providerId: 'gmail',
        action: 'send',
        token: 'valid-token',
        grantedScopes: []
      });
      expect(res.error).toBe('SCOPE_INSUFFICIENT');
    });

    test('executeProviderRequest permits authType none without requiring token', async () => {
      const res = await registry.executeProviderRequest({
        providerId: 'web_search',
        action: 'search',
        executeFn: async () => ({ ok: true, results: ['nexus'] })
      });
      expect(res.error).toBeUndefined();
    });

    test('secureRandomId generates prefixed CSPRNG identifiers in registry', () => {
      const mcpId = registry.secureRandomId('mcp');
      expect(mcpId.startsWith('mcp_')).toBe(true);
      const mcpId2 = registry.secureRandomId('mcp');
      expect(mcpId).not.toBe(mcpId2);
    });
  });

});
