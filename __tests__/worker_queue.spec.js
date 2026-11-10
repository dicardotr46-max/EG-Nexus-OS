const vm = require('vm');
const { extractFunction } = require('./test_helpers');

describe('Cloud Worker Queue & Routine Deduplication', () => {
  let context;

  beforeEach(() => {
    context = vm.createContext({
      Set,
      Map,
      Array,
      Math,
      Number,
      String,
      Date,
      Infinity
    });

    vm.runInContext(extractFunction('sanitizeRoutineId'), context);
    vm.runInContext(extractFunction('mergeCloudAndClientRoutines'), context);
  });

  describe('Cloud Worker Queue Lease & ACK Ownership', () => {
    const LEASE_DURATION_MS = 60000;

    function createMockWorkerEnv(initialCompleted = []) {
      let kvStore = {
        'default:offline_completed': JSON.stringify(initialCompleted)
      };

      return {
        NEXUS_KV: {
          get: jest.fn(async (key) => kvStore[key] || null),
          put: jest.fn(async (key, val) => { kvStore[key] = String(val); }),
          _getStore: () => kvStore
        }
      };
    }

    async function leaseMessages(env, wsPrefix = 'default:', nowTs = Date.now()) {
      const raw = await env.NEXUS_KV.get(wsPrefix + 'offline_completed') || '[]';
      let allCompleted = [];
      try { allCompleted = JSON.parse(raw); } catch (_) { allCompleted = []; }

      const deliverable = [];
      const leaseToken = 'lease_' + nowTs + '_' + Math.random().toString(36).slice(2, 8);
      const updatedList = (Array.isArray(allCompleted) ? allCompleted : []).map(m => {
        if (!m || !m.id) return null;
        if (!m.leasedUntilTs || Number(m.leasedUntilTs) <= nowTs) {
          const leasedItem = { ...m, leasedUntilTs: nowTs + LEASE_DURATION_MS, leaseId: leaseToken };
          deliverable.push(leasedItem);
          return leasedItem;
        }
        return m;
      }).filter(Boolean);

      if (deliverable.length > 0) {
        await env.NEXUS_KV.put(wsPrefix + 'offline_completed', JSON.stringify(updatedList));
      }

      return { deliverable, leaseToken };
    }

    async function handleAckOfflineMessages(body, env, wsPrefix = 'default:') {
      if (!env.NEXUS_KV) {
        return { status: 503, ok: false, error: 'NEXUS_KV binding is required' };
      }
      if (!Array.isArray(body.ackMessageIds) || !body.leaseId || typeof body.leaseId !== 'string' || !body.leaseId.trim()) {
        return {
          status: 400,
          ok: false,
          error: 'Valid ackMessageIds array and non-empty leaseId are required to ACK offline messages'
        };
      }
      const reqLeaseId = String(body.leaseId).trim();
      const ackSet = new Set(body.ackMessageIds.slice(0, 100).map(id => String(id || '')));
      const raw = await env.NEXUS_KV.get(wsPrefix + 'offline_completed') || '[]';
      let currentList = [];
      try { currentList = JSON.parse(raw); } catch (_) { currentList = []; }

      const remaining = (Array.isArray(currentList) ? currentList : []).filter(m => {
        if (!m || !m.id) return false;
        if (!ackSet.has(String(m.id))) return true;
        // Only acknowledge and remove messages matching this caller's leaseId (Fixes Reviewer #3)
        if (m.leaseId !== reqLeaseId) return true;
        return false;
      });

      await env.NEXUS_KV.put(wsPrefix + 'offline_completed', JSON.stringify(remaining));
      return { status: 200, ok: true, remainingCount: remaining.length };
    }

    it('should assign a unique leaseId and leasedUntilTs to unleased messages', async () => {
      const env = createMockWorkerEnv([
        { id: 'msg_1', text: 'Task 1 output' },
        { id: 'msg_2', text: 'Task 2 output' }
      ]);
      const nowTs = 1700000000000;

      const { deliverable, leaseToken } = await leaseMessages(env, 'default:', nowTs);

      expect(deliverable).toHaveLength(2);
      expect(deliverable[0].leaseId).toBe(leaseToken);
      expect(deliverable[0].leasedUntilTs).toBe(nowTs + LEASE_DURATION_MS);
      expect(deliverable[1].leaseId).toBe(leaseToken);
    });

    it('should not re-lease messages that are currently active under a valid unexpired lease', async () => {
      const nowTs = 1700000000000;
      const env = createMockWorkerEnv([
        { id: 'msg_active', text: 'Still active', leasedUntilTs: nowTs + 30000, leaseId: 'lease_active_1' },
        { id: 'msg_available', text: 'Available', leasedUntilTs: 0 }
      ]);

      const { deliverable, leaseToken } = await leaseMessages(env, 'default:', nowTs);

      expect(deliverable).toHaveLength(1);
      expect(deliverable[0].id).toBe('msg_available');
      expect(deliverable[0].leaseId).toBe(leaseToken);
    });

    it('should re-lease messages once their lease has expired', async () => {
      const nowTs = 1700000000000;
      const env = createMockWorkerEnv([
        { id: 'msg_expired', text: 'Timed out task', leasedUntilTs: nowTs - 5000, leaseId: 'lease_stale_old' }
      ]);

      const { deliverable, leaseToken } = await leaseMessages(env, 'default:', nowTs);

      expect(deliverable).toHaveLength(1);
      expect(deliverable[0].id).toBe('msg_expired');
      expect(deliverable[0].leaseId).toBe(leaseToken);
      expect(deliverable[0].leaseId).not.toBe('lease_stale_old');
    });

    it('should reject ACK with status 400 when leaseId is missing or empty', async () => {
      const env = createMockWorkerEnv([{ id: 'm1', leaseId: 'lease_123' }]);

      const res1 = await handleAckOfflineMessages({ ackMessageIds: ['m1'], leaseId: '' }, env);
      expect(res1.status).toBe(400);
      expect(res1.error).toContain('non-empty leaseId');

      const res2 = await handleAckOfflineMessages({ ackMessageIds: ['m1'], leaseId: '   ' }, env);
      expect(res2.status).toBe(400);

      const res3 = await handleAckOfflineMessages({ ackMessageIds: ['m1'] }, env);
      expect(res3.status).toBe(400);
    });

    it('should reject ACK with status 400 when ackMessageIds is not an array', async () => {
      const env = createMockWorkerEnv([{ id: 'm1', leaseId: 'lease_123' }]);

      const res = await handleAckOfflineMessages({ ackMessageIds: 'm1', leaseId: 'lease_123' }, env);
      expect(res.status).toBe(400);
      expect(res.error).toContain('Valid ackMessageIds array');
    });

    it('should successfully ACK and remove messages when caller owns the matching leaseId', async () => {
      const env = createMockWorkerEnv([
        { id: 'm1', text: 'Result 1', leaseId: 'lease_alpha' },
        { id: 'm2', text: 'Result 2', leaseId: 'lease_alpha' },
        { id: 'm3', text: 'Result 3', leaseId: 'lease_beta' }
      ]);

      const res = await handleAckOfflineMessages(
        { ackMessageIds: ['m1', 'm2'], leaseId: 'lease_alpha' },
        env
      );

      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
      expect(res.remainingCount).toBe(1);

      const remainingInKv = JSON.parse(await env.NEXUS_KV.get('default:offline_completed'));
      expect(remainingInKv).toHaveLength(1);
      expect(remainingInKv[0].id).toBe('m3');
    });

    it('should NEVER remove messages if the ACK caller provides a mismatched leaseId (lease ownership check)', async () => {
      const env = createMockWorkerEnv([
        { id: 'm_workerA', text: 'Belongs to Worker A', leaseId: 'lease_owned_by_A' }
      ]);

      // Attacker or late client B tries to ACK Worker A's leased message
      const res = await handleAckOfflineMessages(
        { ackMessageIds: ['m_workerA'], leaseId: 'lease_foreign_B' },
        env
      );

      expect(res.status).toBe(200);
      expect(res.remainingCount).toBe(1);

      // Message remains in KV intact because leaseId did not match
      const remaining = JSON.parse(await env.NEXUS_KV.get('default:offline_completed'));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('m_workerA');
      expect(remaining[0].leaseId).toBe('lease_owned_by_A');
    });

    it('should preserve messages whose IDs were not in ackMessageIds even under the same lease', async () => {
      const env = createMockWorkerEnv([
        { id: 'm1', leaseId: 'lease_same' },
        { id: 'm2', leaseId: 'lease_same' }
      ]);

      const res = await handleAckOfflineMessages(
        { ackMessageIds: ['m1'], leaseId: 'lease_same' },
        env
      );

      expect(res.status).toBe(200);
      expect(res.remainingCount).toBe(1);

      const remaining = JSON.parse(await env.NEXUS_KV.get('default:offline_completed'));
      expect(remaining[0].id).toBe('m2');
    });
  });

  describe('Routine ID Sanitization & Routine Deduplication', () => {
    it('should sanitize routine IDs by stripping dangerous characters and limiting length', () => {
      expect(context.sanitizeRoutineId('  rt_daily_report  ')).toBe('rt_daily_report');
      expect(context.sanitizeRoutineId('rt_<script>alert("xss")</script>')).toBe('rt_scriptalert(xss)/script');
      expect(context.sanitizeRoutineId('a'.repeat(120))).toHaveLength(80);
    });

    it('should generate fallback ID when input is empty or all characters were stripped', () => {
      const id1 = context.sanitizeRoutineId('', 3);
      expect(id1).toMatch(/^rt_\d+_3$/);

      const id2 = context.sanitizeRoutineId('   \0\t\n  ', 5);
      expect(id2).toMatch(/^rt_\d+_5$/);
    });

    it('should deduplicate routines between server and client by routine ID', () => {
      const serverRoutines = [
        { id: 'rt_clash_meta', title: 'Server Clash', schedule: 'daily_08', updatedAtTs: 1000, revision: 1 }
      ];
      const clientRoutines = [
        { id: 'rt_clash_meta', title: 'Client Clash', schedule: 'daily_08', updatedAtTs: 1000, revision: 1 }
      ];

      const merged = context.mergeCloudAndClientRoutines(serverRoutines, clientRoutines);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('rt_clash_meta');
    });

    it('should resolve conflicts by picking configuration with higher updatedAtTs', () => {
      const serverRoutines = [
        { id: 'rt_sync', title: 'Server Older Title', schedule: 'interval_6h', updatedAtTs: 2000, revision: 1 }
      ];
      const clientRoutines = [
        { id: 'rt_sync', title: 'Client Newer Title', schedule: 'interval_1h', updatedAtTs: 3000, revision: 1 }
      ];

      const merged = context.mergeCloudAndClientRoutines(serverRoutines, clientRoutines);

      expect(merged).toHaveLength(1);
      expect(merged[0].title).toBe('Client Newer Title');
      expect(merged[0].schedule).toBe('interval_1h');
      expect(merged[0].updatedAtTs).toBe(3000);
    });

    it('should resolve updatedAtTs ties by favoring the routine with higher revision', () => {
      const serverRoutines = [
        { id: 'rt_tie', title: 'Server Rev 5', updatedAtTs: 5000, revision: 5 }
      ];
      const clientRoutines = [
        { id: 'rt_tie', title: 'Client Rev 4', updatedAtTs: 5000, revision: 4 }
      ];

      const merged = context.mergeCloudAndClientRoutines(serverRoutines, clientRoutines);

      expect(merged).toHaveLength(1);
      expect(merged[0].title).toBe('Server Rev 5');
      expect(merged[0].revision).toBe(5);
    });

    it('should preserve newest execution state (lastRunTs, lastRunStatus) regardless of config age', () => {
      const serverRoutines = [
        {
          id: 'rt_exec',
          title: 'Config V1',
          updatedAtTs: 1000,
          revision: 1,
          lastRunTs: 95000,
          lastRun: '1 minute ago (Cloud)',
          lastRunStatus: 'success'
        }
      ];
      const clientRoutines = [
        {
          id: 'rt_exec',
          title: 'Config V2 (Edited)',
          updatedAtTs: 2000,
          revision: 2,
          lastRunTs: 50000,
          lastRun: '1 hour ago',
          lastRunStatus: 'idle'
        }
      ];

      const merged = context.mergeCloudAndClientRoutines(serverRoutines, clientRoutines);

      // Takes updated config from client (newer updatedAtTs)
      expect(merged[0].title).toBe('Config V2 (Edited)');
      expect(merged[0].revision).toBe(2);
      // But takes more recent execution status from server (95000 > 50000)
      expect(merged[0].lastRunTs).toBe(95000);
      expect(merged[0].lastRun).toBe('1 minute ago (Cloud)');
      expect(merged[0].lastRunStatus).toBe('success');
    });

    it('should respect deletedRoutineIds tombstones and exclude deleted routines', () => {
      const serverRoutines = [
        { id: 'rt_active', title: 'Active Routine', createdAtTs: 1000 },
        { id: 'rt_deleted', title: 'Tombstoned Routine', createdAtTs: 1000 }
      ];
      const clientRoutines = [
        { id: 'rt_active', title: 'Active Routine', createdAtTs: 1000 }
      ];
      const deletedIds = ['rt_deleted'];
      const deletedMeta = { rt_deleted: 2000 };

      const merged = context.mergeCloudAndClientRoutines(serverRoutines, clientRoutines, deletedIds, deletedMeta);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('rt_active');
    });

    it('should allow re-created routine whose createdAtTs is newer than the tombstone deletion timestamp', () => {
      const deletionTs = 2000;
      const reCreatedTs = 3000; // Created after deletion!

      const clientRoutines = [
        { id: 'rt_recreated', title: 'Re-born Routine', createdAtTs: reCreatedTs, updatedAtTs: reCreatedTs }
      ];
      const deletedIds = ['rt_recreated'];
      const deletedMeta = { rt_recreated: deletionTs };

      const merged = context.mergeCloudAndClientRoutines([], clientRoutines, deletedIds, deletedMeta);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('rt_recreated');
    });

    it('should strictly cap total merged routines to 50 items', () => {
      const serverRoutines = Array.from({ length: 40 }, (_, i) => ({
        id: `srv_rt_${i}`,
        title: `Server ${i}`
      }));
      const clientRoutines = Array.from({ length: 30 }, (_, i) => ({
        id: `cli_rt_${i}`,
        title: `Client ${i}`
      }));

      const merged = context.mergeCloudAndClientRoutines(serverRoutines, clientRoutines);

      expect(merged.length).toBeLessThanOrEqual(50);
      expect(merged.length).toBe(50);
    });
  });
});
