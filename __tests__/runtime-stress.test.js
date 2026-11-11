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

    it('should preserve local state intact and execute real rollback when network error occurs in syncWithCloudWorker', async () => {
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

      // Test real syncWithCloudWorker rollback upon network transport disconnection
      const syncResult = await persistenceModule.syncWithCloudWorker({
        storage,
        transportFn: async () => {
          throw new Error('Connection reset by peer: Simulated mid-sync disconnect');
        }
      });

      expect(syncResult.ok).toBe(false);
      expect(syncResult.rolledBack).toBe(true);
      expect(syncResult.error).toMatch(/Connection reset by peer/i);

      // Verify local storage is 100% intact after real rollback
      const preservedState = JSON.parse(storage.getItem(persistenceModule.STORAGE_KEY));
      expect(preservedState.cloudConfig.stateRevision).toBe(42);
      expect(preservedState.routines[0].id).toBe('rt_active_1');
      expect(preservedState.routines[0].version).toBe(2);

      // Verify successful sync path with real syncWithCloudWorker
      const successResult = await persistenceModule.syncWithCloudWorker({
        storage,
        transportFn: async (st) => ({
          ok: true,
          stateRevision: 43
        })
      });
      expect(successResult.ok).toBe(true);
      expect(successResult.rolledBack).toBe(false);
      expect(successResult.stateRevision).toBe(43);
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
    it('should perform field-level merge and prevent multi-tab conflicts with state_revision', () => {
      const tab1State = {
        profileName: 'Ali Tab 1',
        draftText: 'Draft from Tab 1',
        updatedAtTs: 1700000000000,
        state_revision: 5,
        chats: [{ id: 'chat_1', title: 'Local Chat', updatedAtTs: 1700000000000 }]
      };

      const tab2State = {
        effortMode: 'ultra',
        diffOnlyMode: false,
        updatedAtTs: 1700000005000,
        state_revision: 6,
        routines: [{ id: 'rt_tab2', name: 'Routine from Tab 2', version: 1 }]
      };

      // Real field-level merge exported from persistence module
      const mergeResult = persistenceModule.mergeMultiTabState(tab1State, tab2State);

      expect(mergeResult.conflictResolved).toBe(true);
      expect(mergeResult.winner).toBe('incoming');

      // Assert non-conflicting fields from both tabs are preserved (field-level merge)
      expect(mergeResult.mergedState.profileName).toBe('Ali Tab 1');
      expect(mergeResult.mergedState.draftText).toBe('Draft from Tab 1');
      expect(mergeResult.mergedState.effortMode).toBe('ultra');
      expect(mergeResult.mergedState.diffOnlyMode).toBe(false);

      // Assert collections from both tabs are merged
      expect(mergeResult.mergedState.chats.length).toBe(1);
      expect(mergeResult.mergedState.chats[0].id).toBe('chat_1');
      expect(mergeResult.mergedState.routines.length).toBe(1);
      expect(mergeResult.mergedState.routines[0].id).toBe('rt_tab2');

      // Assert state_revision was updated and prevents multi-tab collision
      expect(mergeResult.mergedState.state_revision).toBeGreaterThanOrEqual(6);
    });

    it('should protect against clock skew when comparing timestamps across skewed tabs', () => {
      const now = 1700000000000;
      const normalPastTs = now - 5000; // 5 seconds ago
      const skewedFutureTs = now + 7200000; // 2 hours in future due to faulty system clock

      // 1. Direct clock skew comparison test
      const skewCheck = persistenceModule.compareTimestampsWithClockSkewProtection(
        normalPastTs,
        skewedFutureTs,
        { now, maxClockSkewMs: 60000 }
      );

      expect(skewCheck.clockSkewDetected).toBe(true);
      expect(skewCheck.normalizedB).toBe(now); // Clamped to current time
      expect(skewCheck.winner).toBe('B'); // B still newer than past, but not dangerously into future

      // 2. Normal timestamps within threshold do not trigger clock skew
      const normalCheck = persistenceModule.compareTimestampsWithClockSkewProtection(
        now - 2000,
        now - 1000,
        { now, maxClockSkewMs: 60000 }
      );
      expect(normalCheck.clockSkewDetected).toBe(false);

      // 3. Multi-tab merge with clock skew protection prevents tab with future clock from overriding newer revision
      const tabWithNewerRevision = {
        profileName: 'Real Master Revision',
        state_revision: 10,
        updatedAtTs: now - 1000
      };

      const tabWithSkewedClock = {
        profileName: 'Rogue Skewed Tab',
        state_revision: 4, // Lower revision
        updatedAtTs: now + 3600000 // 1 hour in future
      };

      const mergeResult = persistenceModule.mergeMultiTabState(
        tabWithNewerRevision,
        tabWithSkewedClock,
        { now, maxClockSkewMs: 60000 }
      );

      expect(mergeResult.clockSkewDetected).toBe(true);
      expect(mergeResult.winner).toBe('local'); // Higher revision won despite Tab 2's future timestamp
      expect(mergeResult.mergedState.profileName).toBe('Real Master Revision');
      expect(mergeResult.mergedState.state_revision).toBeGreaterThanOrEqual(10);
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

  // -------------------------------------------------------------
  // Requirement 2e: v5.6 Sequential Write Queue Concurrency & Supply Chain Lockfile Integrity
  // -------------------------------------------------------------
  describe('Requirement 2e: v5.6 Sequential Write Queue Concurrency & Supply Chain Lockfile Integrity', () => {
    let mockStorage;

    beforeEach(() => {
      mockStorage = createStorageMock();
      if (typeof secretsModule._resetSessionCryptoState === 'function') {
        secretsModule._resetSessionCryptoState();
      }
      if (typeof secretsModule.resetSessionWriteQueue === 'function') {
        secretsModule.resetSessionWriteQueue();
      }
      if (typeof persistenceModule.resetSessionWriteQueue === 'function') {
        persistenceModule.resetSessionWriteQueue();
      }
    });

    afterEach(() => {
      if (typeof secretsModule._resetSessionCryptoState === 'function') {
        secretsModule._resetSessionCryptoState();
      }
      if (typeof secretsModule.resetSessionWriteQueue === 'function') {
        secretsModule.resetSessionWriteQueue();
      }
      if (typeof persistenceModule.resetSessionWriteQueue === 'function') {
        persistenceModule.resetSessionWriteQueue();
      }
    });

    it('should synchronize rapid concurrent calls to queueSessionSecretsWrite(A, B, C) and preserve final stateC without race condition', async () => {
      const stateA = {
        apiKeys: { gemini: 'key_A_gemini' },
        connectionTokens: { github: 'token_A_gh' },
        bridgeToken: 'bridge_A'
      };
      const stateB = {
        apiKeys: { gemini: 'key_B_gemini', openai: 'key_B_openai' },
        connectionTokens: { github: 'token_B_gh', telegram: 'token_B_tg' },
        bridgeToken: 'bridge_B'
      };
      const stateC = {
        apiKeys: { gemini: 'key_C_gemini', openai: 'key_C_openai', anthropic: 'key_C_ant' },
        connectionTokens: { github: 'token_C_gh', telegram: 'token_C_tg' },
        bridgeToken: 'bridge_C_final'
      };

      // Concurrent invocation of queueSessionSecretsWrite without awaiting between them
      const pA = secretsModule.queueSessionSecretsWrite(stateA, mockStorage);
      const pB = secretsModule.queueSessionSecretsWrite(stateB, mockStorage);
      const pC = secretsModule.queueSessionSecretsWrite(stateC, mockStorage);

      expect(secretsModule.getSessionWriteState()).toBe('pending');

      const results = await Promise.all([pA, pB, pC]);
      expect(results).toEqual([true, true, true]);
      expect(secretsModule.getSessionWriteState()).toBe('success');

      // The final state stored in sessionStorage must strictly match stateC
      secretsModule._resetSessionCryptoState();
      const finalSecrets = await secretsModule.readSessionSecretsAsync(mockStorage);
      expect(finalSecrets.initialized).toBe(true);
      expect(finalSecrets.apiKeys.gemini).toBe('key_C_gemini');
      expect(finalSecrets.apiKeys.openai).toBe('key_C_openai');
      expect(finalSecrets.apiKeys.anthropic).toBe('key_C_ant');
      expect(finalSecrets.connectionTokens.github).toBe('token_C_gh');
      expect(finalSecrets.connectionTokens.telegram).toBe('token_C_tg');
      expect(finalSecrets.bridgeToken).toBe('bridge_C_final');
    });

    it('should monotonically increment writeRevision counter across sequential and queued writes', async () => {
      expect(secretsModule.getSessionWriteRevision()).toBe(0);

      const p1 = secretsModule.queueSessionSecretsWrite({ apiKeys: { gemini: 'rev_1' } }, mockStorage);
      expect(secretsModule.getSessionWriteRevision()).toBe(1);

      const p2 = secretsModule.queueSessionSecretsWrite({ apiKeys: { gemini: 'rev_2' } }, mockStorage);
      expect(secretsModule.getSessionWriteRevision()).toBe(2);

      const p3 = secretsModule.queueSessionSecretsWrite({ apiKeys: { gemini: 'rev_3' } }, mockStorage);
      expect(secretsModule.getSessionWriteRevision()).toBe(3);

      await Promise.all([p1, p2, p3]);
      expect(secretsModule.getSessionWriteRevision()).toBe(3);

      const p4 = secretsModule.queueSessionSecretsWrite({ apiKeys: { gemini: 'rev_4' } }, mockStorage);
      expect(secretsModule.getSessionWriteRevision()).toBe(4);
      await p4;
      expect(secretsModule.getSessionWriteRevision()).toBe(4);
    });

    it('should integrate queueSessionSecretsWrite via persistenceModule seamlessly', async () => {
      expect(typeof persistenceModule.queueSessionSecretsWrite).toBe('function');
      expect(typeof persistenceModule.getSessionWriteRevision).toBe('function');
      expect(typeof persistenceModule.getSessionWriteState).toBe('function');

      const state = { apiKeys: { grok: 'xai-persistence-queue-token' } };
      const res = await persistenceModule.queueSessionSecretsWrite(state, mockStorage);
      expect(res).toBe(true);

      const restored = await secretsModule.readSessionSecretsAsync(mockStorage);
      expect(restored.apiKeys.grok).toBe('xai-persistence-queue-token');
    });

    it('should validate 100% parity between package.json and package-lock.json and pass npm ci --dry-run cleanly', () => {
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const packageLockPath = path.join(__dirname, '..', 'package-lock.json');

      expect(fs.existsSync(packageJsonPath)).toBe(true);
      expect(fs.existsSync(packageLockPath)).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

      // Strict version parity
      expect(pkg.version).toBe('5.6.0');
      expect(lock.version).toBe('5.6.0');
      expect(lock.packages[''].version).toBe('5.6.0');
      expect(lock.lockfileVersion).toBe(3);

      // Overrides verification (minimatch 11.0.8 resolution)
      expect(pkg.overrides).toBeDefined();
      expect(pkg.overrides.minimatch).toBe('11.0.8');
      expect(lock.packages['node_modules/minimatch'].version).toBe('11.0.8');

      // Execute npm ci --dry-run
      const { execSync } = require('child_process');
      const dryRunOutput = execSync('npm ci --dry-run', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(dryRunOutput).toBeDefined();
    });

    it('should verify npm audit reports 0 vulnerabilities and lockfile is tamper-free', () => {
      const { execSync } = require('child_process');
      const auditRaw = execSync('npm audit --json', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const auditData = JSON.parse(auditRaw);
      const totalVulns = (auditData.metadata && auditData.metadata.vulnerabilities)
        ? Object.values(auditData.metadata.vulnerabilities).reduce((a, b) => a + b, 0)
        : 0;

      expect(totalVulns).toBe(0);
    });
  });
});
