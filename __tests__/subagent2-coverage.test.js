/**
 * EG-Nexus-OS v5.5 — Subagent 2 Core Architecture & Multi-Tab Sync Coverage Boost
 */

const persistence = require('../src/core/persistence.js');
const registry = require('../src/providers/registry.js');
const secrets = require('../src/security/secrets.js');
const state = require('../src/core/state.js');

describe('Subagent 2 - Core Coverage Boost', () => {
  describe('Multi-Tab Sync & Persistence Branches', () => {
    test('mergeMultiTabState handles null and single-sided inputs', () => {
      expect(persistence.mergeMultiTabState(null, null)).toEqual({
        mergedState: {},
        winner: 'equal',
        clockSkewDetected: false,
        conflictResolved: false
      });
      const local = { stateRevision: 2, profileName: 'Ali' };
      const incoming = { stateRevision: 3, profileName: 'Vali' };

      expect(persistence.mergeMultiTabState(local, null).winner).toBe('local');
      expect(persistence.mergeMultiTabState(null, incoming).winner).toBe('incoming');
    });

    test('mergeMultiTabState handles revision precedence and time fallback', () => {
      // incoming rev > local rev
      const r1 = persistence.mergeMultiTabState(
        { stateRevision: 1, val: 'local' },
        { stateRevision: 2, val: 'remote' }
      );
      expect(r1.winner).toBe('incoming');
      expect(r1.mergedState.val).toBe('remote');

      // local rev > incoming rev
      const r2 = persistence.mergeMultiTabState(
        { stateRevision: 5, val: 'local' },
        { stateRevision: 2, val: 'remote' }
      );
      expect(r2.winner).toBe('local');
      expect(r2.mergedState.val).toBe('local');

      // Equal rev: timestamp comparison winner B (incoming)
      const r3 = persistence.mergeMultiTabState(
        { stateRevision: 1, updatedAtTs: 1000, val: 'loc' },
        { stateRevision: 1, updatedAtTs: 2000, val: 'inc' }
      );
      expect(r3.winner).toBe('incoming');
      expect(r3.mergedState.val).toBe('inc');

      // Equal rev: timestamp comparison winner A (local)
      const r4 = persistence.mergeMultiTabState(
        { stateRevision: 1, updatedAtTs: 2000, val: 'loc' },
        { stateRevision: 1, updatedAtTs: 1000, val: 'inc' }
      );
      expect(r4.winner).toBe('local');
      expect(r4.mergedState.val).toBe('loc');

      // Equal rev: equal timestamp -> primaryWinner 'merged'
      const r5 = persistence.mergeMultiTabState(
        { stateRevision: 1, updatedAtTs: 1000, keyA: 'localA', keyB: '' },
        { stateRevision: 1, updatedAtTs: 1000, keyA: 'remoteA', keyB: 'remoteB', keyC: 'remoteC' }
      );
      expect(r5.winner).toBe('merged');
      expect(r5.mergedState.keyC).toBe('remoteC');
      expect(r5.mergedState.keyB).toBe('remoteB');
    });

    test('mergeMultiTabState merges collections: chats, routines, agentsCatalog', () => {
      const local = {
        stateRevision: 1,
        chats: [
          { id: 'c1', updatedAtTs: 100, title: 'Chat 1 Local' },
          { id: 'c2', updatedAtTs: 200, title: 'Chat 2 Local' }
        ],
        routines: [
          { id: 'r1', version: 1, name: 'R1 Local' }
        ],
        agentsCatalog: [
          { id: 'a1', version: 1, name: 'A1 Local' }
        ]
      };

      const incoming = {
        stateRevision: 1,
        chats: [
          { id: 'c1', updatedAtTs: 300, title: 'Chat 1 Remote' },
          { id: 'c3', updatedAtTs: 150, title: 'Chat 3 Remote' },
          null,
          { title: 'no id' }
        ],
        routines: [
          { id: 'r1', version: 2, name: 'R1 Remote' },
          { id: 'r2', version: 1, name: 'R2 Remote' }
        ],
        agentsCatalog: [
          { id: 'a1', version: 2, name: 'A1 Remote' },
          { id: 'a2', version: 1, name: 'A2 Remote' }
        ]
      };

      const res = persistence.mergeMultiTabState(local, incoming);
      expect(res.mergedState.chats.length).toBe(3);
      expect(res.mergedState.chats.find(c => c.id === 'c1').title).toBe('Chat 1 Remote');
      expect(res.mergedState.routines.length).toBe(2);
      expect(res.mergedState.routines.find(r => r.id === 'r1').name).toBe('R1 Remote');
      expect(res.mergedState.agentsCatalog.length).toBe(2);
      expect(res.mergedState.agentsCatalog.find(a => a.id === 'a1').name).toBe('A1 Remote');
    });

    test('compareTimestampsWithClockSkewProtection protects against future drift', () => {
      const now = 1000000;
      // Clock skew on tsA
      const resA = persistence.compareTimestampsWithClockSkewProtection(2000000, 500000, { now, maxClockSkewMs: 60000 });
      expect(resA.clockSkewDetected).toBe(true);
      expect(resA.winner).toBe('A');

      // Clock skew on tsB
      const resB = persistence.compareTimestampsWithClockSkewProtection(500000, 2000000, { now, maxClockSkewMs: 60000 });
      expect(resB.clockSkewDetected).toBe(true);
      expect(resB.winner).toBe('B');

      // Equal
      const resEq = persistence.compareTimestampsWithClockSkewProtection(500000, 500000, { now });
      expect(resEq.winner).toBe('equal');
      expect(resEq.diff).toBe(0);
    });

    test('syncWithCloudWorker handles success and rollback branches', async () => {
      // 1. Missing state and missing storage backup
      const rNoState = await persistence.syncWithCloudWorker({ state: null, storage: { getItem: () => null } });
      expect(rNoState.ok).toBe(false);
      expect(rNoState.error).toContain('No state available to sync');

      // 2. Missing transport function
      const rNoTransport = await persistence.syncWithCloudWorker({ state: { state_revision: 1 } });
      expect(rNoTransport.ok).toBe(false);
      expect(rNoTransport.error).toContain('Transport function required');

      // 3. Transport rejection with storage rollback
      let restored = null;
      const mockStorage = {
        getItem: () => JSON.stringify({ state_revision: 1, backup: true }),
        setItem: (k, v) => { restored = v; }
      };
      const rRejected = await persistence.syncWithCloudWorker({
        state: { state_revision: 2 },
        storage: mockStorage,
        transportFn: async () => ({ ok: false, error: 'Network 500' })
      });
      expect(rRejected.ok).toBe(false);
      expect(rRejected.rolledBack).toBe(true);
      expect(restored).toContain('backup');

      // 4. Successful sync reading various revision fields
      const rSucc1 = await persistence.syncWithCloudWorker({
        state: { state_revision: 1 },
        transportFn: async () => ({ ok: true, stateRevision: 99 })
      });
      expect(rSucc1.ok).toBe(true);
      expect(rSucc1.stateRevision).toBe(99);

      const rSucc2 = await persistence.syncWithCloudWorker({
        state: { cloudConfig: { stateRevision: 42 } },
        transportFn: async () => ({ ok: true })
      });
      expect(rSucc2.ok).toBe(true);
      expect(rSucc2.stateRevision).toBe(42);

      const rSucc3 = await persistence.syncWithCloudWorker({
        state: { state_revision: 7 },
        transportFn: async () => ({ ok: true })
      });
      expect(rSucc3.ok).toBe(true);
      expect(rSucc3.stateRevision).toBe(7);

      const rSuccDefault = await persistence.syncWithCloudWorker({
        state: {},
        transportFn: async () => ({ ok: true })
      });
      expect(rSuccDefault.ok).toBe(true);
      expect(rSuccDefault.stateRevision).toBe(1);
    });

    test('resolveRoutineConflicts covers all version/time permutations and callbacks', () => {
      // Local version > remote version
      const rLocalVer = persistence.resolveRoutineConflicts(
        { id: 'r1', version: 5 },
        { id: 'r1', version: 2 }
      );
      expect(rLocalVer.winner).toBe('local');

      // Remote version > local version
      const rRemoteVer = persistence.resolveRoutineConflicts(
        { id: 'r1', version: 1 },
        { id: 'r1', version: 3 }
      );
      expect(rRemoteVer.winner).toBe('remote');

      // Equal version: remote time > local time
      const rRemoteTime = persistence.resolveRoutineConflicts(
        { id: 'r1', version: 1, updated_at: '2026-01-01T00:00:00Z' },
        { id: 'r1', version: 1, updated_at: '2026-01-02T00:00:00Z' }
      );
      expect(rRemoteTime.winner).toBe('remote');

      // Equal version: local time >= remote time
      const rLocalTime = persistence.resolveRoutineConflicts(
        { id: 'r1', version: 1, updated_at: '2026-01-05T00:00:00Z' },
        { id: 'r1', version: 1, updated_at: '2026-01-02T00:00:00Z' }
      );
      expect(rLocalTime.winner).toBe('local');

      // Conflict callback and rollback function
      let recordedConflict = null;
      const rWithCb = persistence.resolveRoutineConflicts(
        { id: 'r1', version: 1, val: 'a' },
        { id: 'r1', version: 2, val: 'b' },
        { onConflict: (ev) => { recordedConflict = ev; } }
      );
      expect(recordedConflict).not.toBeNull();
      expect(recordedConflict.winner).toBe('remote');
      expect(rWithCb.rollback()).toEqual({ id: 'r1', version: 1, val: 'a' });

      // Conflict callback throws error (gracefully caught)
      expect(() => {
        persistence.resolveRoutineConflicts(
          { id: 'r1', version: 1 },
          { id: 'r1', version: 2 },
          { onConflict: () => { throw new Error('Callback crashed'); } }
        );
      }).not.toThrow();

      // Identical routines (no conflict event dispatched)
      const identical = { id: 'r1', version: 1, name: 'Same' };
      const rIdentical = persistence.resolveRoutineConflicts(identical, { ...identical });
      expect(rIdentical.winner).toBe('local');
    });

    test('persistence storage and legacy migration branches', () => {
      // migrateLegacyStorage when storage is null
      expect(persistence.migrateLegacyStorage(null)).toBe(false);

      // migrateLegacyStorage when storage throws
      const throwingStorage = { getItem: () => { throw new Error('Disk dead'); } };
      expect(persistence.migrateLegacyStorage(throwingStorage)).toBe(false);

      // migrateLegacyStorage when legacy key exists and current does not
      const data = { 'eg_nexus_os_state_v5.1': '{"migrated":true}' };
      const legacyStorage = {
        getItem: k => data[k] || null,
        setItem: (k, v) => { data[k] = v; },
        removeItem: k => { delete data[k]; }
      };
      expect(persistence.migrateLegacyStorage(legacyStorage)).toBe(true);
      expect(JSON.parse(data['eg_nexus_os_v5_master_state']).migrated).toBe(true);
      expect(data['eg_nexus_os_state_v5.1']).toBeUndefined();

      // Second migration does nothing
      expect(persistence.migrateLegacyStorage(legacyStorage)).toBe(false);

      // getStorageSizeEstimate default args
      expect(typeof persistence.getStorageSizeEstimate()).toBe('number');
    });

    test('sanitizeLoadedState boundary and fallback branches', () => {
      expect(persistence.sanitizeLoadedState(null).profileName).toBe('Ali');
      expect(persistence.sanitizeLoadedState(null, null).profileName).toBe('Ali');

      const raw = {
        profileName: '  ',
        dreamMemory: 1234,
        effortMode: 'insane',
        diffOnlyMode: 'truthy',
        maxGroupTurns: 'nan',
        totalTokensUsed: -10,
        totalEstimatedCostUSD: -5,
        apiKeys: 'not_an_obj',
        appConnections: {
          '__proto__': { token: 'pollute' },
          'invalid@name!': { token: 'bad' },
          valid_app: {
            accounts: [
              '  trimmed_account  ',
              { id: 'a1', email: 'a1@test.com', displayName: 'DisplayName 1' },
              { id: 'a2', email: null, name: null }, // filtered out
              null
            ],
            token: 'valid_tok',
            mcpEnabled: true,
            connectedAt: '2026-01-01'
          }
        },
        agentsCatalog: [
          null,
          { id: '', name: '', model: '' }
        ],
        chats: [
          { id: 'same', title: 'Chat 1' },
          { id: 'same', title: 'Chat 2' }
        ]
      };

      const clean = persistence.sanitizeLoadedState(raw, {});
      expect(clean.profileName).toBe('Ali');
      expect(clean.dreamMemory).toBe('');
      expect(clean.effortMode).toBe('standard');
      expect(clean.diffOnlyMode).toBe(true);
      expect(clean.maxGroupTurns).toBe(3);
      expect(clean.totalTokensUsed).toBe(0);
      expect(clean.totalEstimatedCostUSD).toBe(0);
      expect(clean.appConnections.valid_app.accounts.length).toBe(2);
      expect(clean.appConnections.valid_app.accounts[0]).toBe('trimmed_account');
      expect(clean.appConnections.valid_app.accounts[1].name).toBe('DisplayName 1');
      expect(clean.agentsCatalog[0].name).toBe('Agent 1');
      expect(clean.chats[0].id).not.toBe(clean.chats[1].id);

      // maxGroupTurns clamping
      expect(persistence.sanitizeLoadedState({ maxGroupTurns: 0 }).maxGroupTurns).toBe(1);
      expect(persistence.sanitizeLoadedState({ maxGroupTurns: 99 }).maxGroupTurns).toBe(6);
    });
  });

  describe('Provider Registry Branches', () => {
    test('parseGithubCommits & parseGithubBranches handle null, malformed and rich entries', () => {
      expect(registry.parseGithubCommits(null)).toEqual([]);
      const commits = registry.parseGithubCommits([
        null,
        {},
        { sha: 'abcdef123456', commit: { message: 'feat: new', author: { name: 'Dev', date: '2026-01-01' } }, html_url: 'http://gh/c/1' },
        { sha: '123456789012', author: { login: 'bot' }, date: '2026-01-02' }
      ]);
      expect(commits.length).toBe(4);
      expect(commits[0].sha).toBe('');
      expect(commits[2].message).toBe('feat: new');
      expect(commits[2].author).toBe('Dev');
      expect(commits[3].author).toBe('bot');

      expect(registry.parseGithubBranches(null)).toEqual([]);
      const branches = registry.parseGithubBranches([
        null,
        { name: 'main', commit: { sha: 'sha1' }, protected: true },
        { name: 'feat' }
      ]);
      expect(branches.length).toBe(3);
      expect(branches[1].name).toBe('main');
      expect(branches[1].isProtected).toBe(true);
      expect(branches[2].commitSha).toBe('');
    });

    test('validateGoogleTokenFreshness handles various timestamps', () => {
      const fresh = registry.validateGoogleTokenFreshness(Date.now() + 100000);
      expect(fresh.fresh).toBe(true);
      expect(fresh.needsRefresh).toBe(false);

      const stale = registry.validateGoogleTokenFreshness(Date.now() + 10000);
      expect(stale.fresh).toBe(false);
      expect(stale.needsRefresh).toBe(true);

      const invalid = registry.validateGoogleTokenFreshness('not_a_ts');
      expect(invalid.fresh).toBe(false);
      expect(invalid.needsRefresh).toBe(true);
    });

    test('isolateMultiAccountSession handles edge cases and account matching', () => {
      expect(registry.isolateMultiAccountSession(null, 'gmail', 'a1')).toBeNull();
      expect(registry.isolateMultiAccountSession({}, 'gmail', 'a1')).toBeNull();

      const conns = {
        gmail: {
          accounts: [
            { id: 'acc1', email: 'acc1@gmail.com', token: 'tok1' },
            { id: 'acc2', email: 'acc2@gmail.com', token: 'tok2' }
          ]
        }
      };
      expect(registry.isolateMultiAccountSession(conns, 'gmail', 'acc1').token).toBe('tok1');
      expect(registry.isolateMultiAccountSession(conns, 'gmail', 'acc2').email).toBe('acc2@gmail.com');
      expect(registry.isolateMultiAccountSession(conns, 'gmail', 'nonexistent')).toBeNull();
    });

    test('isTelegramRateLimited detects high frequency bursts', () => {
      expect(registry.isTelegramRateLimited(null)).toBe(false);
      expect(registry.isTelegramRateLimited([Date.now(), Date.now() - 200])).toBe(false);
      const burst = Array.from({ length: 35 }, () => Date.now());
      expect(registry.isTelegramRateLimited(burst)).toBe(true);
    });

    test('formatMcpToolCall handles args default and structure', () => {
      const call = registry.formatMcpToolCall('srv1', 'tool1');
      expect(call.jsonrpc).toBe('2.0');
      expect(call.method).toBe('tools/call');
      expect(call.params).toEqual({
        name: 'tool1',
        server: 'srv1',
        arguments: {}
      });
      const callWithArgs = registry.formatMcpToolCall('srv2', 'tool2', { p: 'val' });
      expect(callWithArgs.params.arguments).toEqual({ p: 'val' });
    });

    test('resolveProviderModelId handles default and special models with openRouter options', () => {
      expect(registry.resolveProviderModelId()).toBe('gemini-3.8-flash');
      expect(registry.resolveProviderModelId('deepseek-flash')).toBe('deepseek-flash');
      expect(registry.resolveProviderModelId('deepseek-v4-pro')).toBe('deepseek-v4-pro');
      expect(registry.resolveProviderModelId('kimi-k2.7-code')).toBe('kimi-k2.7-code');
      expect(registry.resolveProviderModelId('kimi-k3')).toBe('kimi-k3');
      expect(registry.resolveProviderModelId('grok-4.7')).toBe('grok-4.7');

      // OpenRouter mapping branches
      expect(registry.resolveProviderModelId('deepseek-v4-pro', true)).toBe('deepseek/deepseek-v4-pro');
      expect(registry.resolveProviderModelId('deepseek-flash', true)).toBe('deepseek/deepseek-flash');
      expect(registry.resolveProviderModelId('kimi-k3', true)).toBe('moonshotai/kimi-k3');
      expect(registry.resolveProviderModelId('kimi', true)).toBe('moonshotai/kimi-k2.7-code');
      expect(registry.resolveProviderModelId('grok-4.7', true)).toBe('x-ai/grok-4.7');
      expect(registry.resolveProviderModelId('gemini-3.8-flash', true)).toBe('google/gemini-3.8-flash');
    });

    test('recordModelTokenAndCostUsage handles various models and state integration', () => {
      const mockState = { totalTokensUsed: 10, totalEstimatedCostUSD: 0.05 };
      globalThis.appState = mockState;

      const rFlash = registry.recordModelTokenAndCostUsage('deepseek-flash', 'hi', 'there');
      expect(rFlash.ratePerMillion).toBe(0.014);

      const rPro = registry.recordModelTokenAndCostUsage('deepseek-v4-pro', '', '', { totalTokenCount: 50 });
      expect(rPro.usedTokens).toBe(50);
      expect(rPro.ratePerMillion).toBe(0.28);

      const rKimi = registry.recordModelTokenAndCostUsage('kimi', '', '', { total_tokens: 30 });
      expect(rKimi.ratePerMillion).toBe(0.15);

      const rGrok = registry.recordModelTokenAndCostUsage('grok', 'a', 'b');
      expect(rGrok.ratePerMillion).toBe(0.30);

      delete globalThis.appState;
    });

    test('isAppGenuinelyConnected detects various valid connection types', () => {
      expect(registry.isAppGenuinelyConnected('github')).toBe(false);

      globalThis.appState = {
        appConnections: {
          github: { owner: 'myorg', repo: 'myrepo' },
          clash_royale: { playerTag: '#PLAYER1' },
          clash_tok: { token: 'valid_tok' },
          mcp_app: { mcpEnabled: true },
          multi: { accounts: [{ id: 'a1' }] },
          empty_app: {}
        }
      };

      expect(registry.isAppGenuinelyConnected('github')).toBe(true);
      expect(registry.isAppGenuinelyConnected('clash_royale')).toBe(true);
      expect(registry.isAppGenuinelyConnected('clash_tok')).toBe(true);
      expect(registry.isAppGenuinelyConnected('mcp_app')).toBe(true);
      expect(registry.isAppGenuinelyConnected('multi')).toBe(true);
      expect(registry.isAppGenuinelyConnected('empty_app')).toBe(false);

      delete globalThis.appState;
    });

    test('resolveRoutineConflicts dispatches window event if window.dispatchEvent exists', () => {
      const origWin = globalThis.window;
      let dispatched = null;
      globalThis.window = {
        dispatchEvent: (ev) => { dispatched = ev; }
      };
      globalThis.CustomEvent = class CustomEvent {
        constructor(type, detail) { this.type = type; this.detail = detail; }
      };

      const res = registry.resolveRoutineConflicts(
        { id: 'r1', version: 1, name: 'Local' },
        { id: 'r1', version: 2, name: 'Remote' }
      );
      expect(res.winner).toBe('remote');
      expect(dispatched).not.toBeNull();
      expect(dispatched.type).toBe('nexus:conflict');

      globalThis.window = origWin;
    });
  });
});
