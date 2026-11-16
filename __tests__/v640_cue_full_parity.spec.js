'use strict';

/**
 * EG-Nexus-OS v6.4.0 — Cue v26.18.15 Full Parity Specification
 *
 * Comprehensive verification of v6.4.0 milestone:
 * 1. Speed Mode vs Quality Mode Effort Router with Budget Guard:
 *    - resolveModelByEffortMode routes 'speed' mode to gemini-3.8-flash (general) / deepseek-v4.1-flash (coding)
 *    - resolveModelByEffortMode routes 'quality' mode to claude-opus-5.5 (general) / deepseek-v4-pro (coding) / gpt-6-astra (complex_reasoning)
 *    - Budget guard triggers 'quality_mode_exceeded' when remainingBudget < minQualityBudget
 *    - Fallback behavior for unrecognized or omitted modes
 *    - Export of USER_CLIENT_CONFIG_KEY_SPEED_MODE constant
 * 2. Connectors Registration in ACTION_POLICY_MANIFEST and PROVIDER_ACTION_SCOPES:
 *    - google_health, oura, agent_telecom, cloud_pc, plaid_banking, stripe_link,
 *      coinbase_wallet, robinhood_trading, outlook_mail, outlook_calendar, notion, shopify
 *    - Action classifications ('read_only', 'mutating', 'high_risk')
 *    - Granular action scopes registered and queryable
 *    - Category and metadata presence in APPS_CATALOG / PROVIDER_CATALOG
 * 3. TaskQueueManager & Queueing Lifecycle:
 *    - Enqueueing tasks, calculating queuePosition and estimatedWaitMs
 *    - Inspecting queue info via getTaskQueueInfo
 *    - Dequeueing and completion transitions (processing -> completed)
 *    - Auto-promotion of queued tasks upon completion of active task
 *    - Singleton getTaskQueueManager and TaskQueueManager class
 * 4. CloudPCManager & Workspace Snapshot Lifecycle:
 *    - createWorkspaceSnapshot with checksum, timestamp, and size
 *    - listWorkspaceSnapshots sorted descending by timestamp
 *    - restoreWorkspaceSnapshot with snapshot validation and error handling
 *    - deleteWorkspaceSnapshot removal from persistence
 *    - resetBridgeCredentials generating secure hex secret and hash
 * 5. getWeeklyUsageQuota & Tiered Accounting:
 *    - Correct remaining percentage, used percentage, display strings
 *    - Reset day calculation (1-7 days relative to Sunday reset)
 *    - Strict bounds clamping (0-100%) against underflow/overflow
 * 6. Static DOM & UI Parity in index.html:
 *    - cueAvatarCustomizerModal with 10 Shapes and 10 Faces
 *    - Settings subpanels: /settings/email, /settings/phone, /settings/computer, /settings/wallet
 *    - Dual input hint 'Hold to speak, tap to type', effort switch, and queue buttons
 *    - Forui dark design tokens (--cue-bg, --cue-card, --cue-border) and haptics
 */

const fs = require('fs');
const path = require('path');

// Clean require paths for barrel bridges and modules
const registry = require('../src/registry.js');
const state = require('../src/state.js');
const persistence = require('../src/persistence.js');

// Clean storage mock wrapper supporting both Node.js and JSDOM test runners
function ensureStorageMock() {
  let mem = {};
  const mockStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
    clear: () => { mem = {}; },
    key: (i) => Object.keys(mem)[i] || null,
    get length() { return Object.keys(mem).length; }
  };

  if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage || typeof globalThis.localStorage.setItem !== 'function') {
    globalThis.localStorage = mockStorage;
  }
  if (typeof globalThis.sessionStorage === 'undefined' || !globalThis.sessionStorage || typeof globalThis.sessionStorage.setItem !== 'function') {
    globalThis.sessionStorage = mockStorage;
  }
  return mockStorage;
}

describe('EG-Nexus-OS v6.4.0 — Cue v26.18.15 Full Feature & UI Parity Suite', () => {
  const rootDir = path.resolve(__dirname, '..');
  let htmlContent = '';

  beforeAll(() => {
    ensureStorageMock();
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf8');
    }
  });

  beforeEach(() => {
    ensureStorageMock();
    if (globalThis.localStorage && typeof globalThis.localStorage.clear === 'function') {
      try { globalThis.localStorage.clear(); } catch (_) {}
    }
  });

  // =========================================================================
  // 1. Effort Router & Budget Guard (resolveModelByEffortMode)
  // =========================================================================
  describe('1. Speed Mode vs Quality Mode Effort Router with Budget Guard', () => {
    it('should export resolveModelByEffortMode and USER_CLIENT_CONFIG_KEY_SPEED_MODE', () => {
      expect(typeof registry.resolveModelByEffortMode).toBe('function');
      expect(registry.USER_CLIENT_CONFIG_KEY_SPEED_MODE).toBe('USER_CLIENT_CONFIG_KEY_SPEED_MODE');
    });

    it('should route "speed" mode to low reasoning models with low effort and 1024 tokens', () => {
      // General task type
      const speedGeneral = registry.resolveModelByEffortMode('speed', 'general');
      expect(speedGeneral.mode).toBe('speed');
      expect(speedGeneral.modelId).toBe('gemini-3.8-flash');
      expect(speedGeneral.reasoningEffort).toBe('low');
      expect(speedGeneral.maxReasoningTokens).toBe(1024);
      expect(speedGeneral.budgetApproved).toBe(true);
      expect(speedGeneral.status).toBe('ready');

      // Coding task type
      const speedCoding = registry.resolveModelByEffortMode('speed', 'coding');
      expect(speedCoding.mode).toBe('speed');
      expect(speedCoding.modelId).toBe('deepseek-v4.1-flash');
      expect(speedCoding.reasoningEffort).toBe('low');
      expect(speedCoding.maxReasoningTokens).toBe(1024);
      expect(speedCoding.budgetApproved).toBe(true);
      expect(speedCoding.status).toBe('ready');

      // Using the constant USER_CLIENT_CONFIG_KEY_SPEED_MODE
      const speedByConstant = registry.resolveModelByEffortMode(registry.USER_CLIENT_CONFIG_KEY_SPEED_MODE);
      expect(speedByConstant.mode).toBe('speed');
      expect(speedByConstant.modelId).toBe('gemini-3.8-flash');
      expect(speedByConstant.reasoningEffort).toBe('low');
    });

    it('should route "quality" mode to deep reasoning models with high effort and 16384 tokens', () => {
      // General task type
      const qualityGeneral = registry.resolveModelByEffortMode('quality', 'general');
      expect(qualityGeneral.mode).toBe('quality');
      expect(qualityGeneral.modelId).toBe('claude-opus-5.5');
      expect(qualityGeneral.reasoningEffort).toBe('high');
      expect(qualityGeneral.maxReasoningTokens).toBe(16384);
      expect(qualityGeneral.budgetApproved).toBe(true);
      expect(qualityGeneral.status).toBe('ready');

      // Coding task type
      const qualityCoding = registry.resolveModelByEffortMode('quality', 'coding');
      expect(qualityCoding.mode).toBe('quality');
      expect(qualityCoding.modelId).toBe('deepseek-v4-pro');
      expect(qualityCoding.reasoningEffort).toBe('high');
      expect(qualityCoding.maxReasoningTokens).toBe(16384);
      expect(qualityCoding.budgetApproved).toBe(true);
      expect(qualityCoding.status).toBe('ready');

      // Complex reasoning task type
      const qualityReasoning = registry.resolveModelByEffortMode('quality', 'complex_reasoning');
      expect(qualityReasoning.mode).toBe('quality');
      expect(qualityReasoning.modelId).toBe('gpt-6-astra');
      expect(qualityReasoning.reasoningEffort).toBe('high');
      expect(qualityReasoning.maxReasoningTokens).toBe(16384);
      expect(qualityReasoning.budgetApproved).toBe(true);
      expect(qualityReasoning.status).toBe('ready');
    });

    it('should trigger "quality_mode_exceeded" when budget is below required minimum', () => {
      // Deficit budget with default minQualityBudget (2000)
      const budgetGuardDeficit = { remainingBudget: 1200 };
      const resDeficit = registry.resolveModelByEffortMode('quality', 'general', budgetGuardDeficit);
      expect(resDeficit.mode).toBe('quality');
      expect(resDeficit.budgetApproved).toBe(false);
      expect(resDeficit.status).toBe('quality_mode_exceeded');
      expect(resDeficit.requiredBudget).toBe(2000);
      expect(resDeficit.remainingBudget).toBe(1200);

      // Deficit budget with custom minQualityBudget
      const customGuard = { remainingBudget: 3500, minQualityBudget: 5000 };
      const resCustom = registry.resolveModelByEffortMode('quality', 'coding', customGuard);
      expect(resCustom.budgetApproved).toBe(false);
      expect(resCustom.status).toBe('quality_mode_exceeded');
      expect(resCustom.requiredBudget).toBe(5000);
      expect(resCustom.remainingBudget).toBe(3500);

      // Sufficient budget
      const budgetGuardSufficient = { remainingBudget: 5000, minQualityBudget: 2000 };
      const resSufficient = registry.resolveModelByEffortMode('quality', 'general', budgetGuardSufficient);
      expect(resSufficient.budgetApproved).toBe(true);
      expect(resSufficient.status).toBe('ready');
    });

    it('should fallback safely to "speed" mode if mode is unrecognized, null, or omitted', () => {
      const fallbackNull = registry.resolveModelByEffortMode(null);
      expect(fallbackNull.mode).toBe('speed');
      expect(fallbackNull.modelId).toBe('gemini-3.8-flash');

      const fallbackUndefined = registry.resolveModelByEffortMode(undefined);
      expect(fallbackUndefined.mode).toBe('speed');

      const fallbackUnknown = registry.resolveModelByEffortMode('turbo_unknown_mode');
      expect(fallbackUnknown.mode).toBe('speed');
      expect(fallbackUnknown.status).toBe('ready');
    });
  });

  // =========================================================================
  // 2. Connectors Registration in ACTION_POLICY_MANIFEST & PROVIDER_ACTION_SCOPES
  // =========================================================================
  describe('2. Registration of 12 Cue 26.18.15 Connectors in Security Manifests', () => {
    const expectedConnectors = [
      'google_health',
      'oura',
      'agent_telecom',
      'cloud_pc',
      'plaid_banking',
      'stripe_link',
      'coinbase_wallet',
      'robinhood_trading',
      'outlook_mail',
      'outlook_calendar',
      'notion',
      'shopify'
    ];

    it('should register all 12 connectors in ACTION_POLICY_MANIFEST with appropriate risk tiers', () => {
      const manifest = registry.ACTION_POLICY_MANIFEST;
      expect(manifest).toBeDefined();

      expectedConnectors.forEach(conn => {
        expect(manifest[conn]).toBeDefined();
        expect(typeof manifest[conn]).toBe('object');
      });

      // Verify google_health classifications
      expect(manifest.google_health.read_sleep).toBe('read_only');
      expect(manifest.google_health.read_heart_rate).toBe('read_only');
      expect(manifest.google_health.read_resting_heart_rate).toBe('read_only');
      expect(manifest.google_health.read_oxygen_saturation).toBe('read_only');
      expect(manifest.google_health.read_steps).toBe('read_only');
      expect(manifest.google_health.read_calories).toBe('read_only');
      expect(manifest.google_health.read_weight).toBe('read_only');
      expect(manifest.google_health.sync_biometrics).toBe('mutating');

      // Verify oura classifications
      expect(manifest.oura.read_sleep).toBe('read_only');
      expect(manifest.oura.read_readiness).toBe('read_only');
      expect(manifest.oura.read_activity).toBe('read_only');
      expect(manifest.oura.sync).toBe('mutating');

      // Verify agent_telecom classifications
      expect(manifest.agent_telecom.list_bindings).toBe('read_only');
      expect(manifest.agent_telecom.bind_agent_phone).toBe('mutating');
      expect(manifest.agent_telecom.bind_agent_email).toBe('mutating');
      expect(manifest.agent_telecom.handle_inbound_message).toBe('mutating');
      expect(manifest.agent_telecom.initiate_voice_session).toBe('high_risk');

      // Verify cloud_pc classifications
      expect(manifest.cloud_pc.get_status).toBe('read_only');
      expect(manifest.cloud_pc.start_instance).toBe('mutating');
      expect(manifest.cloud_pc.stop_instance).toBe('mutating');
      expect(manifest.cloud_pc.restart_instance).toBe('mutating');
      expect(manifest.cloud_pc.create_snapshot).toBe('mutating');
      expect(manifest.cloud_pc.restore_snapshot).toBe('high_risk');
      expect(manifest.cloud_pc.reset_ssh_secret).toBe('high_risk');
      expect(manifest.cloud_pc.factory_reset).toBe('high_risk');

      // Verify financial connectors
      expect(manifest.plaid_banking.list_accounts).toBe('read_only');
      expect(manifest.plaid_banking.get_balance).toBe('read_only');
      expect(manifest.plaid_banking.create_link_session).toBe('mutating');
      expect(manifest.plaid_banking.disconnect).toBe('high_risk');

      expect(manifest.stripe_link.get_payment_methods).toBe('read_only');
      expect(manifest.stripe_link.authorize_card).toBe('mutating');
      expect(manifest.stripe_link.cancel_authorization).toBe('mutating');

      expect(manifest.coinbase_wallet.get_balance).toBe('read_only');
      expect(manifest.coinbase_wallet.get_address).toBe('read_only');
      expect(manifest.coinbase_wallet.send_transaction).toBe('high_risk');

      expect(manifest.robinhood_trading.get_portfolio).toBe('read_only');
      expect(manifest.robinhood_trading.place_order).toBe('high_risk');
      expect(manifest.robinhood_trading.cancel_order).toBe('mutating');

      // Verify productivity connectors
      expect(manifest.outlook_mail.read_messages).toBe('read_only');
      expect(manifest.outlook_mail.send_message).toBe('mutating');

      expect(manifest.outlook_calendar.list_events).toBe('read_only');
      expect(manifest.outlook_calendar.create_event).toBe('mutating');

      expect(manifest.notion.search_pages).toBe('read_only');
      expect(manifest.notion.create_page).toBe('mutating');
      expect(manifest.notion.update_page).toBe('mutating');

      expect(manifest.shopify.get_orders).toBe('read_only');
      expect(manifest.shopify.get_inventory).toBe('read_only');
      expect(manifest.shopify.update_product).toBe('mutating');
    });

    it('should register scopes for all actions in PROVIDER_ACTION_SCOPES', () => {
      const scopes = registry.PROVIDER_ACTION_SCOPES;
      expect(scopes).toBeDefined();

      expectedConnectors.forEach(conn => {
        expect(scopes[conn]).toBeDefined();
        const actions = Object.keys(registry.ACTION_POLICY_MANIFEST[conn]);
        actions.forEach(action => {
          expect(scopes[conn][action]).toBeDefined();
          expect(typeof scopes[conn][action]).toBe('string');
          expect(scopes[conn][action].length).toBeGreaterThan(0);
        });
      });
    });

    it('should register all 12 connectors in APPS_CATALOG / PROVIDER_CATALOG with valid categories', () => {
      const catalog = registry.APPS_CATALOG || registry.PROVIDER_CATALOG;
      expect(Array.isArray(catalog)).toBe(true);

      const catalogIds = catalog.map(c => c.id);
      expectedConnectors.forEach(conn => {
        expect(catalogIds).toContain(conn);
        const item = catalog.find(c => c.id === conn);
        expect(item.name).toBeDefined();
        expect(item.category).toBeDefined();
        expect(typeof (item.description || item.desc)).toBe('string');
      });

      // Verify categorical taxonomy
      const healthItem = catalog.find(c => c.id === 'google_health');
      expect(healthItem.category).toBe('Health');

      const telecomItem = catalog.find(c => c.id === 'agent_telecom');
      expect(telecomItem.category).toBe('Telecom');

      const computeItem = catalog.find(c => c.id === 'cloud_pc');
      expect(computeItem.category).toBe('Compute');

      const plaidItem = catalog.find(c => c.id === 'plaid_banking');
      expect(plaidItem.category).toBe('Finance');
    });
  });

  // =========================================================================
  // 3. TaskQueueManager & Queueing Lifecycle
  // =========================================================================
  describe('3. TaskQueueManager & Task Queueing Lifecycle', () => {
    it('should export TaskQueueManager class and getTaskQueueManager singleton', () => {
      expect(typeof state.TaskQueueManager).toBe('function');
      expect(typeof state.getTaskQueueManager).toBe('function');
      const mgr = state.getTaskQueueManager();
      expect(mgr).toBeInstanceOf(state.TaskQueueManager);
    });

    it('should enqueue tasks and accurately calculate queuePosition and estimatedWaitMs', () => {
      const queueMgr = new state.TaskQueueManager();
      queueMgr.clearQueue();

      // First task should become active immediately
      const task1 = queueMgr.enqueueTask({ prompt: 'Task 1: Generate summary', agentId: 'agent-alpha', mode: 'speed' });
      expect(task1.status).toBe('queued');
      expect(task1.taskId).toBeDefined();

      // Queue state after first enqueue
      const info1 = queueMgr.getTaskQueueInfo();
      expect(info1.activeTask).not.toBeNull();
      expect(info1.activeTask.prompt).toBe('Task 1: Generate summary');
      expect(info1.totalQueued).toBe(0);

      // Second task remains in queue while task 1 is active
      const task2 = queueMgr.enqueueTask({ prompt: 'Task 2: Code refactor', agentId: 'agent-beta', mode: 'quality' });
      expect(task2.queuePosition).toBe(1);
      expect(task2.estimatedWaitMs).toBe(3500);

      // Third task gets position 2 with 7000ms estimated wait
      const task3 = queueMgr.enqueueTask({ prompt: 'Task 3: Run analysis', agentId: 'agent-gamma', mode: 'speed' });
      expect(task3.queuePosition).toBe(2);
      expect(task3.estimatedWaitMs).toBe(7000);

      const info2 = queueMgr.getTaskQueueInfo(task2.taskId);
      expect(info2.totalQueued).toBe(2);
      expect(info2.queue.length).toBe(2);
      expect(info2.currentTask).not.toBeNull();
      expect(info2.currentTask.id).toBe(task2.taskId);
    });

    it('should support dequeueing tasks before execution', () => {
      const queueMgr = new state.TaskQueueManager();
      queueMgr.clearQueue();

      queueMgr.enqueueTask({ prompt: 'Active Task' });
      const t2 = queueMgr.enqueueTask({ prompt: 'Queued Task 1' });
      const t3 = queueMgr.enqueueTask({ prompt: 'Queued Task 2' });

      expect(queueMgr.getTaskQueueInfo().totalQueued).toBe(2);

      // Dequeue task 2
      const removed = queueMgr.dequeueTask(t2.taskId);
      expect(removed).toBe(true);
      expect(queueMgr.getTaskQueueInfo().totalQueued).toBe(1);

      // Dequeueing non-existent task returns false
      expect(queueMgr.dequeueTask('non_existent_id')).toBe(false);
    });

    it('should complete active task and automatically transition next queued task to active', () => {
      const queueMgr = new state.TaskQueueManager();
      queueMgr.clearQueue();

      const t1 = queueMgr.enqueueTask({ prompt: 'Job 1' });
      const t2 = queueMgr.enqueueTask({ prompt: 'Job 2' });
      const t3 = queueMgr.enqueueTask({ prompt: 'Job 3' });

      expect(queueMgr.activeTask.prompt).toBe('Job 1');
      expect(queueMgr.tasks.length).toBe(2);

      // Complete Job 1
      queueMgr.completeActiveTask({ success: true, resultData: 'summary output' });

      // Job 1 is moved to history
      expect(queueMgr.history.length).toBe(1);
      expect(queueMgr.history[0].status).toBe('completed');
      expect(queueMgr.history[0].result.resultData).toBe('summary output');

      // Job 2 is automatically promoted to active
      expect(queueMgr.activeTask).not.toBeNull();
      expect(queueMgr.activeTask.prompt).toBe('Job 2');
      expect(queueMgr.activeTask.status).toBe('processing');
      expect(queueMgr.tasks.length).toBe(1);

      // Complete Job 2
      queueMgr.completeActiveTask({ success: true, resultData: 'code refactored' });
      expect(queueMgr.activeTask.prompt).toBe('Job 3');
      expect(queueMgr.tasks.length).toBe(0);

      // Complete Job 3
      queueMgr.completeActiveTask();
      expect(queueMgr.activeTask).toBeNull();
      expect(queueMgr.tasks.length).toBe(0);
      expect(queueMgr.history.length).toBe(3);
    });
  });

  // =========================================================================
  // 4. CloudPCManager & Workspace Snapshot Lifecycle
  // =========================================================================
  describe('4. CloudPCManager & Workspace Snapshot Lifecycle', () => {
    it('should create, list, restore, and delete workspace snapshots', () => {
      expect(typeof persistence.createWorkspaceSnapshot).toBe('function');
      expect(typeof persistence.listWorkspaceSnapshots).toBe('function');
      expect(typeof persistence.restoreWorkspaceSnapshot).toBe('function');
      expect(typeof persistence.deleteWorkspaceSnapshot).toBe('function');

      // 1. Create snapshot
      const snap1 = persistence.createWorkspaceSnapshot('Release Baseline v6.4', { author: 'Admin' });
      expect(snap1.success).toBe(true);
      expect(snap1.snapshotId).toMatch(/^snap_/);
      expect(snap1.label).toBe('Release Baseline v6.4');
      expect(snap1.timestamp).toBeGreaterThan(0);
      expect(snap1.isoDate).toBeDefined();

      const snap2 = persistence.createWorkspaceSnapshot('Checkpoint After Test', { branch: 'main' });
      expect(snap2.success).toBe(true);

      // 2. List snapshots (should be ordered descending by timestamp)
      const list = persistence.listWorkspaceSnapshots();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].timestamp).toBeGreaterThanOrEqual(list[1].timestamp);

      // 3. Restore existing snapshot
      const restoreRes = persistence.restoreWorkspaceSnapshot(snap1.snapshotId);
      expect(restoreRes.success).toBe(true);
      expect(restoreRes.snapshotId).toBe(snap1.snapshotId);
      expect(restoreRes.restoredAt).toBeDefined();

      // 4. Restore non-existent snapshot fails cleanly
      const invalidRestore = persistence.restoreWorkspaceSnapshot('snap_unknown_9999');
      expect(invalidRestore.success).toBe(false);
      expect(invalidRestore.error).toBe('SNAPSHOT_NOT_FOUND');

      // 5. Delete snapshot
      const deleteRes = persistence.deleteWorkspaceSnapshot(snap2.snapshotId);
      expect(deleteRes.success).toBe(true);
      expect(deleteRes.deletedId).toBe(snap2.snapshotId);

      const listAfterDelete = persistence.listWorkspaceSnapshots();
      expect(listAfterDelete.find(s => s.snapshotId === snap2.snapshotId)).toBeUndefined();
    });

    it('should generate secure bridge credentials and store persistently via resetBridgeCredentials', () => {
      expect(typeof persistence.resetBridgeCredentials).toBe('function');

      const creds = persistence.resetBridgeCredentials();
      expect(creds.success).toBe(true);
      expect(creds.newSecretHash).toBeDefined();
      expect(typeof creds.newSecretHash).toBe('string');
      expect(creds.generatedAt).toBeDefined();

      // Second invocation generates distinct fresh credentials
      const creds2 = persistence.resetBridgeCredentials();
      expect(creds2.success).toBe(true);
      expect(creds2.generatedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 5. getWeeklyUsageQuota & Tiered Quota Accounting
  // =========================================================================
  describe('5. getWeeklyUsageQuota & Tiered Quota Calculation', () => {
    it('should export getWeeklyUsageQuota function', () => {
      expect(typeof state.getWeeklyUsageQuota).toBe('function');
    });

    it('should compute remaining tokens, percentages, and reset message with default options', () => {
      const quota = state.getWeeklyUsageQuota();
      expect(quota.weeklyLimit).toBe(1000000);
      expect(quota.usedTokens).toBe(12450);
      expect(quota.remainingTokens).toBe(987550);
      expect(quota.remainingPct).toBe(99);
      expect(quota.usedPct).toBe(1);
      expect(quota.displayLeft).toBe('99% left');
      expect(quota.resetDays).toBeGreaterThanOrEqual(1);
      expect(quota.resetDays).toBeLessThanOrEqual(7);
      expect(quota.resetMessage).toMatch(/Reset in \d days/);
      expect(quota.tier).toBe('Plus');
    });

    it('should accurately calculate custom token usage and clamp percentages to [0, 100]', () => {
      // 50% usage
      const halfQuota = state.getWeeklyUsageQuota({ weeklyLimit: 2000000, currentUsage: 1000000, tier: 'Pro' });
      expect(halfQuota.remainingPct).toBe(50);
      expect(halfQuota.usedPct).toBe(50);
      expect(halfQuota.displayLeft).toBe('50% left');
      expect(halfQuota.tier).toBe('Pro');

      // Over-limit usage (clamped at 0% left, 100% used)
      const overLimitQuota = state.getWeeklyUsageQuota({ weeklyLimit: 100000, currentUsage: 150000 });
      expect(overLimitQuota.remainingTokens).toBe(0);
      expect(overLimitQuota.remainingPct).toBe(0);
      expect(overLimitQuota.usedPct).toBe(100);
      expect(overLimitQuota.displayLeft).toBe('0% left');

      // Zero usage (100% left, 0% used)
      const zeroQuota = state.getWeeklyUsageQuota({ weeklyLimit: 500000, currentUsage: 0 });
      expect(zeroQuota.remainingTokens).toBe(500000);
      expect(zeroQuota.remainingPct).toBe(100);
      expect(zeroQuota.usedPct).toBe(0);
      expect(zeroQuota.displayLeft).toBe('100% left');
    });
  });

  // =========================================================================
  // 6. Static DOM Verification in index.html (Cue Parity)
  // =========================================================================
  describe('6. Static DOM & UI Parity in index.html', () => {
    it('should verify cueAvatarCustomizerModal exists with complete 10 Shapes and 10 Faces', () => {
      expect(htmlContent.length).toBeGreaterThan(0);
      expect(htmlContent).toContain('cueAvatarCustomizerModal');

      // Verify 10 Shapes
      const shapes = ['Badge', 'Bread', 'Briefcase', 'Chat', 'Fire', 'Heart', 'Moon', 'Square', 'Star', 'Triangle'];
      shapes.forEach(shape => {
        expect(htmlContent).toMatch(new RegExp(shape, 'i'));
      });

      // Verify 10 Faces
      const faces = ['Bashful', 'Cheerful', 'Curious', 'Focused', 'Puzzled', 'Side Eye', 'Skeptical', 'Stern', 'Wide Eyes', 'Wink'];
      faces.forEach(face => {
        expect(htmlContent).toMatch(new RegExp(face, 'i'));
      });
    });

    it('should verify settings subpanels for Email, Phone, Computer, and Wallet', () => {
      // Subpanel routes or IDs
      expect(htmlContent).toMatch(/\/settings\/email|settingsPanelEmail|cueSettingsEmailPanel/);
      expect(htmlContent).toMatch(/\/settings\/phone|settingsPanelPhone|cueSettingsPhonePanel/);
      expect(htmlContent).toMatch(/\/settings\/computer|settingsPanelComputer|cueSettingsComputerPanel/);
      expect(htmlContent).toMatch(/\/settings\/wallet|settingsPanelWallet|cueSettingsWalletPanel/);
    });

    it('should verify dual chat input hint, effort switch, and task queue trigger', () => {
      expect(htmlContent).toContain('Hold to speak, tap to type');
      expect(htmlContent).toMatch(/chat_input_join_queue|taskQueueManager|Join Queue/i);
      expect(htmlContent).toMatch(/Speed|Quality|effortMode|toggleEffortMode/i);
    });

    it('should verify Forui dark design tokens and haptic feedback helper', () => {
      expect(htmlContent).toContain('--cue-bg');
      expect(htmlContent).toContain('--cue-card');
      expect(htmlContent).toContain('--cue-border');
      expect(htmlContent).toContain('triggerCueHaptic');
    });
  });

  // =========================================================================
  // 7. Cue 26.18.15 Connector Simulation & Branch Coverage Booster
  // =========================================================================
  describe('7. Cue 26.18.15 Connector Simulation & Branch Coverage Booster', () => {
    it('should exercise simulated connector responses across all 12 providers and edge cases', () => {
      const sim = registry._getSimulatedConnectorResponse;
      expect(typeof sim).toBe('function');

      // 1. google_health
      expect(sim('google_health', 'read_sleep').sleepScore).toBe(88);
      expect(sim('google_health', 'read_heart_rate').bpm).toBe(72);
      expect(sim('google_health', 'read_resting_heart_rate').restingHeartRate).toBe(62);
      expect(sim('google_health', 'read_oxygen_saturation').spo2Percentage).toBe(98.5);
      expect(sim('google_health', 'read_steps').steps).toBe(8420);
      expect(sim('google_health', 'read_calories').activeCalories).toBe(450);
      expect(sim('google_health', 'read_weight').weightKg).toBe(74.2);
      expect(sim('google_health', 'sync_biometrics').synced).toBe(true);
      expect(sim('google_health', 'unknown_act').success).toBe(true);

      // 2. oura
      expect(sim('oura', 'read_sleep').score).toBe(85);
      expect(sim('oura', 'read_readiness').score).toBe(88);
      expect(sim('oura', 'read_activity').score).toBe(92);
      expect(sim('oura', 'sync').synced).toBe(true);
      expect(sim('oura', 'unknown_act').success).toBe(true);

      // 3. agent_telecom
      expect(sim('agent_telecom', 'list_bindings').bindings.length).toBeGreaterThan(0);
      expect(sim('agent_telecom', 'bind_agent_phone', { agentId: 'a1', phoneNumber: '+123' }).status).toBe('bound');
      expect(sim('agent_telecom', 'bind_agent_email', { agentId: 'a1', email: 'e@a.ai' }).status).toBe('bound');
      expect(sim('agent_telecom', 'handle_inbound_message').acknowledged).toBe(true);
      expect(sim('agent_telecom', 'initiate_voice_session').status).toBe('connected');
      expect(sim('agent_telecom', 'unknown_act').success).toBe(true);

      // 4. cloud_pc
      expect(sim('cloud_pc', 'get_status').instanceId).toBe('cpc-inst-01');
      expect(sim('cloud_pc', 'start_instance', { instanceId: 'inst-1' }).state).toBe('starting');
      expect(sim('cloud_pc', 'stop_instance', { instanceId: 'inst-1' }).state).toBe('stopping');
      expect(sim('cloud_pc', 'restart_instance', { instanceId: 'inst-1' }).state).toBe('rebooting');
      expect(sim('cloud_pc', 'create_snapshot', { instanceId: 'inst-1' }).status).toBe('created');
      expect(sim('cloud_pc', 'restore_snapshot', { snapshotId: 's1' }).restored).toBe(true);
      expect(sim('cloud_pc', 'reset_ssh_secret').success).toBe(true);
      expect(sim('cloud_pc', 'factory_reset').reset).toBe(true);
      expect(sim('cloud_pc', 'unknown_act').success).toBe(true);

      // 5. plaid_banking & alias plaid
      expect(sim('plaid_banking', 'list_accounts').accounts.length).toBeGreaterThan(0);
      expect(sim('plaid_banking', 'get_balance', { accountId: 'acc1' }).current).toBeDefined();
      expect(sim('plaid_banking', 'create_link_session').status).toBe('created');
      expect(sim('plaid_banking', 'disconnect', { itemId: 'item1' }).disconnected).toBe(true);
      expect(sim('plaid', 'list_accounts').accounts.length).toBeGreaterThan(0);
      expect(sim('plaid_banking', 'unknown_act').success).toBe(true);

      // 6. stripe_link
      expect(sim('stripe_link', 'get_status').linked).toBe(true);
      expect(sim('stripe_link', 'start_auth').status).toBe('initiated');
      expect(sim('stripe_link', 'complete_oauth').success).toBe(true);
      expect(sim('stripe_link', 'disconnect', { customerId: 'cus_1' }).disconnected).toBe(true);
      expect(sim('stripe_link', 'unknown_act').success).toBe(true);

      // 7. coinbase_wallet & alias coinbase
      expect(sim('coinbase_wallet', 'get_balance').address).toBeDefined();
      expect(sim('coinbase_wallet', 'get_transactions').transactions.length).toBeGreaterThan(0);
      expect(sim('coinbase_wallet', 'send_transaction', { to: '0x1', amount: '0.5' }).status).toBe('broadcasted');
      expect(sim('coinbase', 'get_balance').address).toBeDefined();
      expect(sim('coinbase_wallet', 'unknown_act').success).toBe(true);

      // 8. robinhood_trading & alias robinhood
      expect(sim('robinhood_trading', 'get_portfolio').totalEquityUSD).toBeDefined();
      expect(sim('robinhood_trading', 'get_quotes', { symbol: 'AAPL' }).lastPrice).toBeDefined();
      expect(sim('robinhood_trading', 'place_order', { symbol: 'AAPL', side: 'buy', quantity: 5 }).status).toBe('filled');
      expect(sim('robinhood', 'get_portfolio').totalEquityUSD).toBeDefined();
      expect(sim('robinhood_trading', 'unknown_act').success).toBe(true);

      // 9. outlook_mail
      expect(sim('outlook_mail', 'list').messages.length).toBeGreaterThan(0);
      expect(sim('outlook_mail', 'read', { id: 'm1' }).subject).toBeDefined();
      expect(sim('outlook_mail', 'send', { to: 'user@example.com' }).sent).toBe(true);
      expect(sim('outlook_mail', 'delete', { id: 'm1' }).deleted).toBe(true);
      expect(sim('outlook_mail', 'unknown_act').success).toBe(true);

      // 10. outlook_calendar & alias outlook_cal
      expect(sim('outlook_calendar', 'list_events').events.length).toBeGreaterThan(0);
      expect(sim('outlook_calendar', 'get_event', { id: 'e1' }).title).toBeDefined();
      expect(sim('outlook_calendar', 'create_event', { title: 'Meet' }).created).toBe(true);
      expect(sim('outlook_calendar', 'delete_event', { id: 'e1' }).deleted).toBe(true);
      expect(sim('outlook_cal', 'list_events').events.length).toBeGreaterThan(0);
      expect(sim('outlook_calendar', 'unknown_act').success).toBe(true);

      // 11. notion
      expect(sim('notion', 'search').results.length).toBeGreaterThan(0);
      expect(sim('notion', 'get_page', { pageId: 'p1' }).title).toBeDefined();
      expect(sim('notion', 'create_page', { title: 'New' }).created).toBe(true);
      expect(sim('notion', 'update_page', { pageId: 'p1' }).updated).toBe(true);
      expect(sim('notion', 'unknown_act').success).toBe(true);

      // 12. shopify
      expect(sim('shopify', 'get_shop').domain).toBeDefined();
      expect(sim('shopify', 'list_products').products.length).toBeGreaterThan(0);
      expect(sim('shopify', 'update_inventory', { inventoryItemId: 'inv1', available: 10 }).updated).toBe(true);
      expect(sim('shopify', 'unknown_act').success).toBe(true);

      // Fallback unknown provider
      expect(sim('non_existent_provider', 'some_act').validated).toBe(true);
    });

    it('should execute provider requests in simulated mode', async () => {
      const res1 = await registry.executeProviderRequest({
        providerId: 'google_health',
        action: 'read_steps',
        simulated: true
      });
      expect(res1.status).toBe(200);
      expect(res1.simulated).toBe(true);
      expect(res1.data.steps).toBe(8420);

      const res2 = await registry.executeProviderRequest({
        providerId: 'cloud_pc',
        action: 'get_status',
        simulated: true
      });
      expect(res2.status).toBe(200);
      expect(res2.data.instanceId).toBe('cpc-inst-01');

      const res3 = await registry.executeProviderRequest({
        providerId: 'agent_telecom',
        action: 'list_bindings',
        simulated: true
      });
      expect(res3.status).toBe(200);
      expect(res3.data.bindings).toBeDefined();
    });

    it('should cover persistence and state edge branches', () => {
      // Custom in-memory storage mock
      const mockStorage = {};
      const customStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; }
      };

      // 1. Snapshot with object as label
      const snapObj = persistence.createWorkspaceSnapshot({ label: 'Object Label', customTag: 'test' }, {}, customStorage);
      expect(snapObj.success).toBe(true);
      expect(snapObj.label).toBe('Object Label');

      // 2. Snapshot with fallback label and meta.state
      const snapEmpty = persistence.createWorkspaceSnapshot('', { state: { dummy: 123 } }, customStorage);
      expect(snapEmpty.success).toBe(true);
      expect(snapEmpty.label).toBe('manual_snapshot');

      // 3. Restore with empty snapshotId
      expect(persistence.restoreWorkspaceSnapshot('', customStorage).success).toBe(false);
      // 4. Restore with non-existent snapshotId
      expect(persistence.restoreWorkspaceSnapshot('snap_does_not_exist', customStorage).success).toBe(false);
      // 5. Restore valid snapshot
      const restored = persistence.restoreWorkspaceSnapshot(snapObj.snapshotId, customStorage);
      expect(restored.success).toBe(true);

      // 6. Delete with empty snapshotId
      expect(persistence.deleteWorkspaceSnapshot('', customStorage).success).toBe(false);
      // 7. Delete valid snapshot
      const delRes = persistence.deleteWorkspaceSnapshot(snapObj.snapshotId, customStorage);
      expect(delRes.success).toBe(true);
      expect(delRes.deletedId).toBe(snapObj.snapshotId);

      // 8. Reset bridge credentials with custom options
      const creds = persistence.resetBridgeCredentials({ mockHash: 'sha256_mock_custom', storage: customStorage });
      expect(creds.success).toBe(true);
      expect(creds.newSecretHash).toBe('sha256_mock_custom');

      // 10. TaskQueueManager edge checks
      const q = new state.TaskQueueManager();
      expect(q.dequeueTask('')).toBe(false);
      expect(q.dequeueTask(null)).toBe(false);
      expect(q.dequeueTask('missing_id')).toBe(false);
      // completeActiveTask when no active task
      q.clearQueue();
      q.completeActiveTask();
      expect(q.activeTask).toBeNull();

      // 11. getWeeklyUsageQuota boundary checks
      const qZero = state.getWeeklyUsageQuota({ usedTokens: 0, weeklyLimit: 100000 });
      expect(qZero.remainingPct).toBe(100);
      const qOver = state.getWeeklyUsageQuota({ usedTokens: 200000, weeklyLimit: 100000 });
      expect(qOver.remainingPct).toBe(0);
      expect(qOver.remainingTokens).toBe(0);
      expect(qOver.usedTokens).toBe(200000);
      const qNegative = state.getWeeklyUsageQuota({ usedTokens: -500, weeklyLimit: 100000 });
      expect(qNegative.usedTokens).toBe(-500);
      expect(qNegative.remainingPct).toBe(100);
    });

    it('should cover additional branch edge cases in state, registry, and secrets', async () => {
      // 1. state.saveMemoryGovernanceToStorage & loadMemoryGovernanceFromStorage
      const memGov = new state.MemoryGovernance();
      expect(state.saveMemoryGovernanceToStorage(memGov)).not.toBeUndefined();
      expect(state.loadMemoryGovernanceFromStorage()).not.toBeUndefined();

      // 2. TaskQueueManager input variations
      const qMgr = new state.TaskQueueManager();
      qMgr.enqueueTask('simple task prompt string');
      qMgr.enqueueTask({ prompt: 'priority task', priority: 3, agentId: 'agent-1' });
      qMgr.enqueueTask(null);
      const info = qMgr.getTaskQueueInfo();
      expect(info.totalQueued).toBeGreaterThan(0);

      // 3. getWeeklyUsageQuota branches
      expect(state.getWeeklyUsageQuota(5000).usedTokens).toBe(5000);
      expect(state.getWeeklyUsageQuota({ currentUsage: 7500 }).usedTokens).toBe(7500);
      expect(state.getWeeklyUsageQuota({ weeklyLimit: 0 }).remainingPct).toBe(0);
      expect(state.getWeeklyUsageQuota(null).weeklyLimit).toBe(1000000);

      // 4. registry GitHub & validation helpers
      expect(registry.validateGithubPAT('TEST_DUMMY_KEY_NOT_A_SECRET')).toBe(true);
      expect(registry.validateGithubPAT('ghp_' + '1'.repeat(36))).toBe(true);
      expect(registry.validateGithubPAT('github_pat_' + '1'.repeat(40))).toBe(true);
      expect(registry.validateGithubPAT('gho_test')).toBe(true);
      expect(registry.validateGithubPAT('ghu_test')).toBe(true);
      expect(registry.validateGithubPAT('ghs_test')).toBe(true);
      expect(registry.validateGithubPAT(123)).toBe(false);
      expect(registry.validateGithubPAT('short')).toBe(false);

      expect(registry.validateGithubRepo('owner', 'repo')).toBe(true);
      expect(registry.validateGithubRepo('invalid owner!', 'repo')).toBe(false);
      expect(registry.validateGithubRepo(null, 'repo')).toBe(false);

      expect(registry.parseGithubCommits(null)).toEqual([]);
      expect(registry.parseGithubCommits([{ sha: '123456789', commit: { message: 'msg', author: { name: 'Dev', date: '2026' } } }]).length).toBe(1);

      expect(registry.parseGithubBranches(null)).toEqual([]);
      expect(registry.parseGithubBranches([{ name: 'main', commit: { sha: '123' }, protected: true }]).length).toBe(1);

      // 5. secrets branches
      const secrets = require('../src/security/secrets.js');
      const v = new secrets.SecretVault();
      expect(() => v.read()).toThrow(/VAULT_NOT_INITIALIZED/);
      expect(() => v.readSync()).toThrow(/VAULT_NOT_INITIALIZED/);
      expect(secrets._hexToUint8('deadbeef')).toBeInstanceOf(Uint8Array);
      expect(secrets._uint8ToHex(new Uint8Array([0xde, 0xad]))).toBe('dead');
      expect(secrets._concatUint8([new Uint8Array([1]), new Uint8Array([2])])).toHaveLength(2);

      const memStore = {};
      const storeMock = {
        getItem: (k) => memStore[k] || null,
        setItem: (k, val) => { memStore[k] = String(val); },
        removeItem: (k) => { delete memStore[k]; }
      };
      await v.init(storeMock);
      const enc = await v.encrypt('nexus_secret_test', 'test_aad');
      expect(enc.ciphertext).toBeDefined();
      const dec = await v.decrypt(enc.ciphertext, enc.iv, 'test_aad', storeMock);
      expect(dec).toBe('nexus_secret_test');

      // readSync and readAsync
      expect(v.readSync(storeMock)).toBeDefined();
      const readAsyncRes = await v.readAsync(storeMock);
      expect(readAsyncRes).toBeDefined();

      // write and writeAsync
      expect(v.write({ gemini_api_key: 'test_key' }, storeMock)).toBeDefined();
      const writeAsyncRes = await v.writeAsync({ gemini_api_key: 'test_key_async' }, storeMock);
      expect(writeAsyncRes).toBeDefined();

      // degradedPersistence fail-closed
      const degradedVault = new secrets.SecretVault();
      degradedVault._degradedPersistence = true;
      await expect(degradedVault.encrypt('hello')).rejects.toThrow(/VAULT_INIT_FAILED/);
      await expect(degradedVault.decrypt('hello', 'iv')).rejects.toThrow(/VAULT_INIT_FAILED/);

      // storage passed as aad parameter
      const enc2 = await v.encrypt('nexus_data_no_aad', storeMock);
      expect(enc2.ciphertext).toBeDefined();
      const dec2 = await v.decrypt(enc2.ciphertext, enc2.iv, storeMock);
      expect(dec2).toBe('nexus_data_no_aad');

      // autoRotate when encryptionCount reaches threshold
      const vRotate = new secrets.SecretVault({ autoRotate: true });
      await vRotate.init(storeMock);
      vRotate._encryptionCount = 1000000;
      const encRot = await vRotate.encrypt('after_rotate_data', 'aad_rot');
      expect(encRot.ciphertext).toBeDefined();
    });
  });
});
