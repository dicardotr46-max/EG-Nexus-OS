/**
 * EG-Nexus-OS v5.7.0 — Subagent 1: Architecture, State Management & Global Pollution Tests
 */

const stateModule = require('../src/core/state.js');
const approvalsModule = require('../src/security/approvals.js');
const persistenceModule = require('../src/core/persistence.js');
const sanitizationModule = require('../src/core/sanitization.js');
const secretsModule = require('../src/security/secrets.js');
const providersModule = require('../src/providers/registry.js');

describe('Subagent 1: Architecture & State Management (v5.7.0)', () => {

  describe('1. Global Namespace Pollution & Non-Enumerable Registration', () => {
    test('syncNexusCore does not pollute Object.keys(mockWindow) with module exports', () => {
      const mockWindow = {};
      const origWindow = global.window;
      global.window = mockWindow;

      try {
        jest.isolateModules(() => {
          require('../src/core/sanitization.js');
          require('../src/security/secrets.js');
          require('../src/security/approvals.js');
          require('../src/core/state.js');
          require('../src/core/persistence.js');
          require('../src/providers/registry.js');

          const keys = Object.keys(mockWindow);
          // Only explicit namespace objects (like NexusCore) should be enumerable if any,
          // none of the 50+ individual functions should be enumerable in Object.keys(window).
          expect(keys).not.toContain('escapeHtml');
          expect(keys).not.toContain('sanitizeSafeUrl');
          expect(keys).not.toContain('createInitialAppState');
          expect(keys).not.toContain('createProtectedStateProxy');
          expect(keys).not.toContain('nexusStorageGet');
          expect(keys).not.toContain('triggerApprovalGate');
          expect(keys).not.toContain('resolveApprovalGate');
          expect(keys).not.toContain('buildPersistedState');

          // Direct property access must remain 100% functional
          expect(typeof mockWindow.escapeHtml).toBe('function');
          expect(typeof mockWindow.createInitialAppState).toBe('function');
          expect(typeof mockWindow.nexusStorageGet).toBe('function');
          expect(typeof mockWindow.triggerApprovalGate).toBe('function');
          expect(mockWindow.appState).toBeDefined();
          expect(mockWindow.uiState).toBeDefined();

          // NexusCore unified registry is intact
          expect(mockWindow.NexusCore).toBeDefined();
          expect(typeof mockWindow.NexusCore.escapeHtml).toBe('function');
          expect(mockWindow.NexusCore.STORAGE_KEYS).toBeDefined();
          expect(mockWindow.NexusCore.STORAGE_KEYS.current).toBe('eg_nexus_os_v5_master_state');
        });
      } finally {
        if (origWindow !== undefined) {
          global.window = origWindow;
        } else {
          delete global.window;
        }
      }
    });

    test('STORAGE_KEYS is defined once in state.js and shared via NexusCore', () => {
      expect(stateModule.STORAGE_KEYS).toBeDefined();
      expect(stateModule.STORAGE_KEYS.current).toBe('eg_nexus_os_v5_master_state');
      expect(stateModule.STORAGE_KEYS.legacy).toBe('eg_nexus_os_state_v5.1');
      expect(Object.isFrozen(stateModule.STORAGE_KEYS)).toBe(true);
    });
  });

  describe('2. Protected State Proxy (State Poisoning Guard)', () => {
    test('blocks prototype pollution vectors on appState and uiState', () => {
      const { createProtectedStateProxy, appState, uiState } = stateModule;
      expect(typeof createProtectedStateProxy).toBe('function');

      // Test root proxy protection (v5.8: safely neutralized without crashing strict mode)
      appState['__proto__'] = { polluted: true };
      appState.constructor = function() {};
      appState.prototype = {};
      expect(({}).polluted).toBeUndefined();

      expect(() => {
        'use strict';
        Object.setPrototypeOf(appState, {});
      }).toThrow();

      Object.defineProperty(appState, '__proto__', { value: {} });
      delete appState['__proto__'];
      expect(({}).polluted).toBeUndefined();
    });

    test('blocks nested state poisoning recursively', () => {
      const { appState } = stateModule;
      appState.apiKeys['__proto__'] = { evil: true };
      appState.browserConfig.constructor = {};
      expect(({}).evil).toBeUndefined();
    });

    test('blocks assigning objects containing dangerous own properties', () => {
      const { appState } = stateModule;
      const evilObj = Object.create(null);
      Object.defineProperty(evilObj, 'constructor', { value: 'bad', enumerable: true });
      appState.someProp = evilObj;
      expect(appState.someProp).toBeUndefined();
    });

    test('maintains reference equality for nested proxies via WeakMap cache', () => {
      const { appState } = stateModule;
      expect(appState.browserConfig).toBe(appState.browserConfig);
      expect(appState.apiKeys).toBe(appState.apiKeys);
      expect(appState.cloudConfig).toBe(appState.cloudConfig);
    });

    test('allows legitimate state mutations and retains JSON serializability', () => {
      const { createProtectedStateProxy } = stateModule;
      const state = createProtectedStateProxy({
        profileName: 'Ali',
        chats: [],
        apiKeys: { gemini: '' }
      });

      state.profileName = 'Ali Reza';
      state.chats.push({ id: 'chat_new', title: 'New Chat' });
      state.apiKeys.gemini = 'TEST_DUMMY_KEY_NOT_A_SECRET_01';

      expect(state.profileName).toBe('Ali Reza');
      expect(state.chats).toHaveLength(1);
      expect(state.chats[0].title).toBe('New Chat');
      expect(state.apiKeys.gemini).toBe('TEST_DUMMY_KEY_NOT_A_SECRET_01');

      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);
      expect(parsed.profileName).toBe('Ali Reza');
      expect(parsed.chats[0].id).toBe('chat_new');
    });
  });

  describe('3. Async Approval Gate & Exception Handling', () => {
    test('supports async onApprove callbacks and keeps lock until promise settles', async () => {
      let resolvedOrder = [];
      let resolveAsyncOp;
      const asyncOp = new Promise(resolve => { resolveAsyncOp = resolve; });

      approvalsModule.triggerApprovalGate('Async task authorization', async () => {
        resolvedOrder.push('started');
        await asyncOp;
        resolvedOrder.push('completed');
      });

      const gatePromise = approvalsModule.resolveApprovalGate(true);
      const ui = approvalsModule.getUiState();

      // Immediately after triggering, lock is engaged and task has started
      expect(ui._isResolvingApproval).toBe(true);
      expect(resolvedOrder).toEqual(['started']);

      // Attempting concurrent call while async operation is pending should be rejected
      approvalsModule.resolveApprovalGate(true);
      expect(ui._isResolvingApproval).toBe(true);

      // Finish the async operation
      resolveAsyncOp();
      await gatePromise;

      expect(resolvedOrder).toEqual(['started', 'completed']);
    });

    test('catches errors inside onApprove and safely unlocks via finally', async () => {
      jest.useFakeTimers();
      try {
        const ui = approvalsModule.getUiState();
        ui._isResolvingApproval = false;

        approvalsModule.triggerApprovalGate('Failing action', () => {
          throw new Error('Approval callback blew up!');
        });

        // Calling resolveApprovalGate should not crash the host application
        await approvalsModule.resolveApprovalGate(true);

        expect(ui._isResolvingApproval).toBe(true);

        // Advance debounce window
        jest.advanceTimersByTime(350);
        expect(ui._isResolvingApproval).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    test('supports onReject callback when action is rejected', async () => {
      let rejectedCalled = false;
      approvalsModule.triggerApprovalGate('Sensitive delete', () => {}, () => {
        rejectedCalled = true;
      });

      await approvalsModule.resolveApprovalGate(false);
      expect(rejectedCalled).toBe(true);
    });
  });
});
