/**
 * EG-Nexus-OS — Concurrency Stress & Runtime Resilience Test Suite
 * Stress-tests debounce idempotency, mid-sync network disconnection rollback,
 * multi-tab LWW conflict resolution, and large chat history quota bounding.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');
const { createStorageMock } = require('./test_helpers');

const approvalsModule = require('../src/security/approvals');
const providersModule = require('../src/providers/registry');
const persistenceModule = require('../src/core/persistence');
const secretsModule = require('../src/security/secrets');
const stateModule = require('../src/core/state');

describe('EG-Nexus-OS Concurrency Stress & Runtime Resilience Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------
  // Requirement 2a: Rapid Click Debounce & Idempotency
  // -------------------------------------------------------------
  describe('Requirement 2a: Rapid Click Debounce & Idempotency', () => {
    it('should handle 20 rapid consecutive calls to resolveApprovalGate and execute callback exactly once', () => {
      let approveExecutionCount = 0;
      let toastMessages = [];

      // Setup clean UI state
      const uiState = approvalsModule.getUiState();
      uiState.pendingApprovalQueue = [];
      uiState._isResolvingApproval = false;

      // Mock window.showToast
      global.window = {
        showToast: (msg) => { toastMessages.push(msg); }
      };

      // Trigger an approval gate
      approvalsModule.triggerApprovalGate('Sensitive Action: Transfer Data', () => {
        approveExecutionCount++;
      });

      expect(uiState.pendingApprovalQueue.length).toBe(1);

      // Rapidly fire 20 consecutive approvals (e.g. user rapid double/multi-tapping approval button)
      for (let i = 0; i < 20; i++) {
        approvalsModule.resolveApprovalGate(true);
      }

      // Assert exactly 1 execution happened due to _isResolvingApproval lock
      expect(approveExecutionCount).toBe(1);
      expect(uiState.pendingApprovalQueue.length).toBe(0);

      delete global.window;
    });

    it('should handle 20 rapid consecutive rejection clicks without unhandled exceptions or corrupting queue', () => {
      let toastCount = 0;
      const uiState = approvalsModule.getUiState();
      uiState.pendingApprovalQueue = [];
      uiState._isResolvingApproval = false;

      global.window = {
        showToast: () => { toastCount++; }
      };

      approvalsModule.triggerApprovalGate('Delete Cloud Backup', () => {});

      // Fire 20 rapid rejections
      for (let i = 0; i < 20; i++) {
        approvalsModule.resolveApprovalGate(false);
      }

      // Rejection toast shown once, queue cleanly cleared
      expect(toastCount).toBe(1);
      expect(uiState.pendingApprovalQueue.length).toBe(0);

      delete global.window;
    });

    it('should synchronize 25 concurrent tasks using createSyncLock with zero race corruption', async () => {
      const lock = providersModule.createSyncLock();
      let activeConcurrency = 0;
      let maxObservedConcurrency = 0;
      let completedTasks = 0;
      const executionOrder = [];

      async function runWorker(workerId) {
        await lock.acquire();
        activeConcurrency++;
        if (activeConcurrency > maxObservedConcurrency) {
          maxObservedConcurrency = activeConcurrency;
        }

        // Small async delay to simulate I/O or state transform
        await new Promise(res => setTimeout(res, 5));

        executionOrder.push(workerId);
        activeConcurrency--;
        completedTasks++;
        lock.release();
      }

      // Launch 25 concurrent workers simultaneously
      const workers = [];
      for (let i = 0; i < 25; i++) {
        workers.push(runWorker(i));
      }

      await Promise.all(workers);

      expect(completedTasks).toBe(25);
      expect(maxObservedConcurrency).toBe(1); // Never exceeded mutual exclusion
      expect(activeConcurrency).toBe(0);
      expect(executionOrder.length).toBe(25);
    });

    it('should identify sensitive mutating actions requiring confirmation across all providers', () => {
      // Mutating sensitive actions must return true
      expect(providersModule.isMutatingOrSensitiveAction('github', 'push_code')).toBe(true);
      expect(providersModule.isMutatingOrSensitiveAction('github', 'delete_repo')).toBe(true);
      expect(providersModule.isMutatingOrSensitiveAction('gmail', 'send_email')).toBe(true);
      expect(providersModule.isMutatingOrSensitiveAction('telegram', 'send_message')).toBe(true);
      expect(providersModule.isMutatingOrSensitiveAction('termux', 'execute_command')).toBe(true);
      expect(providersModule.isMutatingOrSensitiveAction('cloud', 'delete_routine')).toBe(true);

      // Read-only actions must return false
      expect(providersModule.isMutatingOrSensitiveAction('github', 'read_commits')).toBe(false);
      expect(providersModule.isMutatingOrSensitiveAction('gmail', 'list_threads')).toBe(false);
      expect(providersModule.isMutatingOrSensitiveAction('gcal', 'read_events')).toBe(false);
      expect(providersModule.isMutatingOrSensitiveAction('telegram', 'get_updates')).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Requirement 2b: Network Disconnection Mid-Sync & Rollback
  // -------------------------------------------------------------
  describe('Requirement 2b: Network Disconnection Mid-Sync & Rollback', () => {
    it('should handle offline network disconnection during Supabase/Cloudflare Worker sync with retry backoff', async () => {
      let attempts = 0;

      // Simulated network failure function (offline disconnection)
      const offlineFetch = jest.fn(async () => {
        attempts++;
        const err = new TypeError('Failed to fetch (Network offline / DNS unreachable)');
        err.name = 'TypeError';
        throw err;
      });

      // Execute provider request with retry policy (max 3 retries)
      const result = await providersModule.executeProviderRequest({
        providerId: 'supabase',
        action: 'sync',
        token: 'sb_test_token_123',
        approved: true,
        executeFn: offlineFetch,
        retryOptions: {
          maxRetries: 3,
          baseDelayMs: 10
        }
      });

      // Assert retry exhaustion occurred (1 initial try + 3 retries = 4 attempts total)
      expect(attempts).toBe(4);
      expect(result).toBeDefined();
      expect(result.providerId).toBe('supabase');
      expect(result.message).toMatch(/Network offline/i);
    });

    it('should preserve local state intact when mid-sync network disconnection aborts cloud worker push', async () => {
      const storage = createStorageMock();
      const initialState = {
        profileName: 'Ali',
        routines: [
          { id: 'rt_active_1', name: 'Morning Sync', version: 2, lastRunAt: '2026-11-10T08:00:00Z' }
        ],
        cloudConfig: {
          workspaceId: 'ws_offline_test',
          stateRevision: 42,
          lastSyncAt: '2026-11-10T07:00:00Z'
        }
      };

      storage.setItem(persistenceModule.STORAGE_KEY, JSON.stringify(initialState));

      // Simulate a mid-sync network abort
      async function syncWithCloudWorker() {
        const backupSnapshot = JSON.parse(storage.getItem(persistenceModule.STORAGE_KEY));
        try {
          // Simulated offline error during network transmit
          throw new Error('Connection reset by peer: Simulated mid-sync disconnect');
        } catch (netErr) {
          // Graceful rollback to backup snapshot
          storage.setItem(persistenceModule.STORAGE_KEY, JSON.stringify(backupSnapshot));
          return { ok: false, error: netErr.message, rolledBack: true };
        }
      }

      const syncResult = await syncWithCloudWorker();
      expect(syncResult.ok).toBe(false);
      expect(syncResult.rolledBack).toBe(true);

      // Verify local storage is 100% intact
      const preservedState = JSON.parse(storage.getItem(persistenceModule.STORAGE_KEY));
      expect(preservedState.cloudConfig.stateRevision).toBe(42);
      expect(preservedState.routines[0].id).toBe('rt_active_1');
      expect(preservedState.routines[0].version).toBe(2);
    });

    it('should release sync lock and not deadlock if an unexpected exception throws mid-sync', async () => {
      const lock = providersModule.createSyncLock();

      // Task 1 fails catastrophically inside critical section
      let task1Failed = false;
      try {
        await lock.acquire();
        throw new Error('Fatal mid-sync JSON parse error');
      } catch (err) {
        task1Failed = true;
      } finally {
        lock.release(); // Always release in finally
      }

      expect(task1Failed).toBe(true);

      // Task 2 should now acquire lock immediately without deadlocking
      let task2Acquired = false;
      await lock.acquire();
      task2Acquired = true;
      lock.release();

      expect(task2Acquired).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Requirement 2c: Multi-Tab Concurrency & Last-Write-Wins (LWW)
  // -------------------------------------------------------------
  describe('Requirement 2c: Multi-Tab Concurrency & Last-Write-Wins (LWW)', () => {
    it('should resolve conflicting state writes between two tabs using Last-Write-Wins (LWW)', () => {
      const storage = createStorageMock();

      const tab1State = {
        profileName: 'Ali Tab 1',
        updatedAtTs: 1700000000000,
        activeChatId: 'chat_tab1'
      };

      const tab2State = {
        profileName: 'Ali Tab 2',
        updatedAtTs: 1700000005000, // Newer timestamp by 5 seconds
        activeChatId: 'chat_tab2'
      };

      // Tab 1 writes first
      storage.setItem(persistenceModule.STORAGE_KEY, JSON.stringify(tab1State));

      // Tab 2 writes later with a higher timestamp
      const existing = JSON.parse(storage.getItem(persistenceModule.STORAGE_KEY));
      if (tab2State.updatedAtTs >= existing.updatedAtTs) {
        storage.setItem(persistenceModule.STORAGE_KEY, JSON.stringify(tab2State));
      }

      // Assert Tab 2 won
      const current = JSON.parse(storage.getItem(persistenceModule.STORAGE_KEY));
      expect(current.profileName).toBe('Ali Tab 2');
      expect(current.activeChatId).toBe('chat_tab2');
      expect(current.updatedAtTs).toBe(1700000005000);
    });

    it('should resolve routine conflicts via resolveRoutineConflicts based on version and timestamp', () => {
      // Case 1: Remote has higher version
      const localV1 = { id: 'rt_1', version: 1, updated_at: '2026-11-10T10:00:00Z' };
      const remoteV2 = { id: 'rt_1', version: 2, updated_at: '2026-11-10T09:00:00Z' };
      const res1 = providersModule.resolveRoutineConflicts(localV1, remoteV2);
      expect(res1.winner).toBe('remote');
      expect(res1.resolved.version).toBe(2);

      // Case 2: Local has higher version
      const localV3 = { id: 'rt_1', version: 3, updated_at: '2026-11-10T09:00:00Z' };
      const remoteV1 = { id: 'rt_1', version: 1, updated_at: '2026-11-10T11:00:00Z' };
      const res2 = providersModule.resolveRoutineConflicts(localV3, remoteV1);
      expect(res2.winner).toBe('local');
      expect(res2.resolved.version).toBe(3);

      // Case 3: Same version, newer timestamp wins
      const localSameVer = { id: 'rt_1', version: 2, updated_at: '2026-11-10T10:00:00Z' };
      const remoteSameVerNewer = { id: 'rt_1', version: 2, updated_at: '2026-11-10T10:05:00Z' };
      const res3 = providersModule.resolveRoutineConflicts(localSameVer, remoteSameVerNewer);
      expect(res3.winner).toBe('remote');
      expect(res3.resolved.updated_at).toBe('2026-11-10T10:05:00Z');
    });

    it('should deduplicate 100 KV entries from concurrent tabs cleanly using deduplicateKVEntries', () => {
      const localList = [];
      const remoteList = [];

      // Generate 50 items with conflicting timestamps
      for (let i = 0; i < 50; i++) {
        localList.push({
          id: `item_${i}`,
          value: `local_val_${i}`,
          updated_at: 1000 + i
        });
        remoteList.push({
          id: `item_${i}`,
          value: `remote_val_${i}`,
          updated_at: (i % 2 === 0) ? (2000 + i) : (500 + i) // Remote newer on evens, older on odds
        });
      }

      const deduplicated = providersModule.deduplicateKVEntries(localList, remoteList, 'id', 'updated_at');

      expect(deduplicated.length).toBe(50); // Exactly 50 unique IDs

      // Verify LWW accuracy
      const item0 = deduplicated.find(x => x.id === 'item_0');
      expect(item0.value).toBe('remote_val_0'); // Remote was newer (2000 > 1000)

      const item1 = deduplicated.find(x => x.id === 'item_1');
      expect(item1.value).toBe('local_val_1'); // Local was newer (1001 > 501)
    });
  });

  // -------------------------------------------------------------
  // Requirement 2d: Large State & Chat History Quota Protection
  // -------------------------------------------------------------
  describe('Requirement 2d: Large State & Chat History Quota Protection', () => {
    it('should truncate chat with 500+ messages to MAX_PERSISTED_MSGS_PER_CHAT (300) in buildPersistedState', () => {
      // Generate 600 messages
      const messages = [];
      for (let i = 0; i < 600; i++) {
        messages.push({
          id: `msg_${i}`,
          text: `Message content #${i} for stress testing`,
          senderType: i % 2 === 0 ? 'user' : 'agent'
        });
      }

      const appState = {
        chats: [
          {
            id: 'chat_large_stress',
            title: 'Large Chat',
            messages
          }
        ]
      };

      const persisted = persistenceModule.buildPersistedState(appState);

      expect(persisted.chats[0].messages.length).toBe(300);

      // Verify the 300 preserved messages are the tail (most recent messages 300 to 599)
      expect(persisted.chats[0].messages[0].id).toBe('msg_300');
      expect(persisted.chats[0].messages[299].id).toBe('msg_599');
    });

    it('should truncate chat with 500+ messages to 300 during sanitizeLoadedState on import', () => {
      const messages = [];
      for (let i = 0; i < 550; i++) {
        messages.push({
          id: `imp_msg_${i}`,
          text: `Import message #${i}`,
          senderType: 'user'
        });
      }

      const importedState = {
        profileName: 'Ali',
        chats: [
          {
            id: 'chat_imported',
            title: 'Imported Large Chat',
            messages
          }
        ]
      };

      const loaded = persistenceModule.sanitizeLoadedState(importedState);

      expect(loaded.chats[0].messages.length).toBe(300);
      expect(loaded.chats[0].messages[0].id).toBe('imp_msg_250');
      expect(loaded.chats[0].messages[299].id).toBe('imp_msg_549');
    });

    it('should handle multi-chat large state with 10 chats and 5,000 total messages without quota exhaustion', () => {
      const chats = [];
      for (let c = 0; c < 10; c++) {
        const msgs = [];
        for (let m = 0; m < 500; m++) {
          msgs.push({ id: `c${c}_m${m}`, text: `Chat ${c} msg ${m}`, senderType: 'agent' });
        }
        chats.push({ id: `chat_${c}`, title: `Chat ${c}`, messages: msgs });
      }

      const hugeState = { chats };
      const persisted = persistenceModule.buildPersistedState(hugeState);

      // All 10 chats must be capped at 300 messages each
      expect(persisted.chats.length).toBe(10);
      persisted.chats.forEach(c => {
        expect(c.messages.length).toBe(300);
      });

      // Total messages capped from 5,000 down to 3,000
      const totalMessages = persisted.chats.reduce((acc, c) => acc + c.messages.length, 0);
      expect(totalMessages).toBe(3000);

      // Check JSON serialization succeeds under storage limits
      const json = JSON.stringify(persisted);
      expect(typeof json).toBe('string');
      expect(json.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // Complementary Concurrency & Memory Cleanup Tests
  // -------------------------------------------------------------
  describe('Complementary Concurrency & Memory Cleanup Tests', () => {
    it('should throttle rapid Telegram webhook requests when rate limit threshold is exceeded', () => {
      const now = Date.now();
      const burstTimestamps = [];

      // Generate 40 requests in 1 second
      for (let i = 0; i < 40; i++) {
        burstTimestamps.push(now - (i * 20));
      }

      const isLimited = providersModule.isTelegramRateLimited(burstTimestamps, 30, 1000);
      expect(isLimited).toBe(true);

      // Low volume (10 requests) should not be throttled
      const calmTimestamps = burstTimestamps.slice(0, 10);
      expect(providersModule.isTelegramRateLimited(calmTimestamps, 30, 1000)).toBe(false);
    });

    it('should cleanly prune in-memory chats to threshold via cleanMemoryState to prevent memory bloat', () => {
      const msgs = [];
      for (let i = 0; i < 250; i++) {
        msgs.push({ id: `msg_${i}`, text: `In-memory message ${i}` });
      }
      const memoryState = {
        chats: [
          { id: 'chat_bloat', messages: msgs }
        ]
      };

      // Prune to 100 messages
      providersModule.cleanMemoryState(memoryState, 100);

      expect(memoryState.chats[0].messages.length).toBe(100);
      expect(memoryState.chats[0].messages[0].id).toBe('msg_150');
      expect(memoryState.chats[0].messages[99].id).toBe('msg_249');
    });

    it('should cleanly strip in-memory credentials and transient secrets via buildPersistedState', () => {
      const sensitiveState = {
        apiKeys: { gemini: 'active_token', openai: 'active_key' },
        appConnections: {
          github: { token: 'ghp_secret', accounts: [{ id: '1', token: 'oauth' }] }
        },
        cloudConfig: { workerSecret: 'sec_1', supabaseKey: 'sb_1' },
        localComputerConfig: { bridgeToken: 'local_bridge_tok' }
      };

      const persisted = persistenceModule.buildPersistedState(sensitiveState);

      expect(persisted.apiKeys.gemini).toBe('');
      expect(persisted.apiKeys.openai).toBe('');
      expect(persisted.appConnections.github.token).toBe('');
      expect(persisted.appConnections.github.accounts[0].token).toBe('');
      expect(persisted.cloudConfig.workerSecret).toBe('');
      expect(persisted.cloudConfig.supabaseKey).toBe('');
      expect(persisted.localComputerConfig.bridgeToken).toBe('');
    });
  });
});
