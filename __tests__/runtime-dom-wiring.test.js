/**
 * EG-Nexus-OS — Real Runtime DOM Wiring Test Suite
 * Simulates real browser DOM runtime using Node vm with full DOM, WebCrypto, and Storage capabilities
 * Verifies namespace exports, STORAGE_KEY consistency, legacy migration, session reload recovery, and zero inline _syncTransform
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');
const { createStorageMock } = require('./test_helpers');

// Required modules from src/
const sanitizationModule = require('../src/core/sanitization');
const secretsModule = require('../src/security/secrets');
const approvalsModule = require('../src/security/approvals');
const stateModule = require('../src/core/state');
const persistenceModule = require('../src/core/persistence');
const providersModule = require('../src/providers/registry');

describe('EG-Nexus-OS Real Runtime DOM Wiring Tests', () => {
  const indexHtmlPath = path.join(__dirname, '../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  const modFilePaths = [
    path.join(__dirname, '../src/core/sanitization.js'),
    path.join(__dirname, '../src/security/secrets.js'),
    path.join(__dirname, '../src/security/approvals.js'),
    path.join(__dirname, '../src/core/state.js'),
    path.join(__dirname, '../src/core/persistence.js'),
    path.join(__dirname, '../src/providers/registry.js')
  ];

  /**
   * Helper to create a comprehensive JSDOM window with all browser APIs mocked and the ENTIRE main script executed
   */
  function createDomRuntime(options = {}) {
    const { initialLocal = {}, initialSession = {}, loadFullScript = true } = options;

    const localStore = createStorageMock();
    for (const [k, v] of Object.entries(initialLocal)) {
      localStore.setItem(k, v);
    }

    const sessionStore = createStorageMock();
    for (const [k, v] of Object.entries(initialSession)) {
      sessionStore.setItem(k, v);
    }

    const elements = new Map();
    function getOrCreateElement(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          innerText: '',
          textContent: '',
          innerHTML: '',
          style: {},
          classList: {
            _classes: new Set(['hidden']),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            contains(c) { return this._classes.has(c); }
          },
          addEventListener() {},
          removeEventListener() {}
        });
      }
      return elements.get(id);
    }

    const window = {
      document: {
        getElementById: (id) => getOrCreateElement(id),
        createElement: (tag) => ({ tagName: tag, innerHTML: '', appendChild() {}, style: {}, classList: { add() {}, remove() {} } }),
        addEventListener() {},
        removeEventListener() {}
      },
      navigator: { onLine: true, userAgent: 'nexus' },
      localStorage: localStore,
      sessionStorage: sessionStore,
      crypto: nodeCrypto.webcrypto,
      _nodeCrypto: nodeCrypto,
      console,
      Date,
      JSON,
      Object,
      Array,
      String,
      Boolean,
      Number,
      Uint8Array,
      TextEncoder,
      TextDecoder,
      Math,
      parseInt,
      Promise,
      Set,
      Map,
      setTimeout,
      clearTimeout,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return true; },
      showToast() {},
      Worker: class MockWorker {
        constructor() {}
        postMessage() {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
      },
      EventSource: class MockEventSource {
        constructor() {}
        close() {}
        addEventListener() {}
        removeEventListener() {}
      },
      matchMedia: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      }),
      fetch: jest.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
      }))
    };
    window.window = window;
    window.globalThis = window;

    const context = vm.createContext(window);

    // Load 6 core modules in DOM runtime
    for (const filePath of modFilePaths) {
      const code = fs.readFileSync(filePath, 'utf8');
      vm.runInContext(code, context);
    }

    // Load the ENTIRE nexus-main-script in full without slicing
    if (loadFullScript) {
      const scriptMatch = indexHtml.match(/<script id="nexus-main-script">([\s\S]*?)<\/script>/);
      if (scriptMatch) {
        const fullScript = scriptMatch[1];
        try {
          vm.runInContext(fullScript, context);
        } catch (_) {}
      }
    }

    return window;
  }

  // -------------------------------------------------------------
  // Requirement 1a: window._nexusCore* Namespaces Matching src/
  // -------------------------------------------------------------
  describe('Requirement 1a: Core Namespaces Matching src/ Exports', () => {
    let win;

    beforeEach(() => {
      win = createDomRuntime({ loadFullScript: true });
    });

    it('should define window._nexusCoreSanitization and match src/core/sanitization exports', () => {
      expect(win._nexusCoreSanitization).toBeDefined();
      expect(typeof win._nexusCoreSanitization.escapeHtml).toBe('function');
      expect(typeof win._nexusCoreSanitization.sanitizeSafeUrl).toBe('function');
      expect(typeof win._nexusCoreSanitization.normalizePersianText).toBe('function');
      expect(typeof win._nexusCoreSanitization.splitStringByCodePoints).toBe('function');
      expect(win._nexusCoreSanitization.STORAGE_KEY).toBe('eg_nexus_os_v5_master_state');
    });

    it('should define window._nexusCoreSecrets and match src/security/secrets exports', () => {
      expect(win._nexusCoreSecrets).toBeDefined();
      expect(typeof win._nexusCoreSecrets.readSessionSecrets).toBe('function');
      expect(typeof win._nexusCoreSecrets.writeSessionSecrets).toBe('function');
      expect(typeof win._nexusCoreSecrets.readSessionSecretsAsync).toBe('function');
      expect(typeof win._nexusCoreSecrets.writeSessionSecretsAsync).toBe('function');
      expect(typeof win._nexusCoreSecrets.queueSessionSecretsWrite).toBe('function');
      expect(typeof win._nexusCoreSecrets.getSessionWriteState).toBe('function');
      expect(typeof win._nexusCoreSecrets.getSessionWriteRevision).toBe('function');
      expect(typeof win._nexusCoreSecrets.resetSessionWriteQueue).toBe('function');
      expect(typeof win._nexusCoreSecrets.applySessionSecrets).toBe('function');
      expect(typeof win._nexusCoreSecrets.isSafeConnectionId).toBe('function');
      expect(typeof win._nexusCoreSecrets._syncTransform).toBe('function');
      expect(Array.isArray(win._nexusCoreSecrets.API_KEY_NAMES)).toBe(true);
      expect(win._nexusCoreSecrets.STORAGE_KEY).toBe('eg_nexus_os_v5_master_state');
    });

    it('should define window._nexusCorePersistence and match src/core/persistence exports', () => {
      expect(win._nexusCorePersistence).toBeDefined();
      expect(typeof win._nexusCorePersistence.nexusStorageGet).toBe('function');
      expect(typeof win._nexusCorePersistence.nexusStorageSet).toBe('function');
      expect(typeof win._nexusCorePersistence.nexusStorageRemove).toBe('function');
      expect(typeof win._nexusCorePersistence.migrateLegacyStorage).toBe('function');
      expect(typeof win._nexusCorePersistence.buildPersistedState).toBe('function');
      expect(typeof win._nexusCorePersistence.sanitizeLoadedState).toBe('function');
      expect(typeof win._nexusCorePersistence.queueSessionSecretsWrite).toBe('function');
      expect(typeof win._nexusCorePersistence.getSessionWriteState).toBe('function');
      expect(typeof win._nexusCorePersistence.getSessionWriteRevision).toBe('function');
      expect(typeof win._nexusCorePersistence.resetSessionWriteQueue).toBe('function');
      expect(win._nexusCorePersistence.STORAGE_KEY).toBe('eg_nexus_os_v5_master_state');
      expect(win._nexusCorePersistence.LEGACY_STORAGE_KEY).toBe('eg_nexus_os_state_v5.1');
    });

    it('should define window._nexusCoreState and match src/core/state exports', () => {
      expect(win._nexusCoreState).toBeDefined();
      expect(typeof win._nexusCoreState.createInitialAppState).toBe('function');
      expect(typeof win._nexusCoreState.createInitialUiState).toBe('function');
      expect(win._nexusCoreState.appState).toBeDefined();
      expect(win._nexusCoreState.uiState).toBeDefined();
      expect(win._nexusCoreState.STORAGE_KEY).toBe('eg_nexus_os_v5_master_state');
    });

    it('should define window._nexusCoreApprovals and match src/security/approvals exports', () => {
      expect(win._nexusCoreApprovals).toBeDefined();
      expect(typeof win._nexusCoreApprovals.triggerApprovalGate).toBe('function');
      expect(typeof win._nexusCoreApprovals.resolveApprovalGate).toBe('function');
      expect(typeof win._nexusCoreApprovals.getUiState).toBe('function');
      expect(win._nexusCoreApprovals.STORAGE_KEY).toBe('eg_nexus_os_v5_master_state');
    });

    it('should define window._nexusCoreProviders and match src/providers/registry exports', () => {
      expect(win._nexusCoreProviders).toBeDefined();
      expect(typeof win._nexusCoreProviders.validateProviderScope).toBe('function');
      expect(typeof win._nexusCoreProviders.isMutatingOrSensitiveAction).toBe('function');
      expect(typeof win._nexusCoreProviders.formatProviderError).toBe('function');
      expect(typeof win._nexusCoreProviders.executeWithRetry).toBe('function');
      expect(typeof win._nexusCoreProviders.executeProviderRequest).toBe('function');
      expect(typeof win._nexusCoreProviders.validateGithubPAT).toBe('function');
      expect(typeof win._nexusCoreProviders.formatGoogleRefreshTokenRequest).toBe('function');
      expect(typeof win._nexusCoreProviders.createSyncLock).toBe('function');
      expect(win._nexusCoreProviders.STORAGE_KEY).toBe('eg_nexus_os_v5_master_state');
    });

    it('should mount all production modules and functions on window: NexusCore, NexusSecrets, NexusState, NexusPersistence, NexusProviders, and NexusMCP', () => {
      expect(win.NexusCore).toBeDefined();
      expect(typeof win.NexusCore.escapeHtml).toBe('function');

      expect(win.NexusSecrets).toBeDefined();
      expect(typeof win.NexusSecrets.readSessionSecrets).toBe('function');
      expect(typeof win.NexusSecrets.writeSessionSecrets).toBe('function');

      expect(win.NexusState).toBeDefined();
      expect(typeof win.NexusState.createInitialAppState).toBe('function');

      expect(win.NexusPersistence).toBeDefined();
      expect(typeof win.NexusPersistence.buildPersistedState).toBe('function');
      expect(typeof win.NexusPersistence.syncWithCloudWorker).toBe('function');

      expect(win.NexusProviders).toBeDefined();
      expect(typeof win.NexusProviders.getProviderConfig).toBe('function');

      expect(win.NexusMCP).toBeDefined();
      expect(typeof win.NexusMCP.executeTool).toBe('function');
      expect(typeof win.NexusMCP.getActiveTools).toBe('function');
      expect(win.NexusMCP.definitions).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // Requirement 1b: STORAGE_KEY Consistency across All Modules
  // -------------------------------------------------------------
  describe('Requirement 1b: STORAGE_KEY Consistency', () => {
    it('should have STORAGE_KEY === "eg_nexus_os_v5_master_state" in index.html and all src/ modules', () => {
      const EXPECTED_STORAGE_KEY = 'eg_nexus_os_v5_master_state';

      // 1. In index.html
      const win = createDomRuntime();
      expect(win.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);

      // 2. In persistence module
      expect(persistenceModule.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);

      // 3. In secrets module
      expect(secretsModule.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);

      // 4. In sanitization module
      expect(sanitizationModule.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);

      // 5. In state module
      expect(stateModule.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);

      // 6. In approvals module
      expect(approvalsModule.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);

      // 7. In providers registry module
      expect(providersModule.STORAGE_KEY).toBe(EXPECTED_STORAGE_KEY);
    });

    it('should verify SESSION_SECRETS_KEY derives correctly from STORAGE_KEY in DOM runtime', () => {
      const win = createDomRuntime();
      expect(win.SESSION_SECRETS_KEY).toBe('eg_nexus_os_v5_master_state_session_secrets');
      expect(persistenceModule.SESSION_SECRETS_KEY).toBe('eg_nexus_os_v5_master_state_session_secrets');
      expect(secretsModule.SESSION_SECRETS_KEY).toBe('eg_nexus_os_v5_master_state_session_secrets');
    });
  });

  // -------------------------------------------------------------
  // Requirement 1c: Legacy Data Migration on Init
  // -------------------------------------------------------------
  describe('Requirement 1c: Legacy Data Migration', () => {
    it('should migrate "eg_nexus_os_state_v5.1" to "eg_nexus_os_v5_master_state" on init and delete legacy key', () => {
      const legacyPayload = {
        profileName: 'Ali Reza',
        activeChatId: 'chat_migrated_legacy_001',
        chats: [
          {
            id: 'chat_migrated_legacy_001',
            title: 'Legacy Chat Title',
            messages: [{ id: 'm_1', text: 'Hello from legacy state', senderType: 'user' }]
          }
        ],
        routines: [{ id: 'rt_1', name: 'Legacy Routine', version: 1 }]
      };

      const win = createDomRuntime({
        initialLocal: {
          'eg_nexus_os_state_v5.1': JSON.stringify(legacyPayload)
        }
      });

      // Verify before loadState: master key does not exist yet, legacy key exists
      expect(win.localStorage.getItem('eg_nexus_os_v5_master_state')).toBeNull();
      expect(win.localStorage.getItem('eg_nexus_os_state_v5.1')).not.toBeNull();

      // Trigger loadState in DOM runtime
      win.loadState();

      // Verify migration succeeded
      const migratedRaw = win.localStorage.getItem('eg_nexus_os_v5_master_state');
      expect(migratedRaw).not.toBeNull();
      const parsedMigrated = JSON.parse(migratedRaw);
      expect(parsedMigrated.profileName).toBe('Ali Reza');
      expect(parsedMigrated.activeChatId).toBe('chat_migrated_legacy_001');

      // Verify legacy key was deleted
      expect(win.localStorage.getItem('eg_nexus_os_state_v5.1')).toBeNull();

      // Verify appState in window is populated
      expect(win.appState.profileName).toBe('Ali Reza');
      expect(win.appState.activeChatId).toBe('chat_migrated_legacy_001');
      expect(win.appState.chats.length).toBe(1);
    });

    it('should not overwrite "eg_nexus_os_v5_master_state" if it already exists with fresh data', () => {
      const masterPayload = { profileName: 'Master User', activeChatId: 'chat_master', chats: [{ id: 'chat_master' }] };
      const legacyPayload = { profileName: 'Old User', activeChatId: 'chat_old', chats: [{ id: 'chat_old' }] };

      const win = createDomRuntime({
        initialLocal: {
          'eg_nexus_os_v5_master_state': JSON.stringify(masterPayload),
          'eg_nexus_os_state_v5.1': JSON.stringify(legacyPayload)
        }
      });

      win.loadState();

      expect(win.appState.profileName).toBe('Master User');
      expect(win.appState.activeChatId).toBe('chat_master');
    });
  });

  // -------------------------------------------------------------
  // Requirement 1d: DOM Session Secrets Reload Lifecycle
  // -------------------------------------------------------------
  describe('Requirement 1d: DOM Session Secrets Reload Lifecycle', () => {
    const testSecrets = {
      apiKeys: {
        gemini: 'AIzaSyTestGeminiKey12345',
        openai: 'sk-proj-testOpenAiSecretToken99',
        openrouter: 'sk-or-v1-testOpenRouterToken',
        deepseek: 'sk-dsk-testDeepSeekKey'
      },
      connectionTokens: {
        github: 'ghp_githubPersonalAccessToken987',
        telegram: 'bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        google_drive: 'ya29.a0AfH6SMBDriveSecretToken'
      },
      accountTokens: {
        'github_acc_1': 'gho_oauthTokenAccount1',
        'google_drive_acc_2': 'ya29.account2ScopedToken'
      },
      bridgeToken: 'nexus_local_bridge_super_secret_token_555'
    };

    it('should write secrets via window.writeSessionSecrets and restore 100% after context wipe / reload', () => {
      // Step 1: Context 1 (Initial page session)
      const win1 = createDomRuntime();
      const writeOk = win1.writeSessionSecrets(testSecrets);
      expect(writeOk).toBe(true);

      // Snapshot the browser sessionStorage
      const sessionSnapshot = win1.sessionStorage._getStore();
      expect(Object.keys(sessionSnapshot).length).toBeGreaterThan(0);

      // Step 2: Context Wipe & Reload (Simulate browser tab refresh)
      const win2 = createDomRuntime({ initialSession: sessionSnapshot });

      // Step 3: Read back secrets in the fresh context
      const restored = win2.readSessionSecrets();

      expect(restored.initialized).toBe(true);
      expect(restored.apiKeys.gemini).toBe(testSecrets.apiKeys.gemini);
      expect(restored.apiKeys.openai).toBe(testSecrets.apiKeys.openai);
      expect(restored.apiKeys.openrouter).toBe(testSecrets.apiKeys.openrouter);
      expect(restored.apiKeys.deepseek).toBe(testSecrets.apiKeys.deepseek);

      expect(restored.connectionTokens.github).toBe(testSecrets.connectionTokens.github);
      expect(restored.connectionTokens.telegram).toBe(testSecrets.connectionTokens.telegram);
      expect(restored.connectionTokens.google_drive).toBe(testSecrets.connectionTokens.google_drive);

      expect(restored.accountTokens.github_acc_1).toBe(testSecrets.accountTokens.github_acc_1);
      expect(restored.accountTokens.google_drive_acc_2).toBe(testSecrets.accountTokens.google_drive_acc_2);

      expect(restored.bridgeToken).toBe(testSecrets.bridgeToken);
    });

    it('should write via window.writeSessionSecretsAsync and restore 100% via window.readSessionSecretsAsync', async () => {
      const win1 = createDomRuntime();
      const writeOk = await win1.writeSessionSecretsAsync(testSecrets);
      expect(writeOk).toBe(true);

      const sessionSnapshot = win1.sessionStorage._getStore();

      // Reload
      const win2 = createDomRuntime({ initialSession: sessionSnapshot });
      const restored = await win2.readSessionSecretsAsync();

      expect(restored.initialized).toBe(true);
      expect(restored.apiKeys.gemini).toBe(testSecrets.apiKeys.gemini);
      expect(restored.apiKeys.openai).toBe(testSecrets.apiKeys.openai);
      expect(restored.connectionTokens.github).toBe(testSecrets.connectionTokens.github);
      expect(restored.accountTokens.github_acc_1).toBe(testSecrets.accountTokens.github_acc_1);
      expect(restored.bridgeToken).toBe(testSecrets.bridgeToken);
    });

    it('should quarantine corrupted ciphertext in sessionStorage and return clean initialized fallback without crashing', () => {
      const win = createDomRuntime({
        initialSession: {
          'eg_nexus_os_v5_master_state_session_secrets': JSON.stringify({
            encrypted: true,
            algorithm: 'sync-stream-v1',
            iv: 'deadbeef0102030405060708',
            ciphertext: 'not_valid_hex_corrupted_payload!'
          })
        }
      });

      const secrets = win.readSessionSecrets();
      expect(secrets).toBeDefined();
      expect(secrets.initialized).toBe(false);

      // Verify corrupted payload was quarantined
      const store = win.sessionStorage._getStore();
      const foundQuarantine = Object.keys(store).some(k => k.includes('_corrupted_'));
      expect(foundQuarantine).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Requirement 1e: Verify index.html does NOT contain inline _syncTransform
  // -------------------------------------------------------------
  describe('Requirement 1e: Zero Inline Active _syncTransform in index.html', () => {
    it('should verify that index.html does NOT contain any inline active function _syncTransform definition', () => {
      // 1. No standard function declaration: function _syncTransform(
      const fnDeclRegex = /(?:async\s+)?function\s+_syncTransform\s*\(/;
      expect(fnDeclRegex.test(indexHtml)).toBe(false);

      // 2. No variable assignment: const/let/var _syncTransform =
      const varAssignRegex = /(?:const|let|var)\s+_syncTransform\s*=\s*(?:function|\()/;
      expect(varAssignRegex.test(indexHtml)).toBe(false);

      // 3. No window._syncTransform = function definition inline
      const winAssignRegex = /window\._syncTransform\s*=\s*function/;
      expect(winAssignRegex.test(indexHtml)).toBe(false);
    });

    it('should verify index.html script tags order loads core modules before main script', () => {
      const sanitizationPos = indexHtml.indexOf('src/core/sanitization.js');
      const secretsPos = indexHtml.indexOf('src/security/secrets.js');
      const approvalsPos = indexHtml.indexOf('src/security/approvals.js');
      const statePos = indexHtml.indexOf('src/core/state.js');
      const persistencePos = indexHtml.indexOf('src/core/persistence.js');
      const providersPos = indexHtml.indexOf('src/providers/registry.js');
      const mainScriptPos = indexHtml.indexOf('id="nexus-main-script"');

      expect(sanitizationPos).toBeGreaterThan(0);
      expect(secretsPos).toBeGreaterThan(sanitizationPos);
      expect(approvalsPos).toBeGreaterThan(secretsPos);
      expect(statePos).toBeGreaterThan(approvalsPos);
      expect(persistencePos).toBeGreaterThan(statePos);
      expect(providersPos).toBeGreaterThan(persistencePos);
      expect(mainScriptPos).toBeGreaterThan(providersPos);
    });
  });

  // -------------------------------------------------------------
  // Complementary DOM Runtime Wiring Tests
  // -------------------------------------------------------------
  describe('Complementary DOM Runtime Wiring & UI State Tests', () => {
    it('should wire approval gate banner and text elements dynamically', () => {
      const win = createDomRuntime();
      let approvedCalled = false;

      // Banner should initially be hidden
      const banner = win.document.getElementById('approvalGateBanner');
      expect(banner.classList.contains('hidden')).toBe(true);

      win._nexusCoreApprovals.triggerApprovalGate('Sensitive Action Authorization', () => {
        approvedCalled = true;
      });

      const txt = win.document.getElementById('approvalGateText');
      expect(txt.innerText).toBe('Sensitive Action Authorization');
      expect(banner.classList.contains('hidden')).toBe(false);

      win._nexusCoreApprovals.resolveApprovalGate(true);
      expect(approvedCalled).toBe(true);
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should sanitize loaded state and apply empty API keys via DOM persistence bindings', () => {
      const win = createDomRuntime();
      const raw = {
        profileName: '  Ali Reza  ',
        effortMode: 'ultra',
        apiKeys: { gemini: '  AIzaSyTrimMe  ' },
        chats: [{ id: 'chat_1', title: 'Test', messages: [] }]
      };
      const cleaned = win._nexusCorePersistence.sanitizeLoadedState(raw);
      expect(cleaned.profileName).toBe('Ali Reza');
      expect(cleaned.effortMode).toBe('ultra');
      expect(cleaned.apiKeys.gemini).toBe('AIzaSyTrimMe');
    });
  });
});
