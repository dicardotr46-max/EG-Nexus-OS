const vm = require('vm');
const {
  extractFunction,
  API_KEY_NAMES,
  SESSION_SECRETS_KEY,
  SESSION_SECRETS_SCHEMA_VERSION,
  isSafeConnectionId,
  emptyApiKeys,
  createStorageMock
} = require('./test_helpers');

describe('Security & Secrets Management', () => {
  let context;
  let sessionStorageMock;

  beforeEach(() => {
    sessionStorageMock = createStorageMock();

    context = vm.createContext({
      API_KEY_NAMES,
      SESSION_SECRETS_KEY,
      SESSION_SECRETS_SCHEMA_VERSION,
      isSafeConnectionId,
      emptyApiKeys,
      sessionStorage: sessionStorageMock,
      appState: {},
      Date,
      JSON,
      Object,
      Array,
      String,
      Boolean,
      Uint8Array,
      TextEncoder,
      TextDecoder,
      Math,
      parseInt,
      _sessionCryptoKey: null,
      _sessionCryptoKeyPromise: null,
      _sessionKeyRaw: null,
      _cachedSessionSecrets: null
    });

    ['_sha256Pure', '_sha256', '_getStorage', '_resolveSecretsStorageKey', '_normalizeSecretsPayload', '_quarantineCorruptedPayload', '_initMemorySessionKey', '_uint8ToHex', '_hexToUint8', '_syncTransform', '_getOrCreateWebCryptoKey'].forEach(fnName => {
      const fnCode = extractFunction(fnName);
      if (fnCode) vm.runInContext(fnCode, context);
    });

    vm.runInContext(extractFunction('readSessionSecrets'), context);
    vm.runInContext(extractFunction('writeSessionSecrets'), context);
    vm.runInContext(extractFunction('applySessionSecrets'), context);
    vm.runInContext(extractFunction('getConnectionAccounts'), context);
    vm.runInContext(extractFunction('getAppConnectionToken'), context);
  });

  describe('writeSessionSecrets and readSessionSecrets lifecycle', () => {
    it('should return uninitialized default schema when sessionStorage is empty', () => {
      const secrets = context.readSessionSecrets();

      expect(secrets.version).toBe(SESSION_SECRETS_SCHEMA_VERSION);
      expect(secrets.initialized).toBe(false);
      expect(secrets.apiKeys).toEqual(emptyApiKeys());
      expect(secrets.connectionTokens).toEqual({});
      expect(secrets.accountTokens).toEqual({});
      expect(secrets.bridgeToken).toBe('');
    });

    it('should write and read back API keys cleanly, trimming whitespace', () => {
      const ok = context.writeSessionSecrets({
        apiKeys: {
          openai: '  sk-proj-test-openai-key  ',
          anthropic: 'sk-ant-test-anthropic-key',
          google: 'AIzaSyGoogleSecretKey'
        }
      });

      expect(ok).toBe(true);

      const secrets = context.readSessionSecrets();
      expect(secrets.initialized).toBe(true);
      expect(secrets.apiKeys.openai).toBe('sk-proj-test-openai-key');
      expect(secrets.apiKeys.anthropic).toBe('sk-ant-test-anthropic-key');
      expect(secrets.apiKeys.google).toBe('AIzaSyGoogleSecretKey');
      expect(secrets.apiKeys.groq).toBe('');
    });

    it('should write and read connection tokens and local bridgeToken', () => {
      context.writeSessionSecrets({
        apiKeys: {},
        connectionTokens: {
          telegram: 'bot123456:secretToken',
          github: 'ghp_accessToken'
        },
        bridgeToken: 'termux-bridge-token-xyz'
      });

      const secrets = context.readSessionSecrets();
      expect(secrets.connectionTokens.telegram).toBe('bot123456:secretToken');
      expect(secrets.connectionTokens.github).toBe('ghp_accessToken');
      expect(secrets.bridgeToken).toBe('termux-bridge-token-xyz');
    });

    it('should guard against prototype pollution and unsafe connection IDs', () => {
      context.writeSessionSecrets({
        apiKeys: {},
        connectionTokens: {
          'valid-service': 'token1',
          '__proto__': 'malicious_polluted_val',
          'constructor': 'malicious_polluted_val',
          'invalid;id<script>': 'malicious_val'
        }
      });

      const secrets = context.readSessionSecrets();
      expect(Object.keys(secrets.connectionTokens)).toEqual(['valid-service']);
      expect(secrets.connectionTokens['valid-service']).toBe('token1');
      expect(Object.prototype.hasOwnProperty.call(secrets.connectionTokens, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(secrets.connectionTokens, 'constructor')).toBe(false);
      expect(secrets.connectionTokens['invalid;id<script>']).toBeUndefined();
    });

    it('should handle legacy migration when full appState is passed', () => {
      const legacyState = {
        apiKeys: {
          openai: 'sk-legacy-key',
          groq: 'gsk_legacy_groq'
        },
        appConnections: {
          telegram: { token: 'bot999:migrated' },
          gmail: {
            accounts: [
              { id: 'user_1', token: 'ya29.migrated_user1' }
            ]
          }
        },
        localComputerConfig: {
          bridgeToken: 'legacy-bridge-secret'
        }
      };

      const ok = context.writeSessionSecrets(legacyState);
      expect(ok).toBe(true);

      const secrets = context.readSessionSecrets();
      expect(secrets.initialized).toBe(true);
      expect(secrets.apiKeys.openai).toBe('sk-legacy-key');
      expect(secrets.apiKeys.groq).toBe('gsk_legacy_groq');
      expect(secrets.connectionTokens.telegram).toBe('bot999:migrated');
      expect(secrets.accountTokens['gmail_user_1']).toBe('ya29.migrated_user1');
      expect(secrets.bridgeToken).toBe('legacy-bridge-secret');
    });

    it('should non-destructively merge new secrets without wiping existing stored secrets', () => {
      context.writeSessionSecrets({
        apiKeys: { openai: 'sk-first-key' },
        connectionTokens: { github: 'ghp_token_first' }
      });

      context.writeSessionSecrets({
        apiKeys: { anthropic: 'sk-second-key' },
        connectionTokens: { sentry: 'sentry_token_second' }
      });

      const secrets = context.readSessionSecrets();
      expect(secrets.apiKeys.openai).toBe('sk-first-key');
      expect(secrets.apiKeys.anthropic).toBe('sk-second-key');
      expect(secrets.connectionTokens.github).toBe('ghp_token_first');
      expect(secrets.connectionTokens.sentry).toBe('sentry_token_second');
    });

    it('should quarantine corrupted session JSON with timestamp and return safe default without crashing', () => {
      const corruptPayload = '{"apiKeys": { UNTERMINATED_CORRUPT_JSON...';
      sessionStorageMock.setItem(SESSION_SECRETS_KEY, corruptPayload);

      const secrets = context.readSessionSecrets();

      // Corrupt payload quarantined
      const allStoredKeys = Object.keys(sessionStorageMock._getStore());
      const quarantineKey = allStoredKeys.find(k => k.startsWith(SESSION_SECRETS_KEY + '_corrupted_'));

      expect(quarantineKey).toBeDefined();
      expect(sessionStorageMock.getItem(quarantineKey)).toBe(corruptPayload);
      expect(sessionStorageMock.getItem(SESSION_SECRETS_KEY)).toBeNull();

      // Returns safe fallback schema
      expect(secrets.initialized).toBe(false);
      expect(secrets.apiKeys).toEqual(emptyApiKeys());
    });

    it('should return default schema when parsed session data is not an object (e.g. array or primitive)', () => {
      sessionStorageMock.setItem(SESSION_SECRETS_KEY, JSON.stringify([1, 2, 3]));
      const secretsFromArray = context.readSessionSecrets();
      expect(secretsFromArray.initialized).toBe(false);

      sessionStorageMock.setItem(SESSION_SECRETS_KEY, JSON.stringify('malformed string'));
      const secretsFromString = context.readSessionSecrets();
      expect(secretsFromString.initialized).toBe(false);
    });
  });

  describe('applySessionSecrets re-hydration', () => {
    it('should re-hydrate session secrets into memory appState', () => {
      context.writeSessionSecrets({
        apiKeys: {
          openai: 'sk-persisted-openai',
          anthropic: 'sk-persisted-claude'
        },
        connectionTokens: {
          github: 'ghp_persisted_github_token'
        },
        accountTokens: {
          gmail_account_1: 'ya29.hydrated_token'
        },
        bridgeToken: 'hydrated-bridge-secret'
      });

      const inMemoryState = {
        apiKeys: emptyApiKeys(),
        appConnections: {
          github: { accounts: [], mcpEnabled: true, connectedAt: '2026-01-01' },
          gmail: {
            accounts: [{ id: 'account_1', email: 'me@example.com', token: '' }]
          }
        },
        localComputerConfig: { bridgeUrl: 'http://localhost:8765' }
      };

      const hydrated = context.applySessionSecrets(inMemoryState);

      expect(hydrated.apiKeys.openai).toBe('sk-persisted-openai');
      expect(hydrated.apiKeys.anthropic).toBe('sk-persisted-claude');
      expect(hydrated.appConnections.github.token).toBe('ghp_persisted_github_token');
      expect(hydrated.appConnections.gmail.accounts[0].token).toBe('ya29.hydrated_token');
      expect(hydrated.localComputerConfig.bridgeToken).toBe('hydrated-bridge-secret');
    });
  });

  describe('Google OAuth multi-account token isolation based on ${appId}_${accountId}', () => {
    beforeEach(() => {
      context.writeSessionSecrets({
        apiKeys: {},
        accountTokens: {
          'gmail_user_work': 'token_work_gmail_scope',
          'gmail_user_personal': 'token_personal_gmail_scope',
          'youtube_user_work': 'token_work_youtube_scope',
          'gcal_user_work': 'token_work_gcal_scope'
        }
      });
    });

    it('should retrieve correct token for selected account in multi-account connection', () => {
      context.appState = {
        appConnections: {
          gmail: {
            accounts: [
              { id: 'user_work', email: 'work@company.com' },
              { id: 'user_personal', email: 'me@gmail.com' }
            ],
            selectedAccountId: 'user_work'
          }
        }
      };

      const tokenWork = context.getAppConnectionToken('gmail');
      expect(tokenWork).toBe('token_work_gmail_scope');

      // Switch active account
      context.appState.appConnections.gmail.selectedAccountId = 'user_personal';
      const tokenPersonal = context.getAppConnectionToken('gmail');
      expect(tokenPersonal).toBe('token_personal_gmail_scope');
    });

    it('should strictly isolate tokens between different Google apps for same user ID', () => {
      context.appState = {
        appConnections: {
          gmail: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          },
          youtube: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          },
          gcal: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          }
        }
      };

      // Each service gets its own isolated scoped token, preventing scope mismatch
      expect(context.getAppConnectionToken('gmail')).toBe('token_work_gmail_scope');
      expect(context.getAppConnectionToken('youtube')).toBe('token_work_youtube_scope');
      expect(context.getAppConnectionToken('gcal')).toBe('token_work_gcal_scope');
    });

    it('should return empty string if requested service has no token without cross-polluting from other services', () => {
      context.appState = {
        appConnections: {
          gworkspace: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          }
        }
      };

      // Even though 'user_work' has tokens for gmail and youtube, gworkspace has no token
      const gworkspaceToken = context.getAppConnectionToken('gworkspace');
      expect(gworkspaceToken).toBe('');
    });

    it('should map accounts with isolated tokens in getConnectionAccounts', () => {
      context.appState = {
        appConnections: {
          gmail: {
            accounts: [
              { id: 'user_work', email: 'work@company.com', name: 'Work Account' },
              { id: 'user_personal', email: 'personal@gmail.com', name: 'Personal Account' }
            ]
          }
        }
      };

      const accounts = context.getConnectionAccounts('gmail');
      expect(accounts).toHaveLength(2);

      const work = accounts.find(a => a.id === 'user_work');
      expect(work.token).toBe('token_work_gmail_scope');
      expect(work.email).toBe('work@company.com');

      const personal = accounts.find(a => a.id === 'user_personal');
      expect(personal.token).toBe('token_personal_gmail_scope');
      expect(personal.email).toBe('personal@gmail.com');
    });
  });

  describe('Deterministic Session Key Recovery & Symmetric AES-GCM-256 (src/security/secrets.js)', () => {
    const NexusSecrets = require('../src/security/secrets.js');
    let sharedMock;

    beforeEach(() => {
      sharedMock = createStorageMock();
      NexusSecrets._resetSessionCryptoState();
    });

    it('should derive deterministic 32-byte key from nexus_session_key_seed_v1', () => {
      // First call generates seed
      const key1 = NexusSecrets._initMemorySessionKey(sharedMock);
      expect(key1).toBeInstanceOf(Uint8Array);
      expect(key1.length).toBe(32);

      const storedSeed = sharedMock.getItem('nexus_session_key_seed_v1');
      expect(storedSeed).toMatch(/^[0-9a-fA-F]{64}$/);

      // Reset in-memory cache to simulate page reload
      NexusSecrets._resetSessionCryptoState();

      // Second call recovers the exact same key from stored seed
      const key2 = NexusSecrets._initMemorySessionKey(sharedMock);
      expect(Array.from(key2)).toEqual(Array.from(key1));
    });

    it('should restore 100% of sync-encrypted secrets across simulated reload/RAM wipe', () => {
      const payload = {
        apiKeys: {
          gemini: 'AIzaSy-ReloadPersisted-GeminiKey',
          deepseek: 'sk-dsk-ReloadPersisted-Deepseek'
        },
        connectionTokens: {
          github: 'ghp_ReloadPersistedGithubToken'
        },
        accountTokens: {
          gmail_work: 'ya29.ReloadPersistedWorkToken'
        },
        bridgeToken: 'nexus-bridge-reload-token'
      };

      const ok = NexusSecrets.writeSessionSecrets(payload, sharedMock);
      expect(ok).toBe(true);

      const raw = sharedMock.getItem(NexusSecrets.SESSION_SECRETS_KEY);
      const parsed = JSON.parse(raw);
      expect(parsed.encrypted).toBe(true);
      expect(parsed.algorithm).toBe('sync-stream-v1');

      // Simulate complete page reload: wipe memory state
      NexusSecrets._resetSessionCryptoState();

      const recovered = NexusSecrets.readSessionSecrets(sharedMock);
      expect(recovered.initialized).toBe(true);
      expect(recovered.apiKeys.gemini).toBe('AIzaSy-ReloadPersisted-GeminiKey');
      expect(recovered.apiKeys.deepseek).toBe('sk-dsk-ReloadPersisted-Deepseek');
      expect(recovered.connectionTokens.github).toBe('ghp_ReloadPersistedGithubToken');
      expect(recovered.accountTokens.gmail_work).toBe('ya29.ReloadPersistedWorkToken');
      expect(recovered.bridgeToken).toBe('nexus-bridge-reload-token');
    });

    it('should NOT overwrite sync-written secrets in background with async format (race condition elimination)', async () => {
      const payload = {
        apiKeys: { gemini: 'AIzaSy-SyncWriteNoRaceCondition' }
      };

      NexusSecrets.writeSessionSecrets(payload, sharedMock);

      // Wait 50ms to ensure no async background promise triggers
      await new Promise(r => setTimeout(r, 50));

      const raw = sharedMock.getItem(NexusSecrets.SESSION_SECRETS_KEY);
      const parsed = JSON.parse(raw);
      expect(parsed.algorithm).toBe('sync-stream-v1');
    });

    it('should write AES-GCM-256 via writeSessionSecretsAsync and read back synchronously in Node via decipheriv', async () => {
      const payload = {
        apiKeys: {
          gemini: 'AIzaSy-AesGcmSecretKey-999',
          openrouter: 'sk-or-v1-AesGcmKey-888'
        },
        connectionTokens: {
          telegram: 'bot777:AesGcmTelegramToken'
        },
        bridgeToken: 'bridge-aes-gcm-secret'
      };

      const ok = await NexusSecrets.writeSessionSecretsAsync(payload, sharedMock);
      expect(ok).toBe(true);

      const raw = sharedMock.getItem(NexusSecrets.SESSION_SECRETS_KEY);
      const parsed = JSON.parse(raw);
      expect(parsed.encrypted).toBe(true);
      expect(parsed.algorithm).toBe('AES-GCM-256');
      expect(parsed.iv).toMatch(/^[0-9a-fA-F]{24}$/);
      expect(parsed.ciphertext).toBeDefined();

      // Wipe RAM cache to ensure reader doesn't just return in-memory cache
      NexusSecrets._resetSessionCryptoState();

      // Read back synchronously in Node environment using decipheriv
      const recovered = NexusSecrets.readSessionSecrets(sharedMock);
      expect(recovered.initialized).toBe(true);
      expect(recovered.apiKeys.gemini).toBe('AIzaSy-AesGcmSecretKey-999');
      expect(recovered.apiKeys.openrouter).toBe('sk-or-v1-AesGcmKey-888');
      expect(recovered.connectionTokens.telegram).toBe('bot777:AesGcmTelegramToken');
      expect(recovered.bridgeToken).toBe('bridge-aes-gcm-secret');
    });

    it('should read AES-GCM-256 via readSessionSecretsAsync across simulated reload', async () => {
      const payload = {
        apiKeys: {
          deepseek: 'sk-deepseek-async-roundtrip',
          kimi: 'kimi-async-roundtrip'
        },
        connectionTokens: {
          github: 'ghp_async_roundtrip_pat'
        },
        bridgeToken: 'bridge-async-roundtrip'
      };

      await NexusSecrets.writeSessionSecretsAsync(payload, sharedMock);

      // Wipe RAM cache
      NexusSecrets._resetSessionCryptoState();

      const recovered = await NexusSecrets.readSessionSecretsAsync(sharedMock);
      expect(recovered.initialized).toBe(true);
      expect(recovered.apiKeys.deepseek).toBe('sk-deepseek-async-roundtrip');
      expect(recovered.apiKeys.kimi).toBe('kimi-async-roundtrip');
      expect(recovered.connectionTokens.github).toBe('ghp_async_roundtrip_pat');
      expect(recovered.bridgeToken).toBe('bridge-async-roundtrip');
    });

    it('should migrate legacy plaintext payload to encrypted storage transparently in readSessionSecretsAsync', async () => {
      const legacyPayload = {
        initialized: true,
        apiKeys: { gemini: 'legacy-key-to-migrate' },
        connectionTokens: { telegram: 'bot-legacy-token' },
        bridgeToken: 'legacy-bridge'
      };

      sharedMock.setItem(NexusSecrets.SESSION_SECRETS_KEY, JSON.stringify(legacyPayload));

      const recovered = await NexusSecrets.readSessionSecretsAsync(sharedMock);
      expect(recovered.initialized).toBe(true);
      expect(recovered.apiKeys.gemini).toBe('legacy-key-to-migrate');
      expect(recovered.connectionTokens.telegram).toBe('bot-legacy-token');
      expect(recovered.bridgeToken).toBe('legacy-bridge');

      // Stored payload should now be encrypted
      const newStored = JSON.parse(sharedMock.getItem(NexusSecrets.SESSION_SECRETS_KEY));
      expect(newStored.encrypted).toBe(true);
    });

    it('should quarantine tampered AES-GCM-256 payload without crashing', async () => {
      await NexusSecrets.writeSessionSecretsAsync({
        apiKeys: { gemini: 'valid-gemini-key' },
        bridgeToken: 'valid-bridge'
      }, sharedMock);

      // Corrupt ciphertext
      const stored = JSON.parse(sharedMock.getItem(NexusSecrets.SESSION_SECRETS_KEY));
      stored.ciphertext = 'deadbeef' + stored.ciphertext.slice(8);
      delete stored.syncCiphertext; // ensure fallback won't succeed
      sharedMock.setItem(NexusSecrets.SESSION_SECRETS_KEY, JSON.stringify(stored));

      NexusSecrets._resetSessionCryptoState();

      const res = await NexusSecrets.readSessionSecretsAsync(sharedMock);
      expect(res.initialized).toBe(false);

      const allKeys = Object.keys(sharedMock._getStore());
      const quarantineKey = allKeys.find(k => k.startsWith(NexusSecrets.SESSION_SECRETS_KEY + '_corrupted_'));
      expect(quarantineKey).toBeDefined();
      expect(sharedMock.getItem(NexusSecrets.SESSION_SECRETS_KEY)).toBeNull();
    });
  });
});
