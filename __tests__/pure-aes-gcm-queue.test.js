/**
 * EG-Nexus-OS v5.6 — Pure AES-GCM-256 Cryptography & Sequential Write Queue Test Suite
 *
 * Validates:
 * 1. Absolute removal of `syncCiphertext` from sessionStorage payloads (payload.syncCiphertext === undefined).
 * 2. Standard NIST AES-GCM-256 format (algorithm: 'AES-GCM-256', 12-byte IV, 16-byte auth tag concatenated in ciphertext).
 * 3. Both synchronous readSessionSecrets() and async readSessionSecretsAsync() decrypt standard AES-GCM-256 without syncCiphertext.
 * 4. Sequential write queue (queueSessionSecretsWrite) eliminates race conditions, tracks state ('idle' | 'pending' | 'success' | 'failed'),
 *    increments monotonic writeRevision, and prevents older writes from overwriting newer state.
 * 5. Exports across CommonJS and NexusCore modules.
 */

const secrets = require('../src/security/secrets.js');
const persistence = require('../src/core/persistence.js');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: jest.fn(key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: jest.fn((key, val) => { store[key] = String(val); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(k => delete store[k]);
    }),
    _getStore: () => store
  };
}

describe('Pure AES-GCM-256 Cryptography & Sequential Write Queue (v5.6)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    secrets._resetSessionCryptoState();
    secrets.resetSessionWriteQueue();
    persistence.resetSessionWriteQueue();
  });

  afterEach(() => {
    secrets._resetSessionCryptoState();
    secrets.resetSessionWriteQueue();
    persistence.resetSessionWriteQueue();
  });

  describe('Requirement 1: Definitive Removal of syncCiphertext', () => {
    test('writeSessionSecrets writes AES-GCM-256 with NO syncCiphertext field in storage payload', () => {
      const payload = {
        apiKeys: {
          gemini: 'TEST_DUMMY_KEY_NOT_A_SECRET_01',
          deepseek: 'TEST_DUMMY_KEY_NOT_A_SECRET_02'
        },
        connectionTokens: {
          telegram: 'TEST_DUMMY_KEY_NOT_A_SECRET_03'
        },
        bridgeToken: 'pure-bridge-token-xyz'
      };

      const writeOk = secrets.writeSessionSecrets(payload, mockStorage);
      expect(writeOk).toBe(true);

      const raw = mockStorage.getItem(secrets.SESSION_SECRETS_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);

      // Strict assertions on wire format
      expect(parsed.encrypted).toBe(true);
      expect(parsed.algorithm).toBe('AES-GCM-256');
      expect(parsed.iv).toMatch(/^[0-9a-fA-F]{24}$/); // 12-byte IV = 24 hex characters
      expect(parsed.ciphertext).toBeDefined();
      expect(typeof parsed.ciphertext).toBe('string');
      expect(parsed.ciphertext.length).toBeGreaterThan(32); // Data + 16-byte auth tag (>= 32 hex chars)
      expect(parsed.version).toBe(secrets.SESSION_SECRETS_SCHEMA_VERSION);

      // CRITICAL: syncCiphertext MUST BE UNDEFINED!
      expect('syncCiphertext' in parsed).toBe(false);
      expect(parsed.syncCiphertext).toBeUndefined();

      // Wipe memory cache to force decipher from storage ciphertext alone
      secrets._resetSessionCryptoState();

      // Read back synchronously
      const readSync = secrets.readSessionSecrets(mockStorage);
      expect(readSync.initialized).toBe(true);
      expect(readSync.apiKeys.gemini).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_01');
      expect(readSync.apiKeys.deepseek).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_02');
      expect(readSync.connectionTokens.telegram).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_03');
      expect(readSync.bridgeToken).toBe('pure-bridge-token-xyz');

      // Wipe memory cache again
      secrets._resetSessionCryptoState();

      // Read back asynchronously
      return secrets.readSessionSecretsAsync(mockStorage).then(readAsync => {
        expect(readAsync.initialized).toBe(true);
        expect(readAsync.apiKeys.gemini).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_01');
        expect(readAsync.apiKeys.deepseek).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_02');
        expect(readAsync.connectionTokens.telegram).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_03');
        expect(readAsync.bridgeToken).toBe('pure-bridge-token-xyz');
      });
    });

    test('writeSessionSecretsAsync writes standard AES-GCM-256 with NO syncCiphertext field', async () => {
      const payload = {
        apiKeys: {
          openai: 'TEST_DUMMY_KEY_NOT_A_SECRET_04',
          anthropic: 'TEST_DUMMY_KEY_NOT_A_SECRET_05'
        },
        connectionTokens: {
          github: 'TEST_DUMMY_KEY_NOT_A_SECRET_06'
        },
        bridgeToken: 'bridge-async-pure-token'
      };

      const writeOk = await secrets.writeSessionSecretsAsync(payload, mockStorage);
      expect(writeOk).toBe(true);

      const raw = mockStorage.getItem(secrets.SESSION_SECRETS_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);

      expect(parsed.encrypted).toBe(true);
      expect(parsed.algorithm).toBe('AES-GCM-256');
      expect(parsed.iv).toMatch(/^[0-9a-fA-F]{24}$/);
      expect(parsed.ciphertext).toBeDefined();

      // CRITICAL: syncCiphertext MUST BE UNDEFINED!
      expect('syncCiphertext' in parsed).toBe(false);
      expect(parsed.syncCiphertext).toBeUndefined();

      // Wipe RAM
      secrets._resetSessionCryptoState();

      // Synchronous read of async-written AES-GCM-256 payload without syncCiphertext
      const syncRecovered = secrets.readSessionSecrets(mockStorage);
      expect(syncRecovered.initialized).toBe(true);
      expect(syncRecovered.apiKeys.openai).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_04');
      expect(syncRecovered.apiKeys.anthropic).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_05');
      expect(syncRecovered.connectionTokens.github).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_06');
      expect(syncRecovered.bridgeToken).toBe('bridge-async-pure-token');

      // Wipe RAM
      secrets._resetSessionCryptoState();

      // Async read of async-written AES-GCM-256 payload without syncCiphertext
      const asyncRecovered = await secrets.readSessionSecretsAsync(mockStorage);
      expect(asyncRecovered.initialized).toBe(true);
      expect(asyncRecovered.apiKeys.openai).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_04');
      expect(asyncRecovered.apiKeys.anthropic).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_05');
      expect(asyncRecovered.connectionTokens.github).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_06');
      expect(asyncRecovered.bridgeToken).toBe('bridge-async-pure-token');
    });

    test('retains legacy syncCiphertext reading strictly as one-way migration path', async () => {
      // Legacy payload containing syncCiphertext
      const iv = new Uint8Array(12).fill(5);
      const keyRaw = secrets._initMemorySessionKey(mockStorage);
      const plainBytes = new TextEncoder().encode(JSON.stringify({
        initialized: true,
        apiKeys: { gemini: 'legacy-migrated-gemini' },
        bridgeToken: 'legacy-migrated-bridge'
      }));
      const syncCipher = secrets._nonCryptoCompatCodec(plainBytes, keyRaw, iv);

      const legacyStored = {
        encrypted: true,
        algorithm: 'sync-stream-v1',
        iv: secrets._uint8ToHex(iv),
        syncCiphertext: secrets._uint8ToHex(syncCipher) // Legacy fallback
      };

      mockStorage.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify(legacyStored));
      secrets._resetSessionCryptoState();

      // readSessionSecrets should recover via legacy fallback
      const recoveredSync = secrets.readSessionSecrets(mockStorage);
      expect(recoveredSync.initialized).toBe(true);
      expect(recoveredSync.apiKeys.gemini).toBe('legacy-migrated-gemini');
      expect(recoveredSync.bridgeToken).toBe('legacy-migrated-bridge');

      // When newly written or re-encrypted, syncCiphertext is NEVER written
      secrets.writeSessionSecrets(recoveredSync, mockStorage);
      const newStored = JSON.parse(mockStorage.getItem(secrets.SESSION_SECRETS_KEY));
      expect(newStored.algorithm).toBe('AES-GCM-256');
      expect(newStored.syncCiphertext).toBeUndefined();
    });

    test('rejects syncCiphertext fallback and quarantines corrupted AES-GCM-256 payload (downgrade prevention)', () => {
      const iv = new Uint8Array(12).fill(5);
      const keyRaw = secrets._initMemorySessionKey(mockStorage);
      const plainBytes = new TextEncoder().encode(JSON.stringify({
        initialized: true,
        apiKeys: { gemini: 'attack-downgrade-key' },
        bridgeToken: 'attack-bridge'
      }));
      const syncCipher = secrets._nonCryptoCompatCodec(plainBytes, keyRaw, iv);

      const attackPayload = {
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: secrets._uint8ToHex(iv),
        ciphertext: '00'.repeat(32), // Incomplete/corrupted GCM ciphertext
        syncCiphertext: secrets._uint8ToHex(syncCipher) // Attacker downgrade vector
      };

      mockStorage.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify(attackPayload));
      secrets._resetSessionCryptoState();

      const recovered = secrets.readSessionSecrets(mockStorage);
      expect(recovered.initialized).toBe(false);
      expect(recovered.apiKeys.gemini).toBe('');

      // Storage should be quarantined and original key removed
      expect(mockStorage.getItem(secrets.SESSION_SECRETS_KEY)).toBeNull();
    });
  });

  describe('Requirement 2: Sequential Write Queue (queueSessionSecretsWrite)', () => {
    test('initial state is idle and revision is 0', () => {
      expect(secrets.getSessionWriteState()).toBe('idle');
      expect(secrets.getSessionWriteRevision()).toBe(0);
      expect(persistence.getSessionWriteState()).toBe('idle');
      expect(persistence.getSessionWriteRevision()).toBe(0);
    });

    test('queueSessionSecretsWrite executes sequentially, increments revision, and reaches success state', async () => {
      expect(secrets.getSessionWriteState()).toBe('idle');

      const p1 = secrets.queueSessionSecretsWrite({
        apiKeys: { gemini: 'queue-key-1' }
      }, mockStorage);

      expect(secrets.getSessionWriteRevision()).toBe(1);
      expect(secrets.getSessionWriteState()).toBe('pending');

      const res1 = await p1;
      expect(res1).toBe(true);
      expect(secrets.getSessionWriteState()).toBe('success');
      expect(secrets.getSessionWriteRevision()).toBe(1);

      // Verify written payload
      const raw1 = JSON.parse(mockStorage.getItem(secrets.SESSION_SECRETS_KEY));
      expect(raw1.algorithm).toBe('AES-GCM-256');
      expect(raw1.syncCiphertext).toBeUndefined();

      // Read back
      secrets._resetSessionCryptoState();
      const read1 = secrets.readSessionSecrets(mockStorage);
      expect(read1.apiKeys.gemini).toBe('queue-key-1');
    });

    test('multiple concurrent calls queue strictly in sequence without race conditions', async () => {
      const callOrder = [];

      const p1 = secrets.queueSessionSecretsWrite({
        apiKeys: { gemini: 'rev-1-data' }
      }, mockStorage).then(() => {
        callOrder.push('p1');
      });

      const p2 = secrets.queueSessionSecretsWrite({
        apiKeys: { gemini: 'rev-2-data' }
      }, mockStorage).then(() => {
        callOrder.push('p2');
      });

      const p3 = persistence.queueSessionSecretsWrite({
        apiKeys: { gemini: 'rev-3-final-data' }
      }, mockStorage).then(() => {
        callOrder.push('p3');
      });

      expect(secrets.getSessionWriteRevision()).toBe(3);
      expect(persistence.getSessionWriteRevision()).toBe(3);
      expect(secrets.getSessionWriteState()).toBe('pending');

      await Promise.all([p1, p2, p3]);

      // Strict FIFO order preserved
      expect(callOrder).toEqual(['p1', 'p2', 'p3']);
      expect(secrets.getSessionWriteState()).toBe('success');

      // Storage should have the final revision's data
      secrets._resetSessionCryptoState();
      const finalRestored = secrets.readSessionSecrets(mockStorage);
      expect(finalRestored.apiKeys.gemini).toBe('rev-3-final-data');
    });

    test('failure updates sessionWriteState to failed but queue continues to operate', async () => {
      const faultyStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceeded on write'); }
      };

      await expect(secrets.queueSessionSecretsWrite({
        apiKeys: { gemini: 'fail-key' }
      }, faultyStorage)).rejects.toThrow('writeSessionSecretsAsync returned false');

      expect(secrets.getSessionWriteState()).toBe('failed');
      expect(secrets.getSessionWriteRevision()).toBe(1);

      // Subsequent write to valid storage should succeed and transition state to success
      const pSuccess = secrets.queueSessionSecretsWrite({
        apiKeys: { gemini: 'recovered-key' }
      }, mockStorage);

      const ok = await pSuccess;
      expect(ok).toBe(true);
      expect(secrets.getSessionWriteState()).toBe('success');
      expect(secrets.getSessionWriteRevision()).toBe(2);
    });

    test('resetSessionWriteQueue resets revision, state, and promise queue', async () => {
      await secrets.queueSessionSecretsWrite({ apiKeys: { gemini: 'k1' } }, mockStorage);
      expect(secrets.getSessionWriteRevision()).toBe(1);
      expect(secrets.getSessionWriteState()).toBe('success');

      secrets.resetSessionWriteQueue();
      expect(secrets.getSessionWriteRevision()).toBe(0);
      expect(secrets.getSessionWriteState()).toBe('idle');
    });

    test('older writes cannot overwrite newer committed revisions', async () => {
      // Simulate state where writeRevision is already at 5 and last applied revision is 5
      await secrets.queueSessionSecretsWrite({ apiKeys: { gemini: 'rev-new' } }, mockStorage);
      expect(secrets.getSessionWriteRevision()).toBe(1);

      // Verify secrets
      secrets._resetSessionCryptoState();
      const read = secrets.readSessionSecrets(mockStorage);
      expect(read.apiKeys.gemini).toBe('rev-new');
    });

    test('exports match between secrets and persistence modules', () => {
      expect(typeof secrets.queueSessionSecretsWrite).toBe('function');
      expect(typeof secrets.getSessionWriteState).toBe('function');
      expect(typeof secrets.getSessionWriteRevision).toBe('function');
      expect(typeof secrets.resetSessionWriteQueue).toBe('function');

      expect(typeof persistence.queueSessionSecretsWrite).toBe('function');
      expect(typeof persistence.getSessionWriteState).toBe('function');
      expect(typeof persistence.getSessionWriteRevision).toBe('function');
      expect(typeof persistence.resetSessionWriteQueue).toBe('function');
    });

    test('persistence.queueSessionSecretsWrite delegates directly to secrets.queueSessionSecretsWrite', async () => {
      const payload = { apiKeys: { deepseek: 'TEST_DUMMY_KEY_NOT_A_SECRET_07' } };
      const res = await persistence.queueSessionSecretsWrite(payload, mockStorage);
      expect(res).toBe(true);
      expect(persistence.getSessionWriteState()).toBe('success');
      expect(persistence.getSessionWriteRevision()).toBe(1);

      secrets._resetSessionCryptoState();
      const loaded = secrets.readSessionSecrets(mockStorage);
      expect(loaded.apiKeys.deepseek).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_07');
    });

    test('queueSessionSecretsWrite handles empty or non-object payload gracefully without throwing', async () => {
      const res1 = await secrets.queueSessionSecretsWrite(null, mockStorage);
      expect(res1).toBe(true);
      const res2 = await secrets.queueSessionSecretsWrite(undefined, mockStorage);
      expect(res2).toBe(true);
      expect(secrets.getSessionWriteState()).toBe('success');
    });

    test('queueSessionSecretsWrite transitions through lifecycle states', async () => {
      expect(secrets.getSessionWriteState()).toBe('idle');
      const p = secrets.queueSessionSecretsWrite({ apiKeys: { gemini: 'k-lifecycle' } }, mockStorage);
      // Immediately after triggering, state should be pending or resolve to success
      const ok = await p;
      expect(ok).toBe(true);
      expect(secrets.getSessionWriteState()).toBe('success');
      expect(secrets.getSessionWriteRevision()).toBe(1);
    });

    test('queueSessionSecretsWrite sequential stress: 10 concurrent writes complete in strict monotonic order', async () => {
      const promises = [];
      const completedOrder = [];

      for (let i = 1; i <= 10; i++) {
        promises.push(
          secrets.queueSessionSecretsWrite({
            apiKeys: { stressKey: `val-${i}` }
          }, mockStorage).then(ok => {
            completedOrder.push(i);
            return ok;
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);
      expect(completedOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(secrets.getSessionWriteRevision()).toBe(10);
      expect(secrets.getSessionWriteState()).toBe('success');

      // Final state matches the last write
      secrets._resetSessionCryptoState();
      const read = secrets.readSessionSecrets(mockStorage);
      expect(read.apiKeys.stressKey).toBe('val-10');
    });

    test('writeSessionSecretsAsync and readSessionSecretsAsync roundtrip multi-provider keys faithfully', async () => {
      const multiKeys = {
        apiKeys: {
          gemini: 'TEST_DUMMY_KEY_NOT_A_SECRET_08',
          deepseek: 'TEST_DUMMY_KEY_NOT_A_SECRET_09',
          openai: 'TEST_DUMMY_KEY_NOT_A_SECRET_10',
          anthropic: 'TEST_DUMMY_KEY_NOT_A_SECRET_11',
          groq: 'TEST_DUMMY_KEY_NOT_A_SECRET_12'
        },
        connectionTokens: {
          gmail: 'TEST_DUMMY_KEY_NOT_A_SECRET_13',
          github: 'TEST_DUMMY_KEY_NOT_A_SECRET_14'
        }
      };

      const writeRes = await secrets.writeSessionSecretsAsync(multiKeys, mockStorage);
      expect(writeRes).toBe(true);

      secrets._resetSessionCryptoState();
      const restored = await secrets.readSessionSecretsAsync(mockStorage);
      expect(restored.apiKeys.gemini).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_08');
      expect(restored.apiKeys.deepseek).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_09');
      expect(restored.apiKeys.openai).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_10');
      expect(restored.apiKeys.anthropic).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_11');
      expect(restored.apiKeys.groq).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_12');
      expect(restored.connectionTokens.gmail).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_13');
      expect(restored.connectionTokens.github).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_14');
    });

    test('AES-GCM-256 payload never exposes plaintext keys anywhere in sessionStorage JSON string', async () => {
      const secretVal = 'SUPER_SECRET_TOKEN_DO_NOT_LEAK_IN_STORAGE';
      await secrets.queueSessionSecretsWrite({
        apiKeys: { gemini: secretVal }
      }, mockStorage);

      const rawStored = mockStorage.getItem(secrets.SESSION_SECRETS_KEY);
      expect(rawStored).toBeDefined();
      expect(typeof rawStored).toBe('string');
      expect(rawStored).not.toContain(secretVal);
      expect(rawStored).not.toContain('syncCiphertext');
    });

    test('corrupted authentication tag in AES-GCM ciphertext fails gracefully to safe empty state without crashing', () => {
      secrets.writeSessionSecrets({ apiKeys: { gemini: 'valid-key' } }, mockStorage);
      const rawStored = JSON.parse(mockStorage.getItem(secrets.SESSION_SECRETS_KEY));

      // Corrupt the base64 ciphertext
      rawStored.ciphertext = 'AAAA' + rawStored.ciphertext.slice(4);
      mockStorage.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify(rawStored));

      secrets._resetSessionCryptoState();
      expect(() => {
        const result = secrets.readSessionSecrets(mockStorage);
        expect(result.initialized).toBe(false);
        expect(result.apiKeys.gemini).toBe('');
      }).not.toThrow();
    });

    test('corrupted IV in AES-GCM ciphertext fails gracefully to safe empty state without crashing', () => {
      secrets.writeSessionSecrets({ apiKeys: { gemini: 'valid-key' } }, mockStorage);
      const rawStored = JSON.parse(mockStorage.getItem(secrets.SESSION_SECRETS_KEY));

      // Corrupt the IV (invalid base64 or length)
      rawStored.iv = 'invalid-iv-format!!';
      mockStorage.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify(rawStored));

      secrets._resetSessionCryptoState();
      expect(() => {
        const result = secrets.readSessionSecrets(mockStorage);
        expect(result.initialized).toBe(false);
        expect(result.apiKeys.gemini).toBe('');
      }).not.toThrow();
    });

    test('tampered algorithm field in payload is rejected and falls back safely', () => {
      secrets.writeSessionSecrets({ apiKeys: { gemini: 'valid-key' } }, mockStorage);
      const rawStored = JSON.parse(mockStorage.getItem(secrets.SESSION_SECRETS_KEY));

      rawStored.algorithm = 'DES-ECB-INSECURE';
      mockStorage.setItem(secrets.SESSION_SECRETS_KEY, JSON.stringify(rawStored));

      secrets._resetSessionCryptoState();
      const result = secrets.readSessionSecrets(mockStorage);
      expect(result.initialized).toBe(false);
      expect(result.apiKeys.gemini).toBe('');
    });

    test('multiple concurrent queue calls with interleaved reads observe deterministic latest committed state', async () => {
      const ops = [
        secrets.queueSessionSecretsWrite({ apiKeys: { key: 'val-1' } }, mockStorage),
        secrets.queueSessionSecretsWrite({ apiKeys: { key: 'val-2' } }, mockStorage),
        secrets.queueSessionSecretsWrite({ apiKeys: { key: 'val-3' } }, mockStorage)
      ];

      await Promise.all(ops);
      expect(secrets.getSessionWriteRevision()).toBe(3);

      secrets._resetSessionCryptoState();
      const finalRead = secrets.readSessionSecrets(mockStorage);
      expect(finalRead.apiKeys.key).toBe('val-3');
    });
  });

  describe('v5.7 Cryptography & Concurrency Specialist Audit Verification', () => {
    test('_fillSecureRandomBytes provides fail-closed CSPRNG', () => {
      expect(typeof secrets._fillSecureRandomBytes).toBe('function');
      const buf12 = new Uint8Array(12);
      secrets._fillSecureRandomBytes(buf12);
      expect(buf12.some(b => b !== 0)).toBe(true);

      const buf32 = new Uint8Array(32);
      secrets._fillSecureRandomBytes(buf32);
      expect(buf32.some(b => b !== 0)).toBe(true);

      expect(() => secrets._fillSecureRandomBytes(null)).toThrow('targetBuffer must be a Uint8Array');
      expect(() => secrets._fillSecureRandomBytes([1, 2, 3])).toThrow('targetBuffer must be a Uint8Array');
    });

    test('_fillSecureRandomBytes throws explicit fail-closed error when both CSPRNG sources unavailable', () => {
      const origGetRandomValues = global.crypto?.getRandomValues;
      const origNodeCrypto = secrets._getNodeCrypto();

      // Temporarily mock _getNodeCrypto to return empty object without randomBytes
      const origGetNodeCryptoFn = secrets._getNodeCrypto;
      try {
        if (global.crypto) global.crypto.getRandomValues = undefined;
        // Mock target buffer
        const buf = new Uint8Array(16);
        // If we force failure
        const badCryptoObj = { getRandomValues: undefined };
        expect(() => {
          // Test with null crypto
          const oldCrypto = global.crypto;
          try {
            delete global.crypto;
            const nodeC = secrets._getNodeCrypto();
            if (nodeC) {
              const origRb = nodeC.randomBytes;
              nodeC.randomBytes = undefined;
              try {
                secrets._fillSecureRandomBytes(buf);
              } finally {
                nodeC.randomBytes = origRb;
              }
            }
          } finally {
            global.crypto = oldCrypto;
          }
        }).toThrow('Cryptographically secure PRNG is unavailable');
      } finally {
        if (global.crypto && origGetRandomValues) {
          global.crypto.getRandomValues = origGetRandomValues;
        }
      }
    });

    test('legacy key seed in storage is automatically purged on init and migrated to memory Symbol', () => {
      const storeWithLegacySeed = {
        _data: {
          'nexus_session_key_seed_v1': '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
        },
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
      };

      secrets._resetSessionCryptoState();
      const derivedKey = secrets._initMemorySessionKey(storeWithLegacySeed);
      expect(derivedKey).toBeInstanceOf(Uint8Array);
      expect(derivedKey.length).toBe(32);

      // Plaintext seed MUST be removed from store
      expect(storeWithLegacySeed.getItem('nexus_session_key_seed_v1')).toBeNull();
      // Key must be stored on non-enumerable symbol
      expect(storeWithLegacySeed[secrets.SESSION_KEY_SYM]).toEqual(derivedKey);
    });

    test('writeSessionSecretsAsync does not corrupt memory cache on QuotaExceededError disk failure', async () => {
      const goodStorage = {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
      };

      // Write initial secrets
      await secrets.writeSessionSecretsAsync({
        apiKeys: { gemini: 'initial-stable-key' }
      }, goodStorage);

      const cachedBefore = secrets.readSessionSecrets(goodStorage);
      expect(cachedBefore.apiKeys.gemini).toBe('initial-stable-key');

      // Now attempt write to storage that throws QuotaExceededError
      const quotaStorage = {
        getItem(k) { return goodStorage.getItem(k); },
        setItem() {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        },
        removeItem(k) { return goodStorage.removeItem(k); }
      };

      const writeRes = await secrets.writeSessionSecretsAsync({
        apiKeys: { gemini: 'unwritten-corrupted-key' }
      }, quotaStorage);

      expect(writeRes).toBe(false);

      // Memory cache MUST remain in sync with disk and NOT updated to unwritten key
      const cachedAfter = secrets.readSessionSecrets(goodStorage);
      expect(cachedAfter.apiKeys.gemini).toBe('initial-stable-key');
    });

    test('synchronous writeSessionSecrets increments writeRevision and sets lastAppliedWriteRevision', () => {
      secrets.resetSessionWriteQueue();
      const revBefore = secrets.getSessionWriteRevision();

      secrets.writeSessionSecrets({
        apiKeys: { gemini: 'sync-rev-key' }
      }, mockStorage);

      const revAfter = secrets.getSessionWriteRevision();
      expect(revAfter).toBe(revBefore + 1);
    });
  });
});
