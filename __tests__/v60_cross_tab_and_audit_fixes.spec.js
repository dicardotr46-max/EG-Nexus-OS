/**
 * EG-Nexus-OS v6.0.0 Verification Suite
 * Tests AUD-DATA-01, AUD-SEC-01, AUD-SEC-02, AUD-SEC-03, AUD-SEC-04, AUD-SEC-13, AUD-SEC-16,
 * FND-01, FND-02, FND-03, FND-08, FND-09.
 */

const stateModule = require('../src/core/state.js');
const persistenceModule = require('../src/core/persistence.js');
const approvalsModule = require('../src/security/approvals.js');
const registryModule = require('../src/providers/registry.js');

describe('EG-Nexus-OS v6.0.0 Audit Hardening Suite', () => {

  describe('Requirement 1: Cross-Tab State Overwrite Fix (AUD-DATA-01)', () => {
    let mockStorage;

    beforeEach(() => {
      const store = {};
      mockStorage = {
        getItem: jest.fn(k => store[k] || null),
        setItem: jest.fn((k, v) => { store[k] = String(v); }),
        removeItem: jest.fn(k => { delete store[k]; })
      };
      persistenceModule.setTabBaselineSnapshot(null);
    });

    test('mergeMultiTabState delta-merges non-conflicting keys preserving Tab A and Tab B edits', () => {
      // Baseline state loaded by both tabs
      const baseline = {
        profileName: 'Ali',
        dreamMemory: 'Initial Dream Memory',
        studioCode: 'Initial Studio Code',
        effortMode: 'standard',
        stateRevision: 1,
        updatedAtTs: 1000,
        chats: [{ id: 'chat-1', title: 'Chat 1', updatedAtTs: 1000, messages: [] }]
      };

      // Tab A updates dreamMemory and saves to disk
      const tabAState = {
        ...baseline,
        dreamMemory: 'Tab A: 60FPS Android App Spec',
        stateRevision: 2,
        updatedAtTs: 1050
      };

      // Tab B concurrently updates studioCode
      const tabBState = {
        ...baseline,
        studioCode: 'Tab B: <script>console.log("Workout 60FPS");</script>',
        stateRevision: 1,
        updatedAtTs: 1060
      };

      // Tab B saves to disk where Tab A already saved tabAState:
      const mergeResult = persistenceModule.mergeMultiTabState(tabBState, tabAState, {
        baselineState: baseline
      });

      expect(mergeResult.conflictResolved).toBe(true);
      const merged = mergeResult.mergedState;

      // Both edits must be 100% preserved!
      expect(merged.dreamMemory).toBe('Tab A: 60FPS Android App Spec');
      expect(merged.studioCode).toBe('Tab B: <script>console.log("Workout 60FPS");</script>');
      expect(merged.profileName).toBe('Ali');
      expect(merged.stateRevision).toBeGreaterThanOrEqual(2);
    });

    test('PersistenceManager tracks baseline snapshot and delta-merges concurrent tab edits on saveState', async () => {
      const pm = new persistenceModule.PersistenceManager({
        storage: mockStorage,
        storageKey: 'test_master_state'
      });

      const initial = {
        profileName: 'Ali',
        dreamMemory: 'Initial Dream',
        studioCode: 'Initial Code',
        stateRevision: 1,
        updatedAtTs: 1000
      };

      mockStorage.setItem('test_master_state', JSON.stringify(initial));

      // Tab loads state
      const loaded = await pm.loadState();
      expect(loaded.profileName).toBe('Ali');
      const baseline = pm.getBaselineSnapshot();
      expect(baseline).toBeDefined();

      // Another tab writes to storage in the background:
      const tabAEdits = {
        ...initial,
        dreamMemory: 'Tab A Dream Modified',
        stateRevision: 2,
        updatedAtTs: 2000
      };
      mockStorage.setItem('test_master_state', JSON.stringify(tabAEdits));

      // Current tab edits studioCode and calls saveState
      const tabBState = {
        ...loaded,
        studioCode: 'Tab B Studio Code Modified'
      };

      const saveRes = await pm.saveState(tabBState);
      expect(saveRes.success).toBe(true);

      const diskSaved = JSON.parse(mockStorage.getItem('test_master_state'));
      expect(diskSaved.dreamMemory).toBe('Tab A Dream Modified');
      expect(diskSaved.studioCode).toBe('Tab B Studio Code Modified');
    });
  });

  describe('Requirement 2: Proxy Protection, clearSession, and Import (AUD-SEC-04, FND-01, FND-02)', () => {
    test('Proxy does not expose _rawTarget trap and external code cannot bypass proxy', () => {
      const targetObj = { safeProp: 'hello', secret: 'abc' };
      const proxy = stateModule.createProtectedStateProxy(targetObj);

      expect(proxy._isStateProxy).toBe(true);
      expect(proxy._rawTarget).toBeUndefined();

      // Mutation through proxy still works and is protected
      proxy.safeProp = 'world';
      expect(proxy.safeProp).toBe('world');

      // Dangerous prototype pollution blocked
      proxy.__proto__ = { evil: true };
      expect(Object.prototype.evil).toBeUndefined();
    });

    test('StateStore.prototype.clearSession resets all session fields', () => {
      const store = new stateModule.StateStore();
      const state = store.getState();

      state.messages = [{ id: 'm1', text: 'Hi' }];
      state.providerKeys = { github: 'token' };
      state.consensusResult = { approved: true };
      state.debateLog = ['debate 1'];
      state.memorySummary = 'some summary';
      state.pendingApprovals = [{ id: 'a1' }];

      store.clearSession();

      expect(state.messages).toEqual([]);
      expect(state.providerKeys).toEqual({});
      expect(state.consensusResult).toBeNull();
      expect(state.debateLog).toEqual([]);
      expect(state.memorySummary).toBe('');
      expect(state.pendingApprovals).toEqual([]);
    });

    test('appendMessage validates messages array and generates CSPRNG IDs', () => {
      const store = new stateModule.StateStore();
      const state = store.getState();
      state.messages = null; // simulate corrupted or non-array state

      const msg = store.appendMessage({ text: 'Hello AI' });
      expect(Array.isArray(state.messages)).toBe(true);
      expect(state.messages).toHaveLength(1);
      expect(msg.id).toBeDefined();
      expect(typeof msg.id).toBe('string');
      expect(msg.id.length).toBeGreaterThan(6);
      expect(msg.timestamp).toBeDefined();
    });

    test('standalone appendMessage function operates safely', () => {
      const mockState = { messages: 'not an array' };
      const msg = stateModule.appendMessage(mockState, { text: 'Standalone test' });
      expect(Array.isArray(mockState.messages)).toBe(true);
      expect(mockState.messages[0].text).toBe('Standalone test');
      expect(msg.id).toBeDefined();
    });
  });

  describe('Requirement 3: Full Approval Payload and Concurrency (AUD-SEC-01, AUD-SEC-02)', () => {
    let mockUiState;
    let mockDomElements;

    beforeEach(() => {
      mockDomElements = {
        approvalGateText: { innerText: '' },
        approvalGateBanner: {
          classList: {
            add: jest.fn(),
            remove: jest.fn()
          }
        }
      };
      global.document = {
        getElementById: jest.fn(id => mockDomElements[id] || null)
      };
      mockUiState = {
        pendingApprovalQueue: [],
        _isResolvingApproval: false,
        isOrchestratorRunning: false
      };
      global.window = {
        uiState: mockUiState,
        showToast: jest.fn()
      };
    });

    afterEach(() => {
      delete global.document;
      delete global.window;
    });

    test('triggerApprovalGate displays full immutable request text without truncation', () => {
      const longSensitivePrompt = 'Please format disk and DELETE ALL DATA permanently from production database';
      const onApprove = jest.fn();

      const item = approvalsModule.triggerApprovalGate({
        reason: longSensitivePrompt,
        action: 'rm_rf_prod',
        onApprove
      });

      expect(item).toBeDefined();
      expect(Object.isFrozen(item)).toBe(true);
      expect(item.reason).toBe(longSensitivePrompt);
      expect(item.id).toBeDefined();

      // UI text contains full reason without truncation
      expect(mockDomElements.approvalGateText.innerText).toContain('DELETE ALL DATA');
      expect(mockDomElements.approvalGateText.innerText).toContain('[rm_rf_prod]');
      expect(mockDomElements.approvalGateBanner.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('resolveApprovalGate does not drop 2nd item when orchestrator is busy', async () => {
      const approveFirst = jest.fn();
      const approveSecond = jest.fn();

      approvalsModule.triggerApprovalGate('First action: Git push', approveFirst);
      approvalsModule.triggerApprovalGate('Second action: Telegram broadcast', approveSecond);

      expect(mockUiState.pendingApprovalQueue).toHaveLength(2);

      // Simulate orchestrator becoming busy
      mockUiState.isOrchestratorRunning = true;

      // User tries to approve while orchestrator is busy
      await approvalsModule.resolveApprovalGate(true);

      // 2nd item must NOT be dropped!
      expect(mockUiState.pendingApprovalQueue).toHaveLength(2);
      expect(approveFirst).not.toHaveBeenCalled();
      expect(approveSecond).not.toHaveBeenCalled();

      // Now orchestrator finishes
      mockUiState.isOrchestratorRunning = false;

      // First resolves
      await approvalsModule.resolveApprovalGate(true);
      expect(approveFirst).toHaveBeenCalledTimes(1);
      expect(mockUiState.pendingApprovalQueue).toHaveLength(1);

      // Second resolves
      await approvalsModule.resolveApprovalGate(true);
      expect(approveSecond).toHaveBeenCalledTimes(1);
      expect(mockUiState.pendingApprovalQueue).toHaveLength(0);
    });
  });

  describe('Requirement 4: Registry Normalization, Retry Bounding, and Persistence (AUD-SEC-03, AUD-SEC-13, AUD-SEC-16, FND-03, FND-08, FND-09)', () => {
    test('Case-normalization for providerId and action in getRequiredScope, validateProviderScope, isSensitiveProviderAction', () => {
      expect(registryModule.getRequiredScope('GMAIL', 'SEND')).toBe('https://www.googleapis.com/auth/gmail.send');
      expect(registryModule.getRequiredScope('  gmail  ', '  send  ')).toBe('https://www.googleapis.com/auth/gmail.send');
      expect(registryModule.getRequiredScope('GITHUB', 'PUSH')).toBe('repo');

      expect(registryModule.isSensitiveProviderAction('GMAIL', 'SEND')).toBe(true);
      expect(registryModule.isSensitiveProviderAction('YOUTUBE', 'SHORTS_PUBLISH')).toBe(true);
      expect(registryModule.isSensitiveProviderAction('TERMUX', 'EXEC')).toBe(true);
      expect(registryModule.isSensitiveProviderAction('GITHUB', 'DELETE_REPO')).toBe(true);

      expect(registryModule.validateProviderScope('GMAIL', 'SEND', ['https://www.googleapis.com/auth/gmail.send'])).toBe(true);
      expect(registryModule.validateProviderScope('GMAIL', 'SEND', [])).toBe(false);
      expect(registryModule.validateProviderScope('GMAIL', 'SEND', '')).toBe(false);
    });

    test('executeProviderRequest fails closed with 404 on unknown provider and 403 on empty scope', async () => {
      const resUnknown = await registryModule.executeProviderRequest({
        providerId: 'NON_EXISTENT_UNKNOWN_PROVIDER_XYZ',
        action: 'some_action'
      });
      expect(resUnknown.status).toBe(404);
      expect(resUnknown.error).toBe('NOT_FOUND');

      const resEmptyScope = await registryModule.executeProviderRequest({
        providerId: 'GMAIL',
        action: 'SEND',
        token: 'valid_token',
        grantedScopes: [],
        approved: true
      });
      expect(resEmptyScope.status).toBe(403);
      expect(resEmptyScope.error).toBe('SCOPE_INSUFFICIENT');
    });

    test('executeWithRetry validates and bounds maxRetries within [0, 10]', async () => {
      let attempts = 0;
      const failingFn = jest.fn(async () => {
        attempts++;
        const err = new Error('Rate limit exceeded');
        err.status = 429;
        throw err;
      });

      // Pass excessive retries: 99 -> should be bounded to 10
      await expect(registryModule.executeWithRetry(failingFn, {
        maxRetries: 99,
        baseDelayMs: 1
      })).rejects.toThrow();

      // 1 initial attempt + 10 retries = 11 attempts total
      expect(attempts).toBe(11);
    });

    test('_withTimeout executes promise and unrefs timer', async () => {
      const fastPromise = Promise.resolve('fast-result');
      const res = await registryModule._withTimeout(fastPromise, 1000);
      expect(res).toBe('fast-result');

      const slowPromise = new Promise(resolve => setTimeout(resolve, 500));
      await expect(registryModule._withTimeout(slowPromise, 10)).rejects.toThrow(/timed out/);
    });

    test('migrateLegacyStorage verifies storage.setItem, sanitizes, and verifies read-back before remove', () => {
      // Storage without setItem fails
      expect(persistenceModule.migrateLegacyStorage({ getItem: jest.fn() })).toBe(false);

      // Faulty setItem that fails to write
      const failingWriteStore = {
        getItem: jest.fn(k => k === persistenceModule.LEGACY_STORAGE_KEY ? '{"migrated": true}' : null),
        setItem: jest.fn(),
        removeItem: jest.fn()
      };
      // When storage.setItem is a no-op, readBack fails so removeItem is not called
      expect(persistenceModule.migrateLegacyStorage(failingWriteStore)).toBe(false);
      expect(failingWriteStore.removeItem).not.toHaveBeenCalled();

      // Working storage correctly migrates and verifies read-back
      const validStoreData = { [persistenceModule.LEGACY_STORAGE_KEY]: '{"migrated": true}' };
      const validStore = {
        getItem: jest.fn(k => validStoreData[k] || null),
        setItem: jest.fn((k, v) => { validStoreData[k] = v; }),
        removeItem: jest.fn(k => { delete validStoreData[k]; })
      };
      expect(persistenceModule.migrateLegacyStorage(validStore)).toBe(true);
      expect(validStore.removeItem).toHaveBeenCalledWith(persistenceModule.LEGACY_STORAGE_KEY);
      expect(validStoreData[persistenceModule.STORAGE_KEY]).toBeDefined();
    });

    test('PersistenceManager._runSerialized auto-reopens and close() fully resets flags', async () => {
      const pm = new persistenceModule.PersistenceManager();
      pm.close();
      expect(pm._flags.isClosed).toBe(true);

      // Auto-reopens serialized queue on next task
      const result = await pm._runSerialized(async () => 'auto-reopened');
      expect(result).toBe('auto-reopened');
      expect(pm._flags.isClosed).toBe(false);

      pm.close();
      expect(pm._flags.isClosed).toBe(true);
      expect(pm._flags.isSaving).toBe(false);
      expect(pm._flags.isLoading).toBe(false);
      expect(pm._flags.isSyncing).toBe(false);
    });
  });
});
