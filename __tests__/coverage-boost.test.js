/**
 * EG-Nexus-OS — Comprehensive Coverage Boost Suite
 * Targets all remaining branches in registry.js, persistence.js, and secrets.js
 */

const registry = require('../src/providers/registry.js');
const persistence = require('../src/core/persistence.js');
const secrets = require('../src/security/secrets.js');
const state = require('../src/core/state.js');
const approvals = require('../src/security/approvals.js');

async function getApprovedToken(providerId, action, params = {}) {
  const ui = approvals.getUiState();
  if (ui) ui._isResolvingApproval = false;
  let token = null;
  approvals.triggerApprovalGate({
    reason: 'Test approval',
    providerId,
    action,
    params,
    onApprove: (t) => { token = t; }
  });
  await approvals.resolveApprovalGate(true);
  if (ui) ui._isResolvingApproval = false;
  return token;
}

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
        action: 'read',
        grantedScopes: ['repo'],
        token: 'valid_token'
      });
      expect(res.status).toBe(200);
      expect(res.message).toBe('Request validated successfully');
    });

    test('executeProviderRequest formats errors from failing executeFn', async () => {
      const res = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'read',
        grantedScopes: ['repo'],
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

    test('validateProviderScope enforces strict Default-Deny and rejects wildcard scopes', () => {
      expect(registry.validateProviderScope('', 'action')).toBe(false);
      expect(registry.validateProviderScope('github', '')).toBe(false);
      expect(registry.validateProviderScope(null, 'action')).toBe(false);

      // Unknown provider with no explicit mapping -> default deny
      expect(registry.validateProviderScope('custom_unknown_provider', 'custom_action')).toBe(false);

      // Wildcard / admin general scopes are rejected under strict Default-Deny
      expect(registry.validateProviderScope('github', 'push', ['*'])).toBe(false);
      expect(registry.validateProviderScope('github', 'push', ['all'])).toBe(false);
      expect(registry.validateProviderScope('github', 'push', 'admin')).toBe(false);

      // Explicit matching scope succeeds
      expect(registry.validateProviderScope('github', 'push', 'admin,repo')).toBe(true);
      expect(registry.validateProviderScope('github', 'push', ['repo'])).toBe(true);

      // Invalid grantedScopes type (e.g. number)
      expect(registry.validateProviderScope('github', 'push', 12345)).toBe(false);

      // Provider action with no required scope -> default deny
      expect(registry.validateProviderScope('github', 'unmapped_action', ['some_scope'])).toBe(false);
    });

    test('One-Time Capability Approval Token enforces single-use atomic consumption and replay prevention', async () => {
      registry.clearApprovalTokens();

      const token = await getApprovedToken('github', 'push', { branch: 'main' });

      expect(typeof token).toBe('string');
      expect(registry.verifyApprovalToken(token)).toBe(true);

      // First execution with token succeeds and consumes token
      const res1 = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_dummy_token_123456789012345678901234567890',
        grantedScopes: ['repo'],
        approvalToken: token,
        params: { branch: 'main' },
        executeFn: async () => ({ pushed: true })
      });
      expect(res1.status).toBe(200);
      expect(res1.data).toEqual({ pushed: true });

      // Immediate Replay attack using the same token MUST be rejected
      const res2 = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_dummy_token_123456789012345678901234567890',
        grantedScopes: ['repo'],
        approvalToken: token,
        params: { branch: 'main' },
        executeFn: async () => ({ pushed: true })
      });
      expect(res2.status).toBe(403);
      expect(res2.error).toBe('APPROVAL_REQUIRED');
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

    test('readSessionSecretsAsync quarantines tampered AES-GCM payload and rejects syncCiphertext fallback (downgrade prevention)', async () => {
      secrets._resetSessionMemoryCache();
      const plainBytes = new TextEncoder().encode(JSON.stringify({
        initialized: true,
        apiKeys: { gemini: 'gemini-fallback-token' }
      }));
      const iv = new Uint8Array(12).fill(1);
      const keyRaw = secrets._initMemorySessionKey();
      const syncCipher = secrets._syncTransform(plainBytes, keyRaw, iv);

      let quarantined = false;
      const fallbackStorage = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: secrets._uint8ToHex(iv),
          ciphertext: '00'.repeat(32), // bad AES ciphertext
          syncCiphertext: secrets._uint8ToHex(syncCipher) // malicious downgrade payload
        }),
        setItem: (k) => {
          if (k.includes('_corrupted_')) quarantined = true;
        },
        removeItem: () => {}
      };

      const res = await secrets.readSessionSecretsAsync(fallbackStorage);
      expect(res.initialized).toBe(false);
      expect(quarantined).toBe(true);
    });

    test('readSessionSecretsAsync reads legacy syncCiphertext strictly when algorithm is sync-stream-v1', async () => {
      secrets._resetSessionMemoryCache();
      const plainBytes = new TextEncoder().encode(JSON.stringify({
        initialized: true,
        apiKeys: { gemini: 'gemini-legacy-token' }
      }));
      const iv = new Uint8Array(12).fill(1);
      const keyRaw = secrets._initMemorySessionKey();
      const syncCipher = secrets._syncTransform(plainBytes, keyRaw, iv);

      const legacyStorage = {
        getItem: () => JSON.stringify({
          encrypted: true,
          algorithm: 'sync-stream-v1',
          iv: secrets._uint8ToHex(iv),
          syncCiphertext: secrets._uint8ToHex(syncCipher)
        }),
        setItem: () => {},
        removeItem: () => {}
      };

      const res = await secrets.readSessionSecretsAsync(legacyStorage);
      expect(res.initialized).toBe(true);
      expect(res.apiKeys.gemini).toBe('gemini-legacy-token');
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

    test('registry provider tiers, badges and catalog lookup branch coverage', () => {
      // normalizeProviderTier branches
      expect(registry.normalizeProviderTier(null)).toBe('Catalog-only');
      expect(registry.normalizeProviderTier(undefined)).toBe('Catalog-only');
      expect(registry.normalizeProviderTier(12345)).toBe('Catalog-only');
      expect(registry.normalizeProviderTier('production-ready')).toBe('Production-ready');
      expect(registry.normalizeProviderTier('contract-tested')).toBe('Contract-tested');
      expect(registry.normalizeProviderTier('beta')).toBe('Beta');
      expect(registry.normalizeProviderTier('catalog-only')).toBe('Catalog-only');
      expect(registry.normalizeProviderTier('catalog-adapter')).toBe('Catalog-only');
      expect(registry.normalizeProviderTier('unknown_tier_xyz')).toBe('Catalog-only');

      // getProviderTierBadge branches
      expect(registry.getProviderTierBadge('production-ready')).toContain('tier-production-ready');
      expect(registry.getProviderTierBadge('contract-tested')).toContain('tier-contract-tested');
      expect(registry.getProviderTierBadge('beta')).toContain('tier-beta');
      expect(registry.getProviderTierBadge('catalog-only')).toContain('tier-catalog-only');
      expect(registry.getProviderTierBadge(null)).toContain('tier-catalog-only');
      expect(registry.getProviderTierBadge('')).toContain('tier-catalog-only');

      // getProviderConfig branches
      expect(registry.getProviderConfig(null)).toBeNull();
      expect(registry.getProviderConfig(12345)).toBeNull();
      expect(registry.getProviderConfig('')).toBeNull();
      const ghCfg = registry.getProviderConfig('github');
      expect(ghCfg).toBeDefined();
      expect(ghCfg.tier).toBe('Production-ready');
      const tailscaleCfg = registry.getProviderConfig('tailscale');
      expect(tailscaleCfg).toBeDefined();
      expect(tailscaleCfg.id).toBe('tailscale');
      expect(registry.getProviderConfig('totally_unknown_provider_xyz')).toBeNull();

      // getProviderTier branches
      expect(registry.getProviderTier(null)).toBe('Catalog-only');
      expect(registry.getProviderTier(12345)).toBe('Catalog-only');
      expect(registry.getProviderTier('')).toBe('Catalog-only');
      expect(registry.getProviderTier('github')).toBe('Production-ready');
      expect(registry.getProviderTier('gmail')).toBe('Production-ready');
      expect(registry.getProviderTier('telegram')).toBe('Contract-tested');
      expect(registry.getProviderTier('termux')).toBe('Contract-tested');
      expect(registry.getProviderTier('coingecko')).toBe('Contract-tested');
      expect(registry.getProviderTier('instagram')).toBe('Beta');
      expect(registry.getProviderTier('meta_ads')).toBe('Beta');
      expect(registry.getProviderTier('unknown_app_12345')).toBe('Catalog-only');
    });

    test('registry canonicalizeJson, hashing and lifecycle helper branch coverage', () => {
      // canonicalizeJson
      expect(registry.canonicalizeJson(null)).toBe('null');
      expect(registry.canonicalizeJson(42)).toBe('42');
      expect(registry.canonicalizeJson('str')).toBe('"str"');
      expect(registry.canonicalizeJson([1, null, 'a'])).toBe('[1,null,"a"]');
      const complexObj = {
        z: 10,
        a: 20,
        ignoredUndef: undefined,
        ignoredFunc: () => {},
        nested: { innerB: 2, innerA: 1 }
      };
      const canon = registry.canonicalizeJson(complexObj);
      expect(canon).toBe('{"a":20,"nested":{"innerA":1,"innerB":2},"z":10}');

      // _hashParams
      expect(registry._hashParams(null)).toBe('');
      expect(registry._hashParams('')).toBe('');
      expect(registry._hashParams('raw_params_string')).toBeDefined();
      expect(registry._hashParams({ k: 'v' })).toBeDefined();

      // _sha256Hex
      expect(registry._sha256Hex(null)).toBe('');
      expect(registry._sha256Hex(undefined)).toBe('');
      expect(registry._sha256Hex('')).toBeDefined();
      expect(registry._sha256Hex('test-input')).toBeDefined();

      // deepFreeze
      expect(registry.deepFreeze(null)).toBeNull();
      expect(registry.deepFreeze(123)).toBe(123);
      expect(registry.deepFreeze('abc')).toBe('abc');
      const targetObj = { x: 1, sub: { y: 2, arr: [3, 4] } };
      const frozen = registry.deepFreeze(targetObj);
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.sub)).toBe(true);
      expect(Object.isFrozen(frozen.sub.arr)).toBe(true);

      // recordLifecycleEvent edge branches
      const evtId = 'reg-lifecycle-edge-' + Date.now();
      expect(registry.recordLifecycleEvent(evtId, 'queued')).toBeDefined();
      // Token redaction branch with approvalToken
      expect(registry.recordLifecycleEvent(evtId, 'awaiting_approval', { approvalToken: 'tok_test_secret_123' })).toBeDefined();
      expect(registry.recordLifecycleEvent(evtId, 'approved', { approvalToken: '' })).toBeDefined();

      // Auto-generated ID branch
      expect(registry.recordLifecycleEvent(null, 'queued')).toBeDefined();

      // getRequestLifecycle branches
      expect(registry.getRequestLifecycle(null)).toBeNull();
      expect(registry.getRequestLifecycle('nonexistent_req_id_xyz')).toBeNull();
      const record = registry.getRequestLifecycle(evtId);
      expect(record).toBeDefined();
      expect(record.requestId).toBe(evtId);
      expect(record.history.length).toBeGreaterThanOrEqual(3);
    });

    test('secrets forwardCompleteMigration, pure PBKDF2 & custom crypto branch coverage', async () => {
      // 1. secrets._hmacSha256Pure & _purePbkdf2HmacSha256
      const shortKey = new Uint8Array(32).fill(0xaa);
      const longKey = new Uint8Array(80).fill(0xbb); // > 64 bytes exercises key shortening branch!
      const msg = new Uint8Array([1, 2, 3, 4, 5]);

      const hmacShort = secrets._hmacSha256Pure(shortKey, msg);
      expect(hmacShort.length).toBe(32);

      const hmacLong = secrets._hmacSha256Pure(longKey, msg);
      expect(hmacLong.length).toBe(32);

      const salt = new Uint8Array([10, 20, 30, 40]);
      const pbkdfKey = secrets._purePbkdf2HmacSha256('test_passphrase', salt, 5, 32);
      expect(pbkdfKey.length).toBe(32);

      // 2. secrets._getNodeCrypto getter/setter
      const origNodeCrypto = secrets._getNodeCrypto;
      const mockFn = () => ({ createCipheriv: () => {} });
      secrets._getNodeCrypto = mockFn;
      expect(secrets._getNodeCrypto).toBeDefined();

      const mockObj = { createCipheriv: () => {} };
      secrets._getNodeCrypto = mockObj;
      expect(secrets._getNodeCrypto).toBe(mockObj);

      // Reset to original
      secrets._getNodeCrypto = origNodeCrypto;

      // 3. secrets.forwardCompleteMigration with mock storage and mock keystore
      const memStore = {};
      const mockStorage = {
        getItem: k => memStore[k] || null,
        setItem: (k, v) => { memStore[k] = v; },
        removeItem: k => { delete memStore[k]; }
      };

      // Set up staging envelope
      const mainKey = 'eg_nexus_os_v5_master_state_session_secrets';
      const stagingKey = mainKey + '_v2_staging';
      const stagingData = {
        ciphertext: 'abcdef123456',
        iv: '123456789012',
        migrationState: 'V2_DATA_VERIFIED'
      };
      mockStorage.setItem(stagingKey, JSON.stringify(stagingData));

      // Mock keystore
      const origNative = global.window?.NexusKeystoreNative;
      if (!global.window) global.window = {};
      global.window.NexusKeystoreNative = {
        getMigrationJournalState: async () => ({ journalState: 'V2_DATA_VERIFIED', activeAlias: 'key_v2' }),
        decrypt: async () => ({ data: JSON.stringify({ secret1: 'val1' }) }),
        commitKeyMigration: async () => ({ committed: true, journalState: 'ACTIVE_V2', activeAlias: 'key_v2', deletedOldKeys: true })
      };

      const fwdRes = await secrets.forwardCompleteMigration({ storage: mockStorage });
      expect(fwdRes.verified).toBe(true);
      expect(fwdRes.journalState).toBe('ACTIVE_V2');
      expect(fwdRes.forwardCompleted).toBe(true);

      // Verify staging key was promoted and removed
      expect(mockStorage.getItem(stagingKey)).toBeNull();
      expect(mockStorage.getItem(mainKey)).toBeDefined();

      // 4. secrets.forwardCompleteMigration with non-JSON staging data and throwing commitKeyMigration
      mockStorage.setItem(stagingKey, 'non_json_raw_string');
      global.window.NexusKeystoreNative.commitKeyMigration = async () => {
        throw new Error('Native Keystore Commit Failed');
      };

      const fwdErrRes = await secrets.forwardCompleteMigration({ storage: mockStorage });
      expect(fwdErrRes).toBeDefined();

      // 5. secrets.forwardCompleteMigration without store or native keystore
      delete global.window.NexusKeystoreNative;
      const fwdNoKs = await secrets.forwardCompleteMigration();
      expect(fwdNoKs).toBeDefined();
      expect(fwdNoKs.forwardCompleted).toBe(false);

      if (origNative) {
        global.window.NexusKeystoreNative = origNative;
      }
    });

    test('secrets buffer zeroization, keystore backends, property accessors and legacy plaintext branches', () => {
      // 1. _zeroizeBuffer branches
      expect(() => secrets._zeroizeBuffer(null)).not.toThrow();
      expect(() => secrets._zeroizeBuffer(undefined)).not.toThrow();

      const u8 = new Uint8Array([1, 2, 3, 4]);
      secrets._zeroizeBuffer(u8);
      expect(Array.from(u8)).toEqual([0, 0, 0, 0]);

      const nodeBuf = Buffer.from([5, 6, 7, 8]);
      secrets._zeroizeBuffer(nodeBuf);
      expect(Array.from(nodeBuf)).toEqual([0, 0, 0, 0]);

      const ab = new ArrayBuffer(4);
      new Uint8Array(ab).set([9, 10, 11, 12]);
      secrets._zeroizeBuffer(ab);
      expect(Array.from(new Uint8Array(ab))).toEqual([0, 0, 0, 0]);

      const dv = new DataView(new ArrayBuffer(4));
      new Uint8Array(dv.buffer).set([13, 14, 15, 16]);
      secrets._zeroizeBuffer(dv);
      expect(Array.from(new Uint8Array(dv.buffer))).toEqual([0, 0, 0, 0]);

      // 2. getKeystoreBackend branches
      if (!global.window) global.window = {};
      const origNativeKs = global.window.NexusKeystoreNative;

      // Native backend
      global.window.NexusKeystoreNative = { decrypt: () => {} };
      expect(secrets.getKeystoreBackend()).toBe('AndroidKeyStore');
      delete global.window.NexusKeystoreNative;

      // NodeCrypto backend
      expect(secrets.getKeystoreBackend()).toBe('NodeCrypto');

      // IndexedDB-WebCrypto backend
      secrets._getNodeCrypto = null;
      const origCrypto = global.crypto;
      if (!global.crypto) global.crypto = {};
      global.crypto.subtle = { digest: () => {} };
      expect(secrets.getKeystoreBackend()).toBe('IndexedDB-WebCrypto');

      // Memory-Fallback backend
      const origGlobalCrypto = global.crypto;
      Object.defineProperty(global, 'crypto', { value: undefined, configurable: true, writable: true });
      if (global.window) Object.defineProperty(global.window, 'crypto', { value: undefined, configurable: true, writable: true });
      expect(secrets.getKeystoreBackend()).toBe('Memory-Fallback');

      // Restore crypto
      Object.defineProperty(global, 'crypto', { value: origGlobalCrypto, configurable: true, writable: true });
      if (origCrypto) global.crypto = origCrypto;
      secrets._getNodeCrypto = secrets._getNodeCrypto; // restore
      if (origNativeKs) global.window.NexusKeystoreNative = origNativeKs;

      // 3. Property accessors on empty secrets structure
      const emptySec = secrets._extractSecretsInput(null);
      emptySec.telegramBotToken = 'bot_token_abc';
      expect(emptySec.telegramBotToken).toBe('bot_token_abc');
      emptySec.telegramBotToken = 99999;
      expect(emptySec.telegramBotToken).toBe('99999');

      emptySec.geminiApiKey = 'gemini_key_123';
      expect(emptySec.geminiApiKey).toBe('gemini_key_123');
      emptySec.geminiApiKey = 88888;
      expect(emptySec.geminiApiKey).toBe(88888);

      // Setter when apiKeys is null
      emptySec.apiKeys = null;
      emptySec.geminiApiKey = 'restored_gemini_key';
      expect(emptySec.geminiApiKey).toBe('restored_gemini_key');

      // 4. readSessionSecrets legacy plaintext transparent migration and version quarantine
      let quarantineHit = false;
      const memStore = {};
      const mockStore = {
        getItem: k => memStore[k] || null,
        setItem: (k, v) => {
          if (k.includes('_corrupted_')) quarantineHit = true;
          memStore[k] = v;
        },
        removeItem: k => { delete memStore[k]; }
      };

      const secretsKey = 'eg_nexus_os_v5_master_state_session_secrets';

      // Valid legacy plaintext envelope
      memStore[secretsKey] = JSON.stringify({
        encrypted: false,
        version: 1,
        botToken: 'migrated_plain_bot_token',
        geminiApiKey: 'migrated_gemini_key'
      });
      secrets._resetSessionCryptoState();
      const readPlain = secrets.readSessionSecrets(mockStore);
      expect(readPlain.initialized).toBe(true);
      expect(readPlain.botToken).toBe('migrated_plain_bot_token');

      // Invalid version legacy plaintext envelope (quarantine branch)
      quarantineHit = false;
      memStore[secretsKey] = JSON.stringify({
        encrypted: false,
        version: 999,
        botToken: 'bad_version_token'
      });
      secrets._resetSessionCryptoState();
      const readBadVersion = secrets.readSessionSecrets(mockStore);
      expect(quarantineHit).toBe(true);
      expect(readBadVersion.initialized).toBe(false);
    });
  });
});
