/**
 * EG-Nexus-OS v6.0.0 — Coverage Booster Test Suite
 * Covers SecretVault, PBKDF2 edge cases, StateStore session clears, and approvals branches.
 */

const secrets = require('../src/security/secrets.js');
const persistence = require('../src/core/persistence.js');
const stateModule = require('../src/core/state.js');
const approvals = require('../src/security/approvals.js');
const registry = require('../src/providers/registry.js');

describe('EG-Nexus-OS v6.0.0 Coverage Booster Suite', () => {

  describe('1. SecretVault Lifecycle & Methods Coverage', () => {
    let mockStorage;
    let store;

    beforeEach(() => {
      store = {};
      mockStorage = {
        getItem: jest.fn(k => store[k] || null),
        setItem: jest.fn((k, v) => { store[k] = String(v); }),
        removeItem: jest.fn(k => { delete store[k]; }),
        _getStore: () => store
      };
      secrets._resetSessionCryptoState();
    });

    test('SecretVault initializes, encrypts, and decrypts payloads', async () => {
      const vault = new secrets.SecretVault({ storage: mockStorage });
      await vault.init();

      const enc = await vault.encrypt('secret-test-data-42', 'test-aad-scope');
      expect(enc).toBeDefined();
      expect(enc.algorithm).toBe('AES-GCM-256');
      expect(typeof enc.ciphertext).toBe('string');
      expect(typeof enc.iv).toBe('string');

      const dec = await vault.decrypt(enc.ciphertext, enc.iv, enc.aad);
      expect(dec).toBe('secret-test-data-42');
    });

    test('SecretVault WebCrypto fallback branch in encrypt and decrypt', async () => {
      const origNodeCrypto = secrets._getNodeCrypto;
      secrets._getNodeCrypto = () => null;

      try {
        const vault = new secrets.SecretVault({ storage: mockStorage });
        const enc = await vault.encrypt('webcrypto-test-data', 'test-aad');
        expect(enc.algorithm).toBe('AES-GCM-256');
        const dec = await vault.decrypt(enc.ciphertext, enc.iv, enc.aad);
        expect(dec).toBe('webcrypto-test-data');
      } finally {
        secrets._getNodeCrypto = origNodeCrypto;
      }
    });

    test('SecretVault throws when neither NodeCrypto nor WebCrypto is available', async () => {
      const origNodeCrypto = secrets._getNodeCrypto;
      const origCrypto = global.crypto;

      secrets._getNodeCrypto = () => null;
      try {
        delete global.crypto;
        const vault = new secrets.SecretVault({ storage: mockStorage });
        await expect(vault.encrypt('data')).rejects.toThrow(/(?:crypto engine unavailable|Cryptographically secure PRNG is unavailable)/i);
        await expect(vault.decrypt('00'.repeat(20), '00'.repeat(12), 'aad')).rejects.toThrow(/(?:crypto engine unavailable|crypto)/i);
      } finally {
        global.crypto = origCrypto;
        secrets._getNodeCrypto = origNodeCrypto;
      }
    });

    test('SecretVault synchronous and asynchronous write/read lifecycle', async () => {
      const vault = new secrets.SecretVault({ storage: mockStorage });
      
      const writeOk = vault.write({
        apiKeys: { gemini: 'gemini-vault-test-1', openai: 'openai-vault-test-1' },
        connectionTokens: { telegram: 'telegram-vault-tok' },
        bridgeToken: 'vault-bridge-token'
      });
      expect(writeOk).toBe(true);

      const read1 = vault.read();
      expect(read1.initialized).toBe(true);
      expect(read1.apiKeys.gemini).toBe('gemini-vault-test-1');
      expect(read1.bridgeToken).toBe('vault-bridge-token');

      const writeAsyncOk = await vault.writeAsync({
        apiKeys: { deepseek: 'deepseek-vault-async' }
      });
      expect(writeAsyncOk).toBe(true);

      const read2 = await vault.readAsync();
      expect(read2.initialized).toBe(true);
      expect(read2.apiKeys.deepseek).toBe('deepseek-vault-async');
    });

    test('SecretVault init browser environment branches (fail-closed IDB)', async () => {
      const origNodeCrypto = secrets._getNodeCrypto;
      const origGlobalIdb = globalThis.indexedDB;
      const origWindowIdb = (typeof window !== 'undefined') ? window.indexedDB : undefined;

      secrets._getNodeCrypto = () => null;
      delete globalThis.indexedDB;
      if (typeof window !== 'undefined') delete window.indexedDB;

      try {
        const vault = new secrets.SecretVault({ storage: mockStorage });
        await expect(vault.init()).rejects.toThrow(/IndexedDB keystore verification failed/i);
      } finally {
        secrets._getNodeCrypto = origNodeCrypto;
        if (origGlobalIdb !== undefined) globalThis.indexedDB = origGlobalIdb;
        if (typeof window !== 'undefined' && origWindowIdb !== undefined) window.indexedDB = origWindowIdb;
      }
    });

    test('SecretVault init browser environment branches with successful IDB', async () => {
      const origNodeCrypto = secrets._getNodeCrypto;
      const origGlobalIdb = globalThis.indexedDB;
      const origWindowIdb = (typeof window !== 'undefined') ? window.indexedDB : undefined;

      const mockKey = { type: 'secret', extractable: false };
      const fakeDb = {
        transaction: () => ({
          objectStore: () => ({
            get: () => {
              const req = { result: mockKey };
              setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 1);
              return req;
            },
            put: () => {
              const req = {};
              setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 1);
              return req;
            }
          })
        })
      };

      secrets._getNodeCrypto = () => null;
      const fakeIdbFactory = {
        open: () => {
          const req = { result: fakeDb };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 1);
          return req;
        }
      };
      globalThis.indexedDB = fakeIdbFactory;
      if (typeof window !== 'undefined') window.indexedDB = fakeIdbFactory;

      try {
        const vault = new secrets.SecretVault({ storage: mockStorage });
        await vault.init();
        expect(vault.initialized).toBe(true);
      } finally {
        secrets._getNodeCrypto = origNodeCrypto;
        if (origGlobalIdb !== undefined) globalThis.indexedDB = origGlobalIdb;
        if (typeof window !== 'undefined' && origWindowIdb !== undefined) window.indexedDB = origWindowIdb;
      }
    });

    test('exportEncryptedBackup and importEncryptedBackup format and error branches', async () => {
      const vault = new secrets.SecretVault({ storage: mockStorage });
      vault.write({ apiKeys: { gemini: 'test-key' } });

      // String format option
      const strBackup = await secrets.exportEncryptedBackup(
        { secret: 'hello' },
        'pass123',
        { format: 'string', iterations: 1000 }
      );
      expect(typeof strBackup).toBe('string');
      const parsed = JSON.parse(strBackup);
      expect(parsed.version).toBe(2);

      // Import from string
      const importedFromStr = await secrets.importEncryptedBackup(strBackup, 'pass123');
      expect(importedFromStr.secret).toBe('hello');

      // Import error branches
      await expect(secrets.importEncryptedBackup(strBackup, '')).rejects.toThrow(/passphrase/i);
      await expect(secrets.importEncryptedBackup('not-json', 'pass123')).rejects.toThrow(/valid JSON/i);
      await expect(secrets.importEncryptedBackup([1, 2, 3], 'pass123')).rejects.toThrow(/must be an object/i);
      await expect(secrets.importEncryptedBackup({ iv: 'short' }, 'pass123')).rejects.toThrow(/12-byte IV/i);
      await expect(secrets.importEncryptedBackup({ iv: '00'.repeat(12), ciphertext: '00' }, 'pass123')).rejects.toThrow(/ciphertext/i);
      await expect(secrets.importEncryptedBackup({ version: 2, iv: '00'.repeat(12), ciphertext: '00'.repeat(20), salt: '00' }, 'pass123')).rejects.toThrow(/at least 16 bytes/i);

      // Decryption failure with wrong password
      await expect(secrets.importEncryptedBackup(strBackup, 'wrong-password')).rejects.toThrow(/invalid passphrase/i);

      // WebCrypto fallback in exportEncryptedBackup
      const origNodeCrypto = secrets._getNodeCrypto;
      secrets._getNodeCrypto = () => null;
      try {
        const webCryptoBackup = await secrets.exportEncryptedBackup({ text: 'plain' }, 'web-pass', { iterations: 1000 });
        expect(webCryptoBackup).toBeDefined();
        const webCryptoImported = await secrets.importEncryptedBackup(webCryptoBackup, 'web-pass');
        expect(webCryptoImported.text).toBe('plain');
      } finally {
        secrets._getNodeCrypto = origNodeCrypto;
      }
    });

    test('importEncryptedBackup legacy v1 and non-JSON branches', async () => {
      const pass = 'legacy-pass';
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const passBytes = new TextEncoder().encode(pass);
      const cryptoNode = require('crypto');
      const keyBytes = cryptoNode.createHash('sha256').update(Buffer.concat([Buffer.from(passBytes), Buffer.from(salt)])).digest();
      const iv = cryptoNode.randomBytes(12);
      const cipher = cryptoNode.createCipheriv('aes-256-gcm', keyBytes, iv);
      const plainStr = 'non-json-plain-text';
      const enc = Buffer.concat([cipher.update(Buffer.from(plainStr)), cipher.final()]);
      const tag = cipher.getAuthTag();
      const combined = Buffer.concat([enc, tag]);

      const v1Backup = {
        version: 1,
        salt: Buffer.from(salt).toString('hex'),
        iv: iv.toString('hex'),
        ciphertext: combined.toString('hex')
      };

      const result = await secrets.importEncryptedBackup(v1Backup, pass);
      expect(result).toBe('non-json-plain-text');

      // V1 without salt
      const keyBytesNoSalt = cryptoNode.createHash('sha256').update(Buffer.from(passBytes)).digest();
      const cipher2 = cryptoNode.createCipheriv('aes-256-gcm', keyBytesNoSalt, iv);
      const enc2 = Buffer.concat([cipher2.update(Buffer.from(plainStr)), cipher2.final()]);
      const tag2 = cipher2.getAuthTag();
      const combined2 = Buffer.concat([enc2, tag2]);

      const v1NoSaltBackup = {
        version: 1,
        iv: iv.toString('hex'),
        ciphertext: combined2.toString('hex')
      };
      const result2 = await secrets.importEncryptedBackup(v1NoSaltBackup, pass);
      expect(result2).toBe('non-json-plain-text');
    });

    test('SecretVault diagnostics and static methods', () => {
      const vault = new secrets.SecretVault({ storage: mockStorage });
      const diag = vault.getDiagnostics();
      expect(diag).toBeDefined();
      expect(diag.ok).toBe(true);
      expect(diag.schemaVersion).toBe(secrets.SESSION_SECRETS_SCHEMA_VERSION);

      const staticDiag = secrets.SecretVault.getDiagnostics(mockStorage);
      expect(staticDiag).toBeDefined();
      expect(staticDiag.ok).toBe(true);
    });

    test('SecretVault encrypted backup export and import', async () => {
      const vault = new secrets.SecretVault({ storage: mockStorage });
      vault.write({
        apiKeys: { gemini: 'backup-gemini-key' },
        bridgeToken: 'backup-bridge-token'
      });

      const backup = await vault.exportEncryptedBackup('vault-passphrase-2026', { iterations: 1000 });
      expect(backup).toBeDefined();

      const imported = await vault.importEncryptedBackup(backup, 'vault-passphrase-2026');
      expect(imported).toBeDefined();
      expect(imported.apiKeys.gemini).toBe('backup-gemini-key');

      // Static export/import
      const staticBk = await secrets.SecretVault.exportEncryptedBackup({ custom: 'data' }, 'static-pass', { iterations: 1000 });
      const staticImp = await secrets.SecretVault.importEncryptedBackup(staticBk, 'static-pass');
      expect(staticImp.custom).toBe('data');
    });

    test('SecretVault throws when NIST SP 800-38D encryption limit is exceeded', async () => {
      const vault = new secrets.SecretVault({ storage: mockStorage });
      vault._encryptionCount = 1000000;

      expect(() => vault.write({ apiKeys: { gemini: 'fail' } })).toThrow(/limit reached/i);
      await expect(vault.writeAsync({ apiKeys: { gemini: 'fail' } })).rejects.toThrow(/limit reached/i);
    });

    test('applySessionSecrets and applySessionSecretsAsync hydrate state', async () => {
      secrets.writeSessionSecrets({
        apiKeys: { gemini: 'apply-gemini', openrouter: 'apply-or' },
        connectionTokens: { github: 'apply-gh-token' },
        bridgeToken: 'apply-bridge'
      }, mockStorage);

      const state = { profileName: 'Ali' };
      const hydrated = secrets.applySessionSecrets(state, mockStorage);
      expect(hydrated.apiKeys.gemini).toBe('apply-gemini');
      expect(hydrated.appConnections.github.token).toBe('apply-gh-token');
      expect(hydrated.localComputerConfig.bridgeToken).toBe('apply-bridge');

      const asyncState = { profileName: 'Reza' };
      const asyncHydrated = await secrets.applySessionSecretsAsync(asyncState, mockStorage);
      expect(asyncHydrated.apiKeys.openrouter).toBe('apply-or');
    });
  });

  describe('2. StateStore & Session Clear Coverage', () => {
    test('StateStore clearSession resets all session properties', () => {
      const store = new stateModule.StateStore({
        profileName: 'Ali',
        messages: [{ id: 'm1', text: 'hello' }],
        providerKeys: { gemini: 'key1' },
        consensusResult: { agreed: true },
        debateLog: [{ round: 1 }],
        memorySummary: 'Previous memory',
        pendingApprovals: [{ id: 'app1' }]
      });

      store.clearSession();
      const state = store.getState();
      expect(state.messages).toEqual([]);
      expect(state.providerKeys).toEqual({});
      expect(state.consensusResult).toBeNull();
      expect(state.debateLog).toEqual([]);
      expect(state.memorySummary).toBe('');
      expect(state.pendingApprovals).toEqual([]);
      expect(state.profileName).toBe('Ali');
    });

    test('appendMessage handles malformed or non-array messages safely', () => {
      const store = new stateModule.StateStore({
        messages: null
      });

      const msg = store.appendMessage({ text: 'Recovered message', sender: 'user' });
      expect(msg).toBeDefined();
      expect(msg.id).toBeDefined();
      expect(store.getState().messages).toHaveLength(1);

      // Branch: this._state is null
      store._state = null;
      const msg2 = store.appendMessage('auto-init message');
      expect(msg2.text).toBe('auto-init message');

      // Standalone appendMessage single arg branch
      const singleMsg = stateModule.appendMessage('single-string-message');
      expect(singleMsg.text).toBe('single-string-message');

      // Standalone appendMessage with store
      const storeMsg = stateModule.appendMessage(store, { text: 'delegated to store' });
      expect(storeMsg.text).toBe('delegated to store');
    });
    test('secureRandomHex and state edge branches', () => {
      const origGetRandomValues = crypto.getRandomValues;
      try {
        crypto.getRandomValues = () => { throw new Error('prng-disabled'); };
        const hex = stateModule.secureRandomHex(4);
        expect(hex).toHaveLength(8);
      } finally {
        crypto.getRandomValues = origGetRandomValues;
      }

      // Proxy defineProperty on normal extensible target
      const proxy = stateModule.createProtectedStateProxy({ a: 1 });
      Object.defineProperty(proxy, 'b', { value: 2, writable: true, configurable: true });
      expect(proxy.b).toBe(2);

      // hasDangerousKeysDeep with Symbol containing dangerous child
      const sym = Symbol('testSym');
      const evilChild = {};
      Object.defineProperty(evilChild, '__proto__', { value: { evil: true }, enumerable: true, configurable: true });
      const obj = { [sym]: evilChild };
      expect(stateModule.hasDangerousKeysDeep(obj)).toBe(true);
    });
  });

  describe('3. Approvals Module Branch Coverage', () => {
    test('resolveApprovalGate handles rejection branch', async () => {
      const onApprove = jest.fn();
      const onReject = jest.fn();

      approvals.triggerApprovalGate('Dangerous action', onApprove, onReject);

      await approvals.resolveApprovalGate(false);
      expect(onReject).toHaveBeenCalled();
      expect(onApprove).not.toHaveBeenCalled();
    });

    test('resolveApprovalGate gracefully ignores empty queue', async () => {
      const ui = approvals.getUiState();
      ui._isResolvingApproval = false;
      ui.pendingApprovalQueue = [];
      await approvals.resolveApprovalGate(true);
      expect(ui._isResolvingApproval).toBe(false);
    });

    test('resolveApprovalGate unshifts and updates DOM when orchestrator is busy during approval execution', async () => {
      const item = {
        id: 'busy_test_item',
        action: 'write_file',
        reason: 'Writing file to disk',
        onApprove: jest.fn()
      };

      const mockTextEl = { innerText: '' };
      const mockBannerEl = { classList: { remove: jest.fn(), add: jest.fn() } };
      global.document = {
        getElementById: jest.fn(id => {
          if (id === 'approvalGateText') return mockTextEl;
          if (id === 'approvalGateBanner') return mockBannerEl;
          return null;
        })
      };

      const ui = approvals.getUiState();
      ui._isResolvingApproval = false;
      let checkCount = 0;
      Object.defineProperty(ui, 'isOrchestratorRunning', {
        get: () => {
          checkCount++;
          return checkCount >= 2;
        },
        configurable: true
      });

      try {
        approvals.triggerApprovalGate(item.reason, item.onApprove);
        await approvals.resolveApprovalGate(true);
        expect(ui.pendingApprovalQueue.length).toBeGreaterThan(0);
      } finally {
        delete ui.isOrchestratorRunning;
        delete global.document;
      }
    });

    test('triggerApprovalGate with various reason shapes', () => {
      const ui = approvals.getUiState();
      ui.pendingApprovalQueue = [];

      approvals.triggerApprovalGate('simple text reason');
      expect(ui.pendingApprovalQueue.length).toBe(1);
      expect(ui.pendingApprovalQueue[0].reason).toBe('simple text reason');

      approvals.triggerApprovalGate({ message: 'msg reason', target: 'action1' });
      expect(ui.pendingApprovalQueue.length).toBe(2);
      expect(ui.pendingApprovalQueue[1].action).toBe('action1');
    });
  });

  describe('4. Persistence Module Utility Coverage', () => {
    test('toTimestampMs handles numbers, strings, and fallbacks', () => {
      const now = Date.now();
      expect(persistence.toTimestampMs(now)).toBe(now);
      expect(persistence.toTimestampMs('2026-01-01T00:00:00.000Z')).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
      expect(persistence.toTimestampMs('invalid-date')).toBe(0);
      expect(persistence.toTimestampMs(null)).toBe(0);
    });

    test('nexusStorageRemove deletes key safely', () => {
      const store = {
        removeItem: jest.fn()
      };
      expect(persistence.nexusStorageRemove('test_key', store)).toBe(true);
      expect(store.removeItem).toHaveBeenCalledWith('test_key');
    });

    test('mergeArrayById merges arrays preserving unique items and updates', () => {
      const existing = [{ id: '1', v: 'old', version: 1 }, { id: '2', v: 'keep', version: 1 }];
      const incoming = [{ id: '1', v: 'new', version: 2 }, { id: '3', v: 'added', version: 1 }];
      const merged = persistence.mergeArrayById('customField', existing, incoming);
      expect(merged).toHaveLength(3);
      expect(merged.find(x => x.id === '1').v).toBe('new');
      expect(merged.find(x => x.id === '2').v).toBe('keep');
      expect(merged.find(x => x.id === '3').v).toBe('added');
    });

    test('sanitizeLoadedState fallback generators when global utilities are missing', () => {
      const origSecRandomId = globalThis.secureRandomId;
      const origGenUniqueId = globalThis.generateUniqueId;
      const origSanitizeAvatar = globalThis.sanitizeAvatarSpec;

      delete globalThis.secureRandomId;
      delete globalThis.generateUniqueId;
      delete globalThis.sanitizeAvatarSpec;

      try {
        const state = persistence.sanitizeLoadedState({
          profiles: [{ id: 'p1', name: 'Test' }]
        });
        expect(state).toBeDefined();
        expect(state.profileName).toBe('Ali');
      } finally {
        if (origSecRandomId) globalThis.secureRandomId = origSecRandomId;
        if (origGenUniqueId) globalThis.generateUniqueId = origGenUniqueId;
        if (origSanitizeAvatar) globalThis.sanitizeAvatarSpec = origSanitizeAvatar;
      }
    });
  });

  describe('5. Provider Registry Edge Coverage', () => {
    test('validateProviderScope handles invalid granted scopes and case normalization', () => {
      expect(registry.validateProviderScope('gmail', 'send', ['https://www.googleapis.com/auth/userinfo.email'])).toBe(false);
      expect(registry.validateProviderScope('GMAIL', 'SEND', ['https://www.googleapis.com/auth/gmail.send'])).toBe(true);
      expect(registry.isSensitiveProviderAction('GOOGLE', 'DRIVE_DELETE')).toBe(true);
      expect(registry.isSensitiveProviderAction('TELEGRAM', 'SEND_MESSAGE')).toBe(true);
      expect(registry.isSensitiveProviderAction('TELEGRAM', 'GET_ME')).toBe(false);
    });

    test('Provider registry tier badges and configuration fallbacks', () => {
      expect(registry.getProviderTierBadge('production-ready')).toContain('Production-ready');
      expect(registry.getProviderTierBadge('contract-tested')).toContain('Contract-tested');
      expect(registry.getProviderTierBadge('beta')).toContain('Beta');
      expect(registry.getProviderTierBadge('catalog-only')).toContain('Catalog-only');
      expect(registry.getProviderTierBadge('unknown')).toContain('Catalog-only');

      expect(registry.getProviderConfig(null)).toBeNull();
      expect(registry.getProviderConfig('')).toBeNull();

      expect(registry.getProviderTier('gmail')).toBe(registry.PROVIDER_TIERS.PRODUCTION_READY);
      expect(registry.getProviderTier('telegram')).toBe(registry.PROVIDER_TIERS.CONTRACT_TESTED);
      expect(registry.getProviderTier('instagram')).toBe(registry.PROVIDER_TIERS.BETA);
      expect(registry.getProviderTier('unknown_app_xyz')).toBe(registry.PROVIDER_TIERS.CATALOG_ONLY);
      expect(registry.getProviderTier(null)).toBe(registry.PROVIDER_TIERS.CATALOG_ONLY);
    });

    test('MCP contract formatting and parsing functions', () => {
      expect(registry.isMcpServerEnabled('github', null)).toBe(false);
      expect(registry.isMcpServerEnabled('github', { github: { mcpEnabled: false } })).toBe(false);
      expect(registry.isMcpServerEnabled('github', { github: { mcpEnabled: true } })).toBe(true);

      const formatted = registry.formatMcpToolCall('srv1', 'toolA', { foo: 'bar' });
      expect(formatted.jsonrpc).toBe('2.0');
      expect(formatted.params.server).toBe('srv1');
      expect(formatted.params.name).toBe('toolA');
      expect(formatted.params.arguments.foo).toBe('bar');

      const formattedStr = registry.formatMcpToolCall('srv1', 'toolB', '{"num": 42}');
      expect(formattedStr.params.arguments.num).toBe(42);

      expect(() => registry.formatMcpToolCall('srv', 'tool', '{invalid')).toThrow(/Malformed JSON/i);
      expect(() => registry.formatMcpToolCall('srv', 'tool', [1, 2])).toThrow(/valid JSON object/i);

      const directObj = registry.parseMcpToolCall({ valid: true });
      expect(directObj.valid).toBe(true);

      const parsedStr = registry.parseMcpToolCall(JSON.stringify({ method: 'test' }));
      expect(parsedStr.method).toBe('test');

      expect(() => registry.parseMcpToolCall(null)).toThrow(/expected string or object/i);
      expect(() => registry.parseMcpToolCall([1, 2])).toThrow(/expected string or object/i);
      expect(() => registry.parseMcpToolCall('not-valid-json{')).toThrow(/Malformed JSON/i);
      expect(() => registry.parseMcpToolCall('"primitive-string"')).toThrow(/root must be an object/i);
    });
  });
});
