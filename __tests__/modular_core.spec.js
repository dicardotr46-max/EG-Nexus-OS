/**
 * EG-Nexus-OS — Modular Core, Security & Persistence Unit Suite
 * Tests sanitization, state, persistence, approvals, and secrets thoroughly
 */

const sanitization = require('../src/core/sanitization.js');
const state = require('../src/core/state.js');
const persistence = require('../src/core/persistence.js');
const secrets = require('../src/security/secrets.js');
const approvals = require('../src/security/approvals.js');
const registry = require('../src/providers/registry.js');

describe('Modular Core Architecture & Security', () => {
  // =========================================================================
  // Core Sanitization Module
  // =========================================================================
  describe('sanitization module', () => {
    test('escapeHtml handles all characters, edge cases, and non-strings', () => {
      expect(sanitization.escapeHtml('<script>alert("xss")&</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&amp;&lt;/script&gt;');
      expect(sanitization.escapeHtml("It's a 'quote'")).toBe('It&#39;s a &#39;quote&#39;');
      expect(sanitization.escapeHtml(null)).toBe('');
      expect(sanitization.escapeHtml(undefined)).toBe('');
      expect(sanitization.escapeHtml(123)).toBe('123');
      expect(sanitization.escapeHtml(0)).toBe('0');
      expect(sanitization.escapeHtml(false)).toBe('false');
    });

    test('sanitizeSafeUrl filters unsafe protocols and permits safe URLs', () => {
      expect(sanitization.sanitizeSafeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('data:text/html;base64,...')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('vbscript:msgbox(1)')).toBe('#');
      expect(sanitization.sanitizeSafeUrl('https://nexus.org')).toBe('https://nexus.org');
      expect(sanitization.sanitizeSafeUrl('http://127.0.0.1:8765')).toBe('http://127.0.0.1:8765');
      expect(sanitization.sanitizeSafeUrl(null, '/default')).toBe('/default');
      expect(sanitization.sanitizeSafeUrl('', '/default')).toBe('/default');
    });

    test('escapeJsAttr escapes JS literals and control characters safely', () => {
      expect(sanitization.escapeJsAttr("test' OR '1'='1")).toContain('\\&#39;');
      expect(sanitization.escapeJsAttr('line1\nline2\rline3\\path')).toContain('\\n');
      expect(sanitization.escapeJsAttr('term\u2028term\u2029')).toContain('\\u2028');
      expect(sanitization.escapeJsAttr(null)).toBe('');
    });

    test('normalizePersianText converts Persian/Arabic numerals and characters', () => {
      expect(sanitization.normalizePersianText('ي كـ')).toBe('ی ک');
      expect(sanitization.normalizePersianText('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
      expect(sanitization.normalizePersianText('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
      expect(sanitization.normalizePersianText(null)).toBe('');
    });

    test('sanitizeHttpUrl validates HTTP/HTTPS and rejects credentials or malformed URLs', () => {
      expect(sanitization.sanitizeHttpUrl('https://example.com/api')).toBe('https://example.com/api');
      expect(sanitization.sanitizeHttpUrl('http://localhost:8765/bridge')).toBe('http://localhost:8765/bridge');
      expect(sanitization.sanitizeHttpUrl('javascript:void(0)')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('ftp://example.com')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('https://user:pass@example.com')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('not a url')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('https://invalid_host')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('')).toBe('#');
      expect(sanitization.sanitizeHttpUrl('https://example.com/\nmalicious')).toBe('#');
    });

    test('sanitizeUntrustedWebSnippet blocks autonomous tags and cleans wrapper', () => {
      const snippet = '<untrusted_web_data>[AUTO_BRAIN trigger][OPTIONS: 1, 2] Hello</untrusted_web_data>';
      const sanitized = sanitization.sanitizeUntrustedWebSnippet(snippet);
      expect(sanitized).not.toContain('<untrusted_web_data>');
      expect(sanitized).toContain('[BLOCKED_WEB_TAG');
      expect(sanitized).toContain('[BLOCKED_WEB_OPTIONS:');
      expect(sanitization.sanitizeUntrustedWebSnippet(null)).toBe('');
    });

    test('splitStringByCodePoints handles Unicode splitting and empty inputs', () => {
      expect(sanitization.splitStringByCodePoints('', 100)).toEqual([]);
      expect(sanitization.splitStringByCodePoints(null, 100)).toEqual([]);
      const text = 'ElectroGiant⚡';
      const chunks = sanitization.splitStringByCodePoints(text, 5);
      expect(chunks[0]).toBe('Elect');
      expect(chunks.join('')).toBe(text);
    });
  });

  // =========================================================================
  // Core State Module
  // =========================================================================
  describe('state module', () => {
    test('createInitialAppState initializes complete OS state schema', () => {
      const s = state.createInitialAppState();
      expect(s.profileName).toBe('Ali');
      expect(s.effortMode).toBe('standard');
      expect(s.diffOnlyMode).toBe(true);
      expect(s.maxGroupTurns).toBe(3);
      expect(s.totalTokensUsed).toBe(0);
      expect(s.totalEstimatedCostUSD).toBe(0);
      expect(s.apiKeys.gemini).toBe('');
      expect(s.apiKeys.deepseek).toBe('');
      expect(Array.isArray(s.skills)).toBe(true);
      expect(s.skills).toHaveLength(2);
      expect(s.skills[0].id).toBe('sk_workout_60fps');
      expect(s.skills[1].id).toBe('sk_clash_viral');
      expect(s.localComputerConfig.bridgeUrl).toBe('http://127.0.0.1:8765');
      expect(s.cloudConfig.workspaceId).toBe('default');
      expect(s.studioCode).toContain('پیش‌نمایش زنده اپ ورزشی');
    });

    test('createInitialUiState initializes full UI state schema', () => {
      const ui = state.createInitialUiState();
      expect(ui.avatarPickerState.color).toBe('#1d8cf8');
      expect(ui.stopOrchestrationFlag).toBe(false);
      expect(Array.isArray(ui.pendingApprovalQueue)).toBe(true);
      expect(ui.activeAppsViewMode).toBe('catalog');
      expect(ui.activeViewHistoryStack).toEqual(['view-home']);
    });

    test('default module instances are exported and accessible', () => {
      expect(state.appState).toBeDefined();
      expect(state.uiState).toBeDefined();
      expect(typeof state.DEFAULT_WORKOUT_STUDIO_TEMPLATE).toBe('string');
    });
  });

  // =========================================================================
  // Core Persistence Module
  // =========================================================================
  describe('persistence module', () => {
    let mockStorage;
    let storeData;

    beforeEach(() => {
      storeData = {};
      mockStorage = {
        getItem: jest.fn(k => (k in storeData ? storeData[k] : null)),
        setItem: jest.fn((k, v) => { storeData[k] = String(v); }),
        removeItem: jest.fn(k => { delete storeData[k]; })
      };
      global.localStorage = mockStorage;
      global.window = { localStorage: mockStorage };
    });

    afterEach(() => {
      delete global.localStorage;
      delete global.window;
    });

    test('nexusStorageGet, nexusStorageSet, and nexusStorageRemove interface with storage', () => {
      expect(persistence.nexusStorageSet('test_key', 'test_value')).toBe(true);
      expect(persistence.nexusStorageGet('test_key')).toBe('test_value');
      expect(persistence.nexusStorageRemove('test_key')).toBe(true);
      expect(persistence.nexusStorageGet('test_key')).toBeNull();
    });

    test('nexusStorage handles storage exceptions gracefully without crashing', () => {
      const faultyStorage = {
        getItem: () => { throw new Error('Storage disabled'); },
        setItem: () => { throw new Error('Storage quota'); },
        removeItem: () => { throw new Error('Storage error'); }
      };
      global.localStorage = faultyStorage;
      global.window = { localStorage: faultyStorage };

      expect(persistence.nexusStorageGet('k')).toBeNull();
      expect(persistence.nexusStorageSet('k', 'v')).toBe(false);
      expect(persistence.nexusStorageRemove('k')).toBe(false);
    });

    test('getStorageSizeEstimate measures persisted string byte size', () => {
      persistence.nexusStorageSet(persistence.STORAGE_KEY, '{"test":"payload"}');
      const size = persistence.getStorageSizeEstimate(persistence.STORAGE_KEY);
      expect(size).toBeGreaterThan(0);
      expect(persistence.getStorageSizeEstimate('missing_key')).toBe(0);
    });

    test('buildPersistedState strips sensitive tokens from connections, accounts, and cloud config', () => {
      const testState = state.createInitialAppState();
      testState.apiKeys.gemini = 'secret-1';
      testState.apiKeys.deepseek = 'secret-2';
      testState.appConnections = {
        github: {
          token: 'ghp_secret',
          accounts: [{ id: 'acc_1', token: 'tok_1', refreshToken: 'ref_1' }]
        }
      };
      testState.localComputerConfig.bridgeToken = 'bridge-secret';
      testState.cloudConfig.workerSecret = 'worker-sec';
      testState.cloudConfig.supabaseKey = 'supa-key';
      testState.cloudConfig.supabaseAuthToken = 'supa-auth';
      testState.telegramConfig.botToken = 'tg-token';

      // Attach oversized chats history
      testState.chats = [
        {
          id: 'chat_1',
          messages: Array(350).fill(0).map((_, i) => ({ id: `m_${i}`, text: `message ${i}` }))
        }
      ];

      const persisted = persistence.buildPersistedState(testState);

      expect(persisted.apiKeys.gemini).toBe('');
      expect(persisted.apiKeys.deepseek).toBe('');
      expect(persisted.appConnections.github.token).toBe('');
      expect(persisted.appConnections.github.accounts[0].token).toBe('');
      expect(persisted.appConnections.github.accounts[0].refreshToken).toBe('');
      expect(persisted.localComputerConfig.bridgeToken).toBe('');
      expect(persisted.cloudConfig.workerSecret).toBe('');
      expect(persisted.cloudConfig.supabaseKey).toBe('');
      expect(persisted.cloudConfig.supabaseAuthToken).toBe('');
      expect(persisted.telegramConfig.botToken).toBe('');

      // Verify chat trimming to 300 messages
      expect(persisted.chats[0].messages).toHaveLength(300);
      expect(persisted.chats[0].messages[299].id).toBe('m_349');
    });

    test('buildPersistedState returns empty object for invalid inputs', () => {
      expect(persistence.buildPersistedState(null)).toEqual({});
      expect(persistence.buildPersistedState(undefined)).toEqual({});
      expect(persistence.buildPersistedState('string')).toEqual({});
    });

    test('sanitizeLoadedState handles dirty, missing, and corrupted state payloads', () => {
      const sanitizedDefault = persistence.sanitizeLoadedState(null);
      expect(sanitizedDefault.profileName).toBe('Ali');
      expect(sanitizedDefault.effortMode).toBe('standard');
      expect(sanitizedDefault.maxGroupTurns).toBe(3);
      expect(sanitizedDefault.totalTokensUsed).toBe(0);

      const dirtyState = {
        profileName: '  Ali Reza  ',
        effortMode: 'ultra',
        maxGroupTurns: 99, // clamp to 6
        totalTokensUsed: -50, // clamp to 0
        totalEstimatedCostUSD: 1.25,
        apiKeys: { gemini: '  key-123  ' },
        appConnections: {
          valid_app: {
            token: '  token_abc  ',
            mcpEnabled: true,
            accounts: [{ email: 'user@example.com', name: 'User' }, 'string_acc']
          },
          '__proto__': { malicious: true }
        },
        agentsCatalog: [
          { name: 'Custom Agent', model: 'kimi-k3', avatar: { mode: 'edit', color: '#ff0000' } }
        ],
        chats: [
          {
            title: 'My Chat',
            messages: [{ text: 'Hello', senderType: 'user' }]
          }
        ],
        skills: [{ title: 'Workout 60FPS', desc: 'Desc' }],
        activeChatId: 'non_existent_chat',
        activeAgentProfileId: 'non_existent_agent'
      };

      const cleaned = persistence.sanitizeLoadedState(dirtyState);
      expect(cleaned.profileName).toBe('Ali Reza');
      expect(cleaned.effortMode).toBe('ultra');
      expect(cleaned.maxGroupTurns).toBe(6);
      expect(cleaned.totalTokensUsed).toBe(0);
      expect(cleaned.totalEstimatedCostUSD).toBe(1.25);
      expect(cleaned.apiKeys.gemini).toBe('key-123');
      expect(cleaned.appConnections.valid_app.token).toBe('token_abc');
      expect(cleaned.appConnections.valid_app.mcpEnabled).toBe(true);
      expect(cleaned.appConnections.valid_app.accounts[0].email).toBe('user@example.com');
      expect(Object.prototype.hasOwnProperty.call(cleaned.appConnections, '__proto__')).toBe(false);
      expect(cleaned.agentsCatalog[0].id).toBeDefined();
      expect(cleaned.chats[0].id).toBeDefined();
      expect(cleaned.activeChatId).toBeNull();
      expect(cleaned.activeAgentProfileId).toBeNull();
    });
  });

  // =========================================================================
  // Security Approvals Module
  // =========================================================================
  describe('approvals module', () => {
    let mockUiState;
    let mockToast;
    let mockElements;

    beforeEach(() => {
      mockUiState = { pendingApprovalQueue: [], _isResolvingApproval: false };
      mockToast = jest.fn();
      mockElements = {
        approvalGateText: { innerText: '' },
        approvalGateBanner: { classList: { add: jest.fn(), remove: jest.fn() } }
      };

      global.uiState = mockUiState;
      global.window = { uiState: mockUiState, showToast: mockToast };
      global.document = {
        getElementById: jest.fn(id => mockElements[id] || null)
      };
    });

    afterEach(() => {
      delete global.uiState;
      delete global.window;
      delete global.document;
    });

    test('triggerApprovalGate queues approval requests and updates DOM', () => {
      const onApprove = jest.fn();
      approvals.triggerApprovalGate('Delete database routine', onApprove);

      const ui = approvals.getUiState();
      expect(ui.pendingApprovalQueue).toHaveLength(1);
      expect(ui.pendingApprovalQueue[0].reason).toBe('Delete database routine');
      expect(ui.pendingApprovalQueue[0].onApprove).toBe(onApprove);
      expect(mockElements.approvalGateText.innerText).toBe('Delete database routine');
      expect(mockElements.approvalGateBanner.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('resolveApprovalGate(true) calls onApprove, updates DOM, and shifts queue item', () => {
      const onApprove = jest.fn();
      approvals.triggerApprovalGate('Execute shell script', onApprove);

      approvals.resolveApprovalGate(true);
      expect(onApprove).toHaveBeenCalledTimes(1);

      const ui = approvals.getUiState();
      expect(ui.pendingApprovalQueue).toHaveLength(0);
      expect(mockElements.approvalGateBanner.classList.add).toHaveBeenCalledWith('hidden');
    });

    test('resolveApprovalGate(false) shows rejection toast and skips onApprove', () => {
      const onApprove = jest.fn();
      approvals.triggerApprovalGate('Dangerous action', onApprove);

      approvals.resolveApprovalGate(false);
      expect(onApprove).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('لغو شد'));
    });

    test('resolveApprovalGate guards against rapid concurrent resolution clicks', () => {
      const onApprove = jest.fn();
      approvals.triggerApprovalGate('Single action', onApprove);

      approvals.resolveApprovalGate(true);
      // Immediate second call should be ignored while resolving
      approvals.resolveApprovalGate(true);

      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    test('resolveApprovalGate shows next queue item when multiple items are queued', () => {
      const approve1 = jest.fn();
      const approve2 = jest.fn();
      approvals.triggerApprovalGate('Action 1', approve1);
      approvals.triggerApprovalGate('Action 2', approve2);

      approvals.resolveApprovalGate(true);
      expect(approve1).toHaveBeenCalledTimes(1);
      expect(mockElements.approvalGateText.innerText).toBe('Action 2');
    });

    test('getUiState returns fallback state when window.uiState and globalThis.uiState are absent', () => {
      delete global.window.uiState;
      delete global.uiState;
      const fallback = approvals.getUiState();
      expect(fallback).toBeDefined();
      expect(Array.isArray(fallback.pendingApprovalQueue)).toBe(true);
    });

    test('setTimeout resets _isResolvingApproval flag after debounce window', () => {
      jest.useFakeTimers();
      try {
        const onApprove = jest.fn();
        approvals.triggerApprovalGate('Action', onApprove);
        approvals.resolveApprovalGate(true);
        expect(approvals.getUiState()._isResolvingApproval).toBe(true);
        jest.advanceTimersByTime(350);
        expect(approvals.getUiState()._isResolvingApproval).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    test('approvals handles null queue and missing showToast safely', () => {
      const ui = approvals.getUiState();
      ui.pendingApprovalQueue = null;
      approvals.triggerApprovalGate('No queue test', () => {});
      delete global.window.showToast;
      approvals.resolveApprovalGate(false);
    });
  });

  // =========================================================================
  // Security & Secrets Helpers & Edge Cases
  // =========================================================================
  describe('secrets module internal helpers & edge cases', () => {
    test('isSafeConnectionId validates connection identifiers and blocks prototype pollution', () => {
      expect(secrets.isSafeConnectionId('github')).toBe(true);
      expect(secrets.isSafeConnectionId('clash_royale')).toBe(true);
      expect(secrets.isSafeConnectionId('google-drive.v1')).toBe(true);

      expect(secrets.isSafeConnectionId('__proto__')).toBe(false);
      expect(secrets.isSafeConnectionId('constructor')).toBe(false);
      expect(secrets.isSafeConnectionId('prototype')).toBe(false);
      expect(secrets.isSafeConnectionId('bad;id<script>')).toBe(false);
      expect(secrets.isSafeConnectionId('')).toBe(false);
      expect(secrets.isSafeConnectionId(null)).toBe(false);
    });

    test('_uint8ToHex and _hexToUint8 handle invalid inputs gracefully', () => {
      expect(secrets._uint8ToHex(null)).toBe('');
      expect(secrets._uint8ToHex([1, 2, 3])).toBe('');
      expect(secrets._hexToUint8('')).toEqual(new Uint8Array(0));
      expect(secrets._hexToUint8(null)).toEqual(new Uint8Array(0));
      expect(secrets._hexToUint8('not_hex_!!')).toEqual(new Uint8Array(0));
      expect(secrets._hexToUint8('abc')).toEqual(new Uint8Array(0)); // odd length
    });

    test('applySessionSecrets handles undefined or null state gracefully', () => {
      expect(secrets.applySessionSecrets(null)).toBeNull();
      expect(secrets.applySessionSecrets(undefined)).toBeUndefined();
    });

    test('_initMemorySessionKey handles fallback when crypto.getRandomValues is unavailable', () => {
      secrets._resetSessionMemoryCache();
      const origCrypto = global.crypto;
      try {
        delete global.crypto;
        const key = secrets._initMemorySessionKey();
        expect(key).toBeInstanceOf(Uint8Array);
        expect(key).toHaveLength(32);
      } finally {
        global.crypto = origCrypto;
        secrets._resetSessionMemoryCache();
      }
    });
  });

  // =========================================================================
  // Providers Registry Usage & Model Routing
  // =========================================================================
  describe('providers registry model routing & cost tracking', () => {
    test('resolveProviderModelId routes all models accurately', () => {
      expect(registry.resolveProviderModelId('deepseek-flash', false)).toBe('deepseek-flash');
      expect(registry.resolveProviderModelId('deepseek-v4-pro', false)).toBe('deepseek-v4-pro');
      expect(registry.resolveProviderModelId('kimi-k3', false)).toBe('kimi-k3');
      expect(registry.resolveProviderModelId('kimi-k2.7-code', false)).toBe('kimi-k2.7-code');
      expect(registry.resolveProviderModelId('grok-4.7', false)).toBe('grok-4.7');
      expect(registry.resolveProviderModelId('unknown-model', false)).toBe('gemini-3.8-flash');

      // OpenRouter routed models
      expect(registry.resolveProviderModelId('deepseek-flash', true)).toBe('deepseek/deepseek-flash');
      expect(registry.resolveProviderModelId('deepseek-v4-pro', true)).toBe('deepseek/deepseek-v4-pro');
      expect(registry.resolveProviderModelId('kimi-k3', true)).toBe('moonshotai/kimi-k3');
      expect(registry.resolveProviderModelId('kimi', true)).toBe('moonshotai/kimi-k2.7-code');
      expect(registry.resolveProviderModelId('grok-4.7', true)).toBe('x-ai/grok-4.7');
      expect(registry.resolveProviderModelId('custom', true)).toBe('google/gemini-3.8-flash');
    });

    test('recordModelTokenAndCostUsage calculates token usage and updates state', () => {
      const mockState = { totalTokensUsed: 0, totalEstimatedCostUSD: 0 };
      global.appState = mockState;
      global.window = { appState: mockState };

      const res = registry.recordModelTokenAndCostUsage('deepseek-flash', 'Hello world prompt', 'Reply text here');
      expect(res.usedTokens).toBeGreaterThan(0);
      expect(mockState.totalTokensUsed).toBe(res.usedTokens);
      expect(mockState.totalEstimatedCostUSD).toBeGreaterThan(0);

      // Usage with explicit API usage object
      const explicitUsage = registry.recordModelTokenAndCostUsage('grok-4.7', '', '', { total_tokens: 5000 });
      expect(explicitUsage.usedTokens).toBe(5000);
      expect(mockState.totalTokensUsed).toBe(res.usedTokens + 5000);

      // Other model rate checks
      registry.recordModelTokenAndCostUsage('deepseek-v4-pro', 'a', 'b');
      registry.recordModelTokenAndCostUsage('kimi', 'a', 'b');
      registry.recordModelTokenAndCostUsage('gemini-3.8-flash', 'a', 'b');

      delete global.appState;
      delete global.window;
    });

    test('isAppGenuinelyConnected checks various connection scenarios', () => {
      const stateWithConns = {
        appConnections: {
          github: { owner: 'ali', repo: 'nexus' },
          clash_royale: { playerTag: '#999ROYALE' },
          gmail: { accounts: [{ id: 'acc_1' }] },
          telegram: { token: 'bot123:token' },
          tailscale: { mcpEnabled: true },
          disconnected_app: { token: '', accounts: [] }
        }
      };
      global.appState = stateWithConns;
      global.window = { appState: stateWithConns };

      expect(registry.isAppGenuinelyConnected('github')).toBe(true);
      expect(registry.isAppGenuinelyConnected('clash_royale')).toBe(true);
      expect(registry.isAppGenuinelyConnected('gmail')).toBe(true);
      expect(registry.isAppGenuinelyConnected('telegram')).toBe(true);
      expect(registry.isAppGenuinelyConnected('tailscale')).toBe(true);
      expect(registry.isAppGenuinelyConnected('disconnected_app')).toBe(false);
      expect(registry.isAppGenuinelyConnected('non_existent')).toBe(false);

      delete global.appState;
      delete global.window;
    });
  });
});
