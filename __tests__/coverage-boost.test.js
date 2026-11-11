/**
 * EG-Nexus-OS — Comprehensive Coverage Boost Suite
 * Targets all remaining branches in registry.js, persistence.js, and secrets.js
 */

const registry = require('../src/providers/registry.js');
const persistence = require('../src/core/persistence.js');
const secrets = require('../src/security/secrets.js');
const state = require('../src/core/state.js');

describe('Coverage Boost Suite', () => {
  // =========================================================================
  // 1. Providers Registry Branches
  // =========================================================================
  describe('providers/registry.js branch coverage', () => {
    test('executeProviderRequest handles missing request or providerId', async () => {
      expect(await registry.executeProviderRequest(null)).toEqual({
        status: 400,
        error: 'BAD_REQUEST',
        message: 'Invalid provider request payload'
      });
      expect(await registry.executeProviderRequest({})).toEqual({
        status: 400,
        error: 'BAD_REQUEST',
        message: 'providerId is required'
      });
    });

    test('executeProviderRequest succeeds without executeFn', async () => {
      const res = await registry.executeProviderRequest({
        providerId: 'github',
        token: 'valid_token'
      });
      expect(res.status).toBe(200);
      expect(res.message).toBe('Request validated successfully');
    });

    test('executeProviderRequest formats errors from failing executeFn', async () => {
      const res = await registry.executeProviderRequest({
        providerId: 'github',
        token: 'valid_token',
        executeFn: async () => {
          const err = new Error('500 Internal Server Error');
          err.status = 500;
          throw err;
        }
      });
      expect(res.status).toBe(500);
      expect(res.error).toBe('ProviderServerError');
      expect(res.retryable).toBe(true);
    });

    test('validateProviderScope handles wildcard scopes, unknown providers, and invalid inputs', () => {
      expect(registry.validateProviderScope('', 'action')).toBe(false);
      expect(registry.validateProviderScope('github', '')).toBe(false);
      expect(registry.validateProviderScope(null, 'action')).toBe(false);

      // Unknown provider with no explicit mapping
      expect(registry.validateProviderScope('custom_unknown_provider', 'custom_action')).toBe(true);

      // Wildcard / admin scopes
      expect(registry.validateProviderScope('github', 'push', ['*'])).toBe(true);
      expect(registry.validateProviderScope('github', 'push', 'admin,repo')).toBe(true);
      expect(registry.validateProviderScope('github', 'push', ['all'])).toBe(true);

      // Invalid grantedScopes type (e.g. number)
      expect(registry.validateProviderScope('github', 'push', 12345)).toBe(false);

      // Provider action with no required scope
      expect(registry.validateProviderScope('github', 'unmapped_action', ['some_scope'])).toBe(true);
    });

    test('getRequiredScope and getGoogleScopes handle unknown keys', () => {
      expect(registry.getRequiredScope('unknown_provider', 'action')).toBeNull();
      expect(registry.getRequiredScope('github', 'unknown_action')).toBeNull();
      expect(registry.getRequiredScope('gmail', 'read')).toBe('https://www.googleapis.com/auth/gmail.readonly');

      expect(registry.getGoogleScopes('unknown_google_app')).toContain('userinfo.email');
    });

    test('formatProviderError covers 403, 429, 500, and generic string errors', () => {
      const err403 = registry.formatProviderError({ status: 403 }, 'google');
      expect(err403.status).toBe(403);
      expect(err403.error).toBe('Forbidden');

      const err429 = registry.formatProviderError({ status: 429, retryAfter: 45 }, 'telegram');
      expect(err429.status).toBe(429);
      expect(err429.retryAfter).toBe(45);

      const errString = registry.formatProviderError('Network timeout', 'sentry');
      expect(errString.status).toBe(500);
      expect(errString.message).toBe('Network timeout');
    });

    test('resolveRoutineConflicts handles edge cases (null inputs and timestamp fallback)', () => {
      const r1 = { id: 'r1', version: 1, updated_at: '2026-01-01T00:00:00Z' };
      const r2 = { id: 'r2', version: 1, updated_at: '2026-01-02T00:00:00Z' };

      expect(registry.resolveRoutineConflicts(null, r2)).toEqual({ resolved: r2, winner: 'remote' });
      expect(registry.resolveRoutineConflicts(r1, null)).toEqual({ resolved: r1, winner: 'local' });

      // local newer
      const rLocalNewer = { id: 'r', version: 1, updated_at: '2026-01-05T00:00:00Z' };
      const rRemoteOlder = { id: 'r', version: 1, updated_at: '2026-01-01T00:00:00Z' };
      expect(registry.resolveRoutineConflicts(rLocalNewer, rRemoteOlder).winner).toBe('local');
    });

    test('validateGithubPAT supports fine-grained, ghu_, and ghs_ tokens', () => {
      expect(registry.validateGithubPAT('ghu_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true);
      expect(registry.validateGithubPAT('ghs_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true);
    });

    test('validateTelegramWebhookLease rejects invalid URLs and tokens', () => {
      expect(registry.validateTelegramWebhookLease(null, 'secret')).toBe(false);
      expect(registry.validateTelegramWebhookLease('https://' + 'a'.repeat(260), 'secret')).toBe(false);
      expect(registry.validateTelegramWebhookLease('https://valid.org', 12345)).toBe(false);
    });

    test('cleanMemoryState and deduplicateKVEntries handle empty/malformed inputs', () => {
      expect(registry.cleanMemoryState(null)).toBeNull();
      expect(registry.cleanMemoryState({})).toEqual({});

      expect(registry.deduplicateKVEntries(null, null)).toEqual([]);
      expect(registry.deduplicateKVEntries([{ id: '1', updated_at: 100 }], null)).toHaveLength(1);
    });
  });

  // =========================================================================
  // 2. Persistence Branches
  // =========================================================================
  describe('core/persistence.js branch coverage', () => {
    test('sanitizeLoadedState repairs duplicate IDs in agents and chats', () => {
      const stateWithDupes = {
        agentsCatalog: [
          { id: 'duplicate_id', name: 'Agent A' },
          { id: 'duplicate_id', name: 'Agent B' },
          { id: '', name: 'Agent C' }
        ],
        chats: [
          { id: 'dupe_chat', title: 'Chat 1' },
          { id: 'dupe_chat', title: 'Chat 2' },
          { id: '', title: 'Chat 3' }
        ],
        skills: [{ id: 'dupe_sk', title: 'Sk 1' }, { id: 'dupe_sk', title: 'Sk 2' }]
      };

      const sanitized = persistence.sanitizeLoadedState(stateWithDupes);
      expect(sanitized._idsRepaired).toBe(true);

      const agentIds = sanitized.agentsCatalog.map(a => a.id);
      expect(new Set(agentIds).size).toBe(3);

      const chatIds = sanitized.chats.map(c => c.id);
      expect(new Set(chatIds).size).toBe(3);
    });

    test('sanitizeLoadedState handles rich chat message metadata and attachments', () => {
      const richState = {
        chats: [
          {
            id: 'c_rich',
            title: 'Workout Chat',
            isGroup: true,
            memberIds: ['ag_1', 'ag_2', ''],
            updatedAt: '2 ساعت پیش',
            updatedAtTs: 1700000000,
            draftText: 'Draft text here...',
            messages: [
              {
                id: 'm_1',
                senderType: 'user',
                senderId: 'user_1',
                senderName: 'Ali',
                text: 'Record rep',
                options: ['Option 1', 'Option 2'],
                attachmentName: 'squat_60fps.mp4',
                attachmentImage: 'data:image/png;base64,...',
                attachmentMime: 'video/mp4',
                attachmentTextSnippet: 'Rep 1-10 count',
                reaction: 'fire',
                selfReviewed: true,
                isSimulated: false,
                chattedWith: 'Agent 1',
                chattedWithId: 'ag_1',
                timestamp: '14:30'
              }
            ]
          }
        ],
        agentsCatalog: [
          {
            id: 'ag_1',
            name: 'Workout Coach',
            isPreset: true,
            presetKey: 'preset_coach',
            files: ['routine.txt', { name: 'schedule.json' }]
          }
        ],
        studioCode: ''
      };

      const sanitized = persistence.sanitizeLoadedState(richState);
      expect(sanitized.chats[0].isGroup).toBe(true);
      expect(sanitized.chats[0].memberIds).toEqual(['ag_1', 'ag_2']);
      expect(sanitized.chats[0].messages[0].reaction).toBe('fire');
      expect(sanitized.chats[0].messages[0].attachmentName).toBe('squat_60fps.mp4');
      expect(sanitized.agentsCatalog[0].isPreset).toBe(true);
      expect(sanitized.agentsCatalog[0].files).toHaveLength(2);
      expect(sanitized.studioCode).toBeDefined();
    });

    test('sanitizeLoadedState validates matching activeChatId and activeAgentProfileId', () => {
      const st = {
        activeChatId: 'chat_valid',
        activeAgentProfileId: 'agent_valid',
        chats: [{ id: 'chat_valid', title: 'Chat' }],
        agentsCatalog: [{ id: 'agent_valid', name: 'Agent' }]
      };
      const cleaned = persistence.sanitizeLoadedState(st);
      expect(cleaned.activeChatId).toBe('chat_valid');
      expect(cleaned.activeAgentProfileId).toBe('agent_valid');
    });

    test('nexusStorage functions return false/null when storage is absent', () => {
      delete global.localStorage;
      delete global.window;
      expect(persistence.nexusStorageGet('key')).toBeNull();
      expect(persistence.nexusStorageSet('key', 'val')).toBe(false);
      expect(persistence.nexusStorageRemove('key')).toBe(false);
    });

    test('sanitizeLoadedState filters out invalid and unnamed accounts', () => {
      const stateWithInvalidAccounts = {
        appConnections: {
          gmail: {
            accounts: [
              null,
              123,
              { email: '', name: '' },
              { email: 'valid@example.com' }
            ]
          }
        }
      };
      const cleaned = persistence.sanitizeLoadedState(stateWithInvalidAccounts);
      expect(cleaned.appConnections.gmail.accounts).toHaveLength(1);
      expect(cleaned.appConnections.gmail.accounts[0].email).toBe('valid@example.com');
    });
  });

  // =========================================================================
  // 3. Secrets Branches & Crypto Utilities
  // =========================================================================
  describe('security/secrets.js branch coverage', () => {
    test('_sha256Pure computes deterministic SHA-256 hash', () => {
      const data = new TextEncoder().encode('Hello Nexus World');
      const hash1 = secrets._sha256Pure(data);
      const hash2 = secrets._sha256(data);
      expect(hash1).toBeInstanceOf(Uint8Array);
      expect(hash1).toHaveLength(32);
      expect(secrets._uint8ToHex(hash1)).toBe(secrets._uint8ToHex(hash2));
    });

    test('writeSessionSecrets handles faulty storage write exceptions gracefully', () => {
      const faultyStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); }
      };

      const syncResult = secrets.writeSessionSecrets({ apiKeys: { gemini: 'k' } }, faultyStorage);
      expect(syncResult).toBe(false);
    });

    test('writeSessionSecretsAsync handles faulty storage write exceptions gracefully', async () => {
      const faultyStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); }
      };

      const asyncResult = await secrets.writeSessionSecretsAsync({ apiKeys: { gemini: 'k' } }, faultyStorage);
      expect(asyncResult).toBe(false);
    });

    test('readSessionSecrets handles missing storage or empty payload gracefully', () => {
      secrets._resetSessionMemoryCache();
      const emptyStorage = { getItem: () => null, setItem: () => {} };
      const res = secrets.readSessionSecrets(emptyStorage);
      expect(res.initialized).toBe(false);
      expect(res.apiKeys.gemini).toBe('');
    });

    test('readSessionSecretsAsync handles missing storage or empty payload gracefully', async () => {
      secrets._resetSessionMemoryCache();
      const emptyStorage = { getItem: () => null, setItem: () => {} };
      const res = await secrets.readSessionSecretsAsync(emptyStorage);
      expect(res.initialized).toBe(false);
      expect(res.apiKeys.gemini).toBe('');
    });

    test('applySessionSecrets re-hydrates bridgeToken into uninitialized localComputerConfig', () => {
      const store = new Map();
      const mockStorage = {
        getItem: k => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k)
      };

      secrets.writeSessionSecrets({
        apiKeys: { gemini: 'gemini-key' },
        connectionTokens: { github: 'ghp_token' },
        accountTokens: { 'gmail_u1': 'ya29.token1' },
        bridgeToken: 'fresh-bridge-token'
      }, mockStorage);

      const rawState = {};
      const applied = secrets.applySessionSecrets(rawState, mockStorage);
      expect(applied.apiKeys.gemini).toBe('gemini-key');
      expect(applied.appConnections.github.token).toBe('ghp_token');
      expect(applied.localComputerConfig.bridgeToken).toBe('fresh-bridge-token');
    });

    test('readSessionSecrets handles short AES-GCM ciphertext gracefully', () => {
      secrets._resetSessionMemoryCache();
      const mockStorage = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: '0102030405060708090a0b0c',
          ciphertext: '0102'
        }),
        setItem: () => {},
        removeItem: () => {}
      };
      const res = secrets.readSessionSecrets(mockStorage);
      expect(res.initialized).toBe(false);
    });

    test('readSessionSecrets handles AES-GCM decryption cipher failure', () => {
      secrets._resetSessionMemoryCache();
      const mockStorage = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: '0102030405060708090a0b0c',
          ciphertext: '00'.repeat(32)
        }),
        setItem: () => {},
        removeItem: () => {}
      };
      const res = secrets.readSessionSecrets(mockStorage);
      expect(res.initialized).toBe(false);
    });

    test('writeSessionSecrets normalizes accountTokens and blocks prototype pollution', () => {
      secrets._resetSessionMemoryCache();
      const store = new Map();
      const mockStorage = {
        getItem: k => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k)
      };

      secrets.writeSessionSecrets({
        apiKeys: {},
        accountTokens: {
          '__proto__': 'malicious',
          'constructor': 'malicious',
          'acc_valid': 'token_valid'
        }
      }, mockStorage);

      const res = secrets.readSessionSecrets(mockStorage);
      expect(res.accountTokens['acc_valid']).toBe('token_valid');
      expect(Object.prototype.hasOwnProperty.call(res.accountTokens, '__proto__')).toBe(false);
    });

    test('writeSessionSecrets handles full appState object structure with appConnections', () => {
      secrets._resetSessionMemoryCache();
      const store = new Map();
      const mockStorage = {
        getItem: k => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k)
      };

      secrets.writeSessionSecrets({
        apiKeys: { gemini: 'gemini-state-key' },
        appConnections: {
          gmail: {
            token: 'gmail-tok',
            accounts: [
              { id: 'acc_1', token: 'token-1' },
              { id: '__proto__', token: 'evil' }
            ]
          }
        },
        localComputerConfig: { bridgeToken: 'state-bridge-tok' }
      }, mockStorage);

      const res = secrets.readSessionSecrets(mockStorage);
      expect(res.apiKeys.gemini).toBe('gemini-state-key');
      expect(res.connectionTokens.gmail).toBe('gmail-tok');
      expect(res.accountTokens['gmail_acc_1']).toBe('token-1');
      expect(res.bridgeToken).toBe('state-bridge-tok');
    });

    test('readSessionSecretsAsync quarantines corrupt non-JSON and handles array payload', async () => {
      secrets._resetSessionMemoryCache();
      let quarantined = false;
      const corruptStorage = {
        getItem: () => '{ UNTERMINATED JSON',
        setItem: k => { if (k.includes('_corrupted_')) quarantined = true; },
        removeItem: () => {}
      };
      const res1 = await secrets.readSessionSecretsAsync(corruptStorage);
      expect(res1.initialized).toBe(false);
      expect(quarantined).toBe(true);

      secrets._resetSessionMemoryCache();
      const arrayStorage = {
        getItem: () => JSON.stringify([1, 2, 3]),
        setItem: () => {},
        removeItem: () => {}
      };
      const res2 = await secrets.readSessionSecretsAsync(arrayStorage);
      expect(res2.initialized).toBe(false);
    });

    test('readSessionSecretsAsync falls back to syncCiphertext when AES-GCM decryption fails', async () => {
      secrets._resetSessionMemoryCache();
      const plainBytes = new TextEncoder().encode(JSON.stringify({
        initialized: true,
        apiKeys: { gemini: 'gemini-fallback-token' }
      }));
      const iv = new Uint8Array(12).fill(1);
      const keyRaw = secrets._initMemorySessionKey();
      const syncCipher = secrets._syncTransform(plainBytes, keyRaw, iv);

      const fallbackStorage = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: secrets._uint8ToHex(iv),
          ciphertext: '00'.repeat(32), // bad AES ciphertext
          syncCiphertext: secrets._uint8ToHex(syncCipher) // valid sync fallback
        }),
        setItem: () => {},
        removeItem: () => {}
      };

      const res = await secrets.readSessionSecretsAsync(fallbackStorage);
      expect(res.initialized).toBe(true);
      expect(res.apiKeys.gemini).toBe('gemini-fallback-token');
    });

    test('readSessionSecretsAsync quarantines corrupted sync-stream payload', async () => {
      secrets._resetSessionMemoryCache();
      let quarantined = false;
      const syncCorruptStorage = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'sync-stream-v1',
          iv: '0102030405060708090a0b0c',
          ciphertext: 'aabbccdd' // bad ciphertext that decodes to invalid JSON
        }),
        setItem: k => { if (k.includes('_corrupted_')) quarantined = true; },
        removeItem: () => {}
      };
      const res = await secrets.readSessionSecretsAsync(syncCorruptStorage);
      expect(res.initialized).toBe(false);
      expect(quarantined).toBe(true);
    });

    test('covers IndexedDB Keystore success, upgrade, and error handling branches', async () => {
      const mockDB = {
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            get: jest.fn(() => {
              const req = {};
              setTimeout(() => { req.result = { type: 'mockCryptoKey' }; if (req.onsuccess) req.onsuccess(); }, 5);
              return req;
            }),
            put: jest.fn(() => {
              const req = {};
              setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 5);
              return req;
            }),
            delete: jest.fn(() => {
              const req = {};
              setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 5);
              return req;
            })
          }))
        }))
      };

      const mockIdb = {
        open: jest.fn((name, ver) => {
          const req = {};
          setTimeout(() => {
            if (req.onupgradeneeded) {
              req.onupgradeneeded({
                target: {
                  result: {
                    objectStoreNames: { contains: () => false },
                    createObjectStore: jest.fn()
                  }
                }
              });
            }
            req.result = mockDB;
            if (req.onsuccess) req.onsuccess({ target: { result: mockDB } });
          }, 5);
          return req;
        })
      };

      global.indexedDB = mockIdb;
      const key = await secrets._getKeyFromIndexedDB();
      expect(key).toEqual({ type: 'mockCryptoKey' });

      const saved = await secrets._saveKeyToIndexedDB({ type: 'mockCryptoKey' });
      expect(saved).toBe(true);

      const cleared = await secrets._clearKeyFromIndexedDB();
      expect(cleared).toBe(true);

      // Error branches
      const errorIdb = {
        open: jest.fn(() => {
          const req = {};
          setTimeout(() => {
            if (req.onerror) req.onerror();
            if (req.onblocked) req.onblocked();
          }, 5);
          return req;
        })
      };
      global.indexedDB = errorIdb;
      const errKey = await secrets._getKeyFromIndexedDB();
      expect(errKey).toBeNull();

      delete global.indexedDB;
    });

    test('readSessionSecrets returns cached secrets directly when initialized', () => {
      secrets._resetSessionMemoryCache();
      const mockStorage = {
        getItem: () => JSON.stringify({
          encrypted: false,
          initialized: true,
          apiKeys: { gemini: 'cached_test_key' }
        }),
        setItem: () => {},
        removeItem: () => {}
      };

      // First read caches it
      const first = secrets.readSessionSecrets(mockStorage);
      expect(first.apiKeys.gemini).toBe('cached_test_key');

      // Second read should return from cache
      const cached = secrets.readSessionSecrets(mockStorage);
      expect(cached.apiKeys.gemini).toBe('cached_test_key');
    });

    test('readSessionSecrets catches decipher error on corrupted AES-GCM payload in Node and quarantines', () => {
      secrets._resetSessionMemoryCache();
      let quarantined = false;
      const corruptAesStore = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: '0102030405060708090a0b0c',
          ciphertext: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff' // corrupted tag
        }),
        setItem: k => { if (k.includes('_corrupted_')) quarantined = true; },
        removeItem: () => {}
      };

      const res = secrets.readSessionSecrets(corruptAesStore);
      expect(res.initialized).toBe(false);
      expect(quarantined).toBe(true);
    });

    test('readSessionSecrets catches JSON decode error on sync-stream payload and quarantines', () => {
      secrets._resetSessionMemoryCache();
      let quarantined = false;
      const corruptSyncStore = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'sync-stream-v1',
          iv: '0102030405060708090a0b0c',
          ciphertext: '01020304' // decodes to non-JSON garbage
        }),
        setItem: k => { if (k.includes('_corrupted_')) quarantined = true; },
        removeItem: () => {}
      };

      const res = secrets.readSessionSecrets(corruptSyncStore);
      expect(res.initialized).toBe(false);
      expect(quarantined).toBe(true);
    });

    test('readSessionSecretsAsync handles tamper detection quarantine when both AES-GCM and fallback fail', async () => {
      secrets._resetSessionMemoryCache();
      let quarantined = false;
      const tamperedStore = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: '0102030405060708090a0b0c',
          ciphertext: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
          syncCiphertext: 'bad_hex_sync_garbage!'
        }),
        setItem: k => { if (k.includes('_corrupted_')) quarantined = true; },
        removeItem: () => {}
      };

      const res = await secrets.readSessionSecretsAsync(tamperedStore);
      expect(res.initialized).toBe(false);
      expect(quarantined).toBe(true);
    });

    test('persistence module error branch coverage', () => {
      const persistence = require('../src/core/persistence');
      // Storage null branch
      expect(persistence.migrateLegacyStorage(null)).toBe(false);

      // Storage throw branch
      const throwStore = {
        getItem: () => { throw new Error('Simulated disk error'); }
      };
      expect(persistence.migrateLegacyStorage(throwStore)).toBe(false);

      // getStorageSizeEstimate
      expect(persistence.getStorageSizeEstimate('non_existent_key')).toBe(0);
    });
  });
});
