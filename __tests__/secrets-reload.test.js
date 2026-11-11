/**
 * EG-Nexus-OS — Secrets Real Reload Test Suite
 * Simulates real browser page reload across completely isolated module contexts
 * Verifies AES-GCM-256 persistence, sync fallback, tamper detection, and legacy migration
 */

function createMockSessionStorage() {
  const store = new Map();
  return {
    getItem: jest.fn(key => (store.has(String(key)) ? store.get(String(key)) : null)),
    setItem: jest.fn((key, value) => {
      store.set(String(key), String(value));
    }),
    removeItem: jest.fn(key => {
      store.delete(String(key));
    }),
    clear: jest.fn(() => {
      store.clear();
    }),
    key: jest.fn(index => Array.from(store.keys())[index] || null),
    get length() {
      return store.size;
    },
    _getStore: () => Object.fromEntries(store.entries())
  };
}

describe('Secrets Real Reload Test Suite (Simulated Page Reload)', () => {
  let sharedSessionStorage;

  beforeEach(() => {
    sharedSessionStorage = createMockSessionStorage();
    global.sessionStorage = sharedSessionStorage;
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('Sync write in Context 1 -> Wipe RAM -> Context 2 restores 100% of secrets via readSessionSecrets', () => {
    // === Context 1 ===
    const secretsC1 = require('../src/security/secrets.js');

    const originalData = {
      apiKeys: {
        gemini: 'AIzaSyGeminiKeyContext1-Sync',
        openrouter: 'sk-or-v1-context1-sync',
        deepseek: 'sk-dsk-context1-sync',
        grok: 'xai-grok-sync-context1',
        openai: 'sk-proj-openai-sync-1'
      },
      connectionTokens: {
        github: 'ghp_Context1SyncGithubPatToken',
        telegram: 'bot123456:Context1SyncTelegramToken'
      },
      accountTokens: {
        gmail_user_work: 'ya29.sync_work_gmail_token',
        youtube_user_personal: 'ya29.sync_youtube_token'
      },
      bridgeToken: 'termux-bridge-sync-context1-token'
    };

    const written = secretsC1.writeSessionSecrets(originalData);
    expect(written).toBe(true);

    const storedRaw = sharedSessionStorage.getItem(secretsC1.SESSION_SECRETS_KEY);
    expect(storedRaw).toBeTruthy();
    const storedParsed = JSON.parse(storedRaw);
    expect(storedParsed.encrypted).toBe(true);
    expect(storedParsed.ciphertext).toBeDefined();

    // === Wipe RAM: destroy module cache & in-memory variables ===
    jest.resetModules();

    // === Context 2 (simulating page reload with fresh require) ===
    const secretsC2 = require('../src/security/secrets.js');
    expect(secretsC2).not.toBe(secretsC1);

    const restored = secretsC2.readSessionSecrets();
    expect(restored.initialized).toBe(true);
    expect(restored.version).toBe(secretsC2.SESSION_SECRETS_SCHEMA_VERSION);
    expect(restored.apiKeys.gemini).toBe('AIzaSyGeminiKeyContext1-Sync');
    expect(restored.apiKeys.openrouter).toBe('sk-or-v1-context1-sync');
    expect(restored.apiKeys.deepseek).toBe('sk-dsk-context1-sync');
    expect(restored.apiKeys.grok).toBe('xai-grok-sync-context1');
    expect(restored.apiKeys.openai).toBe('sk-proj-openai-sync-1');
    expect(restored.connectionTokens.github).toBe('ghp_Context1SyncGithubPatToken');
    expect(restored.connectionTokens.telegram).toBe('bot123456:Context1SyncTelegramToken');
    expect(restored.accountTokens.gmail_user_work).toBe('ya29.sync_work_gmail_token');
    expect(restored.accountTokens.youtube_user_personal).toBe('ya29.sync_youtube_token');
    expect(restored.bridgeToken).toBe('termux-bridge-sync-context1-token');
  });

  test('Async AES-GCM-256 write in Context 1 -> Wipe RAM -> Context 2 restores 100% of secrets via readSessionSecretsAsync', async () => {
    // === Context 1 ===
    const secretsC1 = require('../src/security/secrets.js');

    const secretsPayload = {
      apiKeys: {
        gemini: 'AIzaSyGemini-AESGCM-Secret-Key',
        deepseek: 'sk-dsk-AESGCM-Deepseek-Production-Key',
        kimi: 'kimi-k3-AESGCM-Secret-Token',
        tavily: 'tvly-AESGCM-Tavily-Search-Key',
        perplx: 'pplx-AESGCM-Perplexity-Key'
      },
      connectionTokens: {
        github: 'github_pat_11AABBCC_FullRepoPermissions',
        telegram: 'bot987654321:AAF-telegram-bot-aes-gcm',
        supabase: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supabase-service-role'
      },
      accountTokens: {
        gmail_user_admin: 'ya29.aesgcm_admin_gmail_oauth2',
        youtube_user_clash: 'ya29.aesgcm_clash_royale_channel',
        gcal_user_admin: 'ya29.aesgcm_admin_calendar_oauth2'
      },
      bridgeToken: 'nexus-termux-bridge-aesgcm-secure-token-9999'
    };

    const written = await secretsC1.writeSessionSecretsAsync(secretsPayload);
    expect(written).toBe(true);

    const storedRaw = sharedSessionStorage.getItem(secretsC1.SESSION_SECRETS_KEY);
    expect(storedRaw).toBeTruthy();
    const storedParsed = JSON.parse(storedRaw);
    expect(storedParsed.encrypted).toBe(true);
    expect(storedParsed.algorithm).toBe('AES-GCM-256');
    expect(storedParsed.ciphertext).toBeDefined();
    expect(storedParsed.iv).toBeDefined();

    // Verify session encryption key is persisted in shared sessionStorage for tab reload
    const storedKey = sharedSessionStorage.getItem(secretsC1.SESSION_KEY_STORAGE);
    expect(storedKey).toMatch(/^[0-9a-fA-F]{64}$/);

    // === Wipe RAM: delete module cache ===
    jest.resetModules();

    // === Context 2 (simulating page reload) ===
    const secretsC2 = require('../src/security/secrets.js');
    expect(secretsC2).not.toBe(secretsC1);

    const restored = await secretsC2.readSessionSecretsAsync();

    expect(restored.initialized).toBe(true);
    expect(restored.apiKeys.gemini).toBe('AIzaSyGemini-AESGCM-Secret-Key');
    expect(restored.apiKeys.deepseek).toBe('sk-dsk-AESGCM-Deepseek-Production-Key');
    expect(restored.apiKeys.kimi).toBe('kimi-k3-AESGCM-Secret-Token');
    expect(restored.apiKeys.tavily).toBe('tvly-AESGCM-Tavily-Search-Key');
    expect(restored.apiKeys.perplx).toBe('pplx-AESGCM-Perplexity-Key');
    expect(restored.connectionTokens.github).toBe('github_pat_11AABBCC_FullRepoPermissions');
    expect(restored.connectionTokens.telegram).toBe('bot987654321:AAF-telegram-bot-aes-gcm');
    expect(restored.connectionTokens.supabase).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supabase-service-role');
    expect(restored.accountTokens.gmail_user_admin).toBe('ya29.aesgcm_admin_gmail_oauth2');
    expect(restored.accountTokens.youtube_user_clash).toBe('ya29.aesgcm_clash_royale_channel');
    expect(restored.accountTokens.gcal_user_admin).toBe('ya29.aesgcm_admin_calendar_oauth2');
    expect(restored.bridgeToken).toBe('nexus-termux-bridge-aesgcm-secure-token-9999');
  });

  test('Cross-compatibility: Async write in Context 1 can be read by Sync readSessionSecrets in Context 2', async () => {
    const secretsC1 = require('../src/security/secrets.js');
    await secretsC1.writeSessionSecretsAsync({
      apiKeys: { gemini: 'gemini-cross-compat-key' },
      connectionTokens: { github: 'ghp_cross_compat_token' },
      bridgeToken: 'bridge-cross-compat'
    });

    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const syncRestored = secretsC2.readSessionSecrets();
    expect(syncRestored.initialized).toBe(true);
    expect(syncRestored.apiKeys.gemini).toBe('gemini-cross-compat-key');
    expect(syncRestored.connectionTokens.github).toBe('ghp_cross_compat_token');
    expect(syncRestored.bridgeToken).toBe('bridge-cross-compat');
  });

  test('Cross-compatibility: Sync write in Context 1 can be read by Async readSessionSecretsAsync in Context 2', async () => {
    const secretsC1 = require('../src/security/secrets.js');
    secretsC1.writeSessionSecrets({
      apiKeys: { deepseek: 'deepseek-sync-to-async-key' },
      connectionTokens: { telegram: 'bot555:sync-to-async' },
      bridgeToken: 'bridge-sync-to-async'
    });

    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const asyncRestored = await secretsC2.readSessionSecretsAsync();
    expect(asyncRestored.initialized).toBe(true);
    expect(asyncRestored.apiKeys.deepseek).toBe('deepseek-sync-to-async-key');
    expect(asyncRestored.connectionTokens.telegram).toBe('bot555:sync-to-async');
    expect(asyncRestored.bridgeToken).toBe('bridge-sync-to-async');
  });

  test('Edge Case: Tamper detection in AES-GCM ciphertext quarantines corrupted payload on reload', async () => {
    const secretsC1 = require('../src/security/secrets.js');
    await secretsC1.writeSessionSecretsAsync({
      apiKeys: { gemini: 'top-secret-gemini-key' },
      bridgeToken: 'confidential-bridge-token'
    });

    // Tamper with ciphertext in sessionStorage (flip bits in hex ciphertext)
    const rawStored = sharedSessionStorage.getItem(secretsC1.SESSION_SECRETS_KEY);
    const parsed = JSON.parse(rawStored);
    const originalCipher = parsed.ciphertext;

    // Flip the first two hex characters
    const tamperedHex = (originalCipher.startsWith('aa') ? 'bb' : 'aa') + originalCipher.slice(2);
    parsed.ciphertext = tamperedHex;
    // Also invalidate syncCiphertext to ensure both fail
    parsed.syncCiphertext = '00'.repeat(16);
    sharedSessionStorage.setItem(secretsC1.SESSION_SECRETS_KEY, JSON.stringify(parsed));

    // Wipe RAM
    jest.resetModules();

    // Context 2 attempt to read tampered payload
    const secretsC2 = require('../src/security/secrets.js');
    const result = await secretsC2.readSessionSecretsAsync();

    // Must return uninitialized safe fallback
    expect(result.initialized).toBe(false);
    expect(result.bridgeToken).toBe('');

    // Must quarantine the corrupted payload with timestamp
    const allKeys = Object.keys(sharedSessionStorage._getStore());
    const quarantineKey = allKeys.find(k => k.startsWith(secretsC2.SESSION_SECRETS_KEY + '_corrupted_'));
    expect(quarantineKey).toBeDefined();

    // Original key must be removed
    expect(sharedSessionStorage.getItem(secretsC2.SESSION_SECRETS_KEY)).toBeNull();
  });

  test('Edge Case: Corrupted non-JSON ciphertext in sessionStorage quarantines without throwing on reload', () => {
    const secretsC1 = require('../src/security/secrets.js');
    const corruptPayload = '<<<INVALID_JSON_CORRUPTED_HEX_CHUNK_FROM_DISK_FAULT>>>';
    sharedSessionStorage.setItem(secretsC1.SESSION_SECRETS_KEY, corruptPayload);

    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const result = secretsC2.readSessionSecrets();

    expect(result.initialized).toBe(false);
    expect(result.apiKeys.gemini).toBe('');

    const store = sharedSessionStorage._getStore();
    const quarantineKey = Object.keys(store).find(k => k.startsWith(secretsC2.SESSION_SECRETS_KEY + '_corrupted_'));
    expect(quarantineKey).toBeDefined();
    expect(store[quarantineKey]).toBe(corruptPayload);
    expect(sharedSessionStorage.getItem(secretsC2.SESSION_SECRETS_KEY)).toBeNull();
  });

  test('Edge Case: Legacy unencrypted session migration on reload upgrades to encrypted storage', async () => {
    const secretsC1 = require('../src/security/secrets.js');
    const legacyPlainPayload = {
      initialized: true,
      apiKeys: {
        gemini: 'legacy-plaintext-gemini-key',
        openrouter: 'legacy-plaintext-openrouter-key'
      },
      connectionTokens: {
        github: 'ghp_legacy_plaintext_pat'
      },
      accountTokens: {
        gmail_legacy_user: 'ya29.legacy_token'
      },
      bridgeToken: 'legacy-plaintext-bridge-token'
    };

    sharedSessionStorage.setItem(secretsC1.SESSION_SECRETS_KEY, JSON.stringify(legacyPlainPayload));

    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const result = await secretsC2.readSessionSecretsAsync();

    expect(result.initialized).toBe(true);
    expect(result.apiKeys.gemini).toBe('legacy-plaintext-gemini-key');
    expect(result.apiKeys.openrouter).toBe('legacy-plaintext-openrouter-key');
    expect(result.connectionTokens.github).toBe('ghp_legacy_plaintext_pat');
    expect(result.accountTokens.gmail_legacy_user).toBe('ya29.legacy_token');
    expect(result.bridgeToken).toBe('legacy-plaintext-bridge-token');

    // Verify session storage was upgraded to encrypted
    const newlyStoredRaw = sharedSessionStorage.getItem(secretsC2.SESSION_SECRETS_KEY);
    const newlyStored = JSON.parse(newlyStoredRaw);
    expect(newlyStored.encrypted).toBe(true);
    expect(newlyStored.ciphertext).toBeDefined();
  });

  test('Full State Re-hydration: applySessionSecrets correctly hydrates fresh state after reload', () => {
    const secretsC1 = require('../src/security/secrets.js');
    secretsC1.writeSessionSecrets({
      apiKeys: { gemini: 'AIzaSyHydratedGemini', grok: 'xai-grok-hydrated' },
      connectionTokens: { github: 'ghp_hydrated_token' },
      accountTokens: { gmail_user_primary: 'ya29.hydrated_gmail' },
      bridgeToken: 'hydrated-bridge-secret'
    });

    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const freshAppState = {
      apiKeys: secretsC2.emptyApiKeys(),
      appConnections: {
        github: { accounts: [], mcpEnabled: true, connectedAt: '2026-01-01' },
        gmail: {
          accounts: [{ id: 'user_primary', email: 'primary@example.com', token: '' }]
        }
      },
      localComputerConfig: { bridgeUrl: 'http://127.0.0.1:8765' }
    };

    const hydrated = secretsC2.applySessionSecrets(freshAppState);
    expect(hydrated.apiKeys.gemini).toBe('AIzaSyHydratedGemini');
    expect(hydrated.apiKeys.grok).toBe('xai-grok-hydrated');
    expect(hydrated.appConnections.github.token).toBe('ghp_hydrated_token');
    expect(hydrated.appConnections.gmail.accounts[0].token).toBe('ya29.hydrated_gmail');
    expect(hydrated.localComputerConfig.bridgeToken).toBe('hydrated-bridge-secret');
  });

  test('Non-object or array stored in sessionStorage returns safe uninitialized default', () => {
    const secretsC1 = require('../src/security/secrets.js');
    sharedSessionStorage.setItem(secretsC1.SESSION_SECRETS_KEY, JSON.stringify([1, 2, 3]));

    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const res = secretsC2.readSessionSecrets();
    expect(res.initialized).toBe(false);
    expect(res.bridgeToken).toBe('');
  });

  test('_nonCryptoCompatCodec and _syncTransform alias operate interchangeably across reload contexts', () => {
    const secretsC1 = require('../src/security/secrets.js');
    expect(secretsC1._nonCryptoCompatCodec).toBeDefined();
    expect(secretsC1._syncTransform).toBe(secretsC1._nonCryptoCompatCodec);

    const data = new TextEncoder().encode('Test Reload NonCrypto Data 123');
    const key = secretsC1._initMemorySessionKey(sharedSessionStorage);
    const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const encryptedBytes = secretsC1._nonCryptoCompatCodec(data, key, iv);

    // Simulate page reload
    jest.resetModules();

    const secretsC2 = require('../src/security/secrets.js');
    const key2 = secretsC2._initMemorySessionKey(sharedSessionStorage);
    expect(key2).toEqual(key);

    const decryptedBytes = secretsC2._syncTransform(encryptedBytes, key2, iv);
    expect(new TextDecoder().decode(decryptedBytes)).toBe('Test Reload NonCrypto Data 123');
  });
});
