/**
 * EG-Nexus-OS — Provider Contracts, Resilience & Security Suite
 * Comprehensive contract verification for GitHub, Google, Telegram, Supabase, Cloudflare, and MCP
 */

const registry = require('../src/providers/registry.js');
const approvals = require('../src/security/approvals.js');

async function getApprovedToken(providerId, action, params = {}) {
  const ui = approvals.getUiState();
  if (ui) ui._isResolvingApproval = false;
  let token = null;
  approvals.triggerApprovalGate({
    reason: 'Test approval',
    providerId,
    action,
    params,
    onApprove: (t) => { token = t; }
  });
  await approvals.resolveApprovalGate(true);
  if (ui) ui._isResolvingApproval = false;
  return token;
}

describe('Provider Contracts & Resilience Suite', () => {
  // =========================================================================
  // 1. GitHub API Contract
  // =========================================================================
  describe('GitHub API Contract', () => {
    test('validateGithubPAT accepts valid classic and fine-grained personal access tokens', () => {
      expect(registry.validateGithubPAT('ghp_TEST_DUMMY_KEY_NOT_A_SECRET_01_CLASSIC')).toBe(true);
      expect(registry.validateGithubPAT('github_pat_TEST_DUMMY_KEY_NOT_A_SECRET_01_FINE_GRAINED')).toBe(true);
      expect(registry.validateGithubPAT('gho_TEST_DUMMY_KEY_NOT_A_SECRET_01_OAUTH')).toBe(true);
    });

    test('validateGithubPAT rejects invalid, short, or malformed tokens', () => {
      expect(registry.validateGithubPAT('')).toBe(false);
      expect(registry.validateGithubPAT('TEST_DUMMY_SHORT')).toBe(false);
      expect(registry.validateGithubPAT('not_a_github_pat')).toBe(false);
      expect(registry.validateGithubPAT(null)).toBe(false);
    });

    test('validateGithubRepo accepts valid repository and owner identifiers', () => {
      expect(registry.validateGithubRepo('octocat', 'Hello-World')).toBe(true);
      expect(registry.validateGithubRepo('ali-nexus', 'eg_nexus_os.v5')).toBe(true);
    });

    test('validateGithubRepo rejects shell injections and unsafe path traversals', () => {
      expect(registry.validateGithubRepo('octocat', 'repo; rm -rf /')).toBe(false);
      expect(registry.validateGithubRepo('../owner', 'repo')).toBe(false);
      expect(registry.validateGithubRepo('owner', 'repo<script>')).toBe(false);
      expect(registry.validateGithubRepo(null, 'repo')).toBe(false);
    });

    test('parseGithubCommits normalizes raw commit payload into schema', () => {
      const rawCommits = [
        {
          sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
          commit: {
            message: 'feat: implement AES-GCM session reload',
            author: { name: 'Nexus Dev', date: '2026-11-10T12:00:00Z' }
          },
          html_url: 'https://github.com/ali/repo/commit/6dcb09b'
        }
      ];
      const parsed = registry.parseGithubCommits(rawCommits);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].sha).toBe('6dcb09b5b57875f334f61aebed695e2e4193db5e');
      expect(parsed[0].shortSha).toBe('6dcb09b');
      expect(parsed[0].message).toBe('feat: implement AES-GCM session reload');
      expect(parsed[0].author).toBe('Nexus Dev');
      expect(parsed[0].date).toBe('2026-11-10T12:00:00Z');
      expect(parsed[0].url).toBe('https://github.com/ali/repo/commit/6dcb09b');
    });

    test('parseGithubBranches formats branch names and protected status', () => {
      const rawBranches = [
        { name: 'main', commit: { sha: '11223344' }, protected: true },
        { name: 'feat/audio', commit: { sha: '55667788' }, protected: false }
      ];
      const parsed = registry.parseGithubBranches(rawBranches);
      expect(parsed).toEqual([
        { name: 'main', commitSha: '11223344', isProtected: true },
        { name: 'feat/audio', commitSha: '55667788', isProtected: false }
      ]);
    });

    test('formatProviderError handles GitHub 401 unauthorized with token quarantine flag', () => {
      let quarantinedProvider = null;
      const formatted = registry.formatProviderError(
        { status: 401, message: 'Bad credentials' },
        'github',
        { quarantineToken: p => { quarantinedProvider = p; } }
      );
      expect(formatted.status).toBe(401);
      expect(formatted.error).toBe('Unauthorized');
      expect(formatted.quarantined).toBe(true);
      expect(quarantinedProvider).toBe('github');
    });
  });

  // =========================================================================
  // 2. Google OAuth / Gmail / YouTube Contracts
  // =========================================================================
  describe('Google OAuth / Gmail / YouTube Contracts', () => {
    test('validateRequestedGoogleScope accepts legitimate Google OAuth scopes', () => {
      expect(registry.validateRequestedGoogleScope('https://www.googleapis.com/auth/gmail.readonly')).toBe(true);
      expect(registry.validateRequestedGoogleScope('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/calendar')).toBe(true);
    });

    test('validateRequestedGoogleScope rejects non-Google URLs or malformed scopes', () => {
      expect(registry.validateRequestedGoogleScope('https://evil-hacker.com/auth/steal')).toBe(false);
      expect(registry.validateRequestedGoogleScope('')).toBe(false);
      expect(registry.validateRequestedGoogleScope(null)).toBe(false);
    });

    test('validateProviderScope correctly checks Gmail scopes for read vs send operations', () => {
      const readonlyScope = 'https://www.googleapis.com/auth/gmail.readonly';
      const sendScope = 'https://www.googleapis.com/auth/gmail.send';

      // Read action allowed with readonly scope
      expect(registry.validateProviderScope('gmail', 'list', readonlyScope)).toBe(true);
      expect(registry.validateProviderScope('gmail', 'search', readonlyScope)).toBe(true);

      // Send action blocked with only readonly scope
      expect(registry.validateProviderScope('gmail', 'send', readonlyScope)).toBe(false);

      // Send action allowed with send scope
      expect(registry.validateProviderScope('gmail', 'send', sendScope)).toBe(true);
      expect(registry.validateProviderScope('gmail', 'delete', sendScope)).toBe(true);
    });

    test('validateProviderScope validates YouTube upload and viewing scopes', () => {
      const uploadScope = 'https://www.googleapis.com/auth/youtube.upload';
      const readonlyScope = 'https://www.googleapis.com/auth/youtube.readonly';

      expect(registry.validateProviderScope('youtube', 'channel_stats', readonlyScope)).toBe(true);
      expect(registry.validateProviderScope('youtube', 'shorts_publish', readonlyScope)).toBe(false);
      expect(registry.validateProviderScope('youtube', 'shorts_publish', uploadScope)).toBe(true);
    });

    test('validateGoogleTokenFreshness determines expiration and refresh requirements', () => {
      const now = Date.now();
      // Expiring in 10 minutes (fresh)
      const freshCheck = registry.validateGoogleTokenFreshness(now + 600 * 1000);
      expect(freshCheck.fresh).toBe(true);
      expect(freshCheck.needsRefresh).toBe(false);

      // Expiring in 30 seconds (needs refresh)
      const soonExpiringCheck = registry.validateGoogleTokenFreshness(now + 30 * 1000);
      expect(soonExpiringCheck.fresh).toBe(false);
      expect(soonExpiringCheck.needsRefresh).toBe(true);

      // Already expired
      const expiredCheck = registry.validateGoogleTokenFreshness(now - 1000);
      expect(expiredCheck.fresh).toBe(false);
      expect(expiredCheck.needsRefresh).toBe(true);
    });

    test('formatGoogleRefreshTokenRequest creates RFC 6749 compliant token refresh request', () => {
      const payload = registry.formatGoogleRefreshTokenRequest({
        clientId: 'client_id_123',
        clientSecret: 'client_secret_xyz',
        refreshToken: '1//refresh_token_abc'
      });
      expect(payload).toEqual({
        grant_type: 'refresh_token',
        client_id: 'client_id_123',
        client_secret: 'client_secret_xyz',
        refresh_token: '1//refresh_token_abc'
      });
      expect(registry.formatGoogleRefreshTokenRequest({})).toBeNull();
    });

    test('isolateMultiAccountSession extracts target account token without leaking sibling accounts', () => {
      const appConnections = {
        gmail: {
          accounts: [
            { id: 'work_acc', email: 'work@nexus.org', token: 'ya29.work_token_secret' },
            { id: 'personal_acc', email: 'personal@gmail.com', token: 'ya29.personal_token_secret' }
          ]
        }
      };

      const workSession = registry.isolateMultiAccountSession(appConnections, 'gmail', 'work_acc');
      expect(workSession.accountId).toBe('work_acc');
      expect(workSession.email).toBe('work@nexus.org');
      expect(workSession.token).toBe('ya29.work_token_secret');

      const nonExistent = registry.isolateMultiAccountSession(appConnections, 'gmail', 'unknown_acc');
      expect(nonExistent).toBeNull();
    });

    test('getAccountScopedKey formats compound keys correctly', () => {
      expect(registry.getAccountScopedKey('gmail', 'work_acc')).toBe('gmail_work_acc');
      expect(registry.getAccountScopedKey('youtube', 'channel_2')).toBe('youtube_channel_2');
    });
  });

  // =========================================================================
  // 3. Telegram Bot API Contract
  // =========================================================================
  describe('Telegram Bot API Contract', () => {
    test('validateTelegramToken checks standard bot token format', () => {
      expect(registry.validateTelegramToken('123456789:AAE-FooBarTelegramBotTokenSecret_0123456789')).toBe(true);
      expect(registry.validateTelegramToken('invalid_token')).toBe(false);
      expect(registry.validateTelegramToken('123:abc')).toBe(false);
      expect(registry.validateTelegramToken(null)).toBe(false);
    });

    test('validateTelegramWebhookLease enforces HTTPS protocol and secret format', () => {
      expect(registry.validateTelegramWebhookLease('https://api.nexus.org/tg/webhook', 'secret_token_123')).toBe(true);
      expect(registry.validateTelegramWebhookLease('http://insecure.org/webhook', 'secret')).toBe(false);
      expect(registry.validateTelegramWebhookLease('https://api.nexus.org/webhook', 'bad secret with spaces')).toBe(false);
    });

    test('isTelegramRateLimited detects pairing and message flooding', () => {
      const now = Date.now();
      const withinWindow = Array(35).fill(0).map((_, i) => now - (i * 20));
      expect(registry.isTelegramRateLimited(withinWindow, 30, 1000)).toBe(true);

      const sparse = [now - 2000, now - 1500, now - 100];
      expect(registry.isTelegramRateLimited(sparse, 30, 1000)).toBe(false);
    });

    test('executeWithRetry retries on 429 rate limit with exponential backoff and succeeds', async () => {
      let attempts = 0;
      const retryLog = [];

      const mockTelegramSend = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('Too Many Requests: retry after 1');
          err.status = 429;
          throw err;
        }
        return { ok: true, message_id: 9988 };
      });

      const res = await registry.executeWithRetry(mockTelegramSend, {
        maxRetries: 3,
        baseDelayMs: 10,
        backoffFactor: 2,
        onRetry: entry => retryLog.push(entry)
      });

      expect(res.ok).toBe(true);
      expect(attempts).toBe(3);
      expect(retryLog).toHaveLength(2);
      expect(retryLog[0].attempt).toBe(1);
      expect(retryLog[0].delayMs).toBe(10);
      expect(retryLog[1].attempt).toBe(2);
      expect(retryLog[1].delayMs).toBe(20);
    });

    test('executeWithRetry exhausts retries on persistent server error and throws', async () => {
      let attempts = 0;
      const failingFn = jest.fn(async () => {
        attempts++;
        const err = new Error('502 Bad Gateway');
        err.status = 502;
        throw err;
      });

      await expect(registry.executeWithRetry(failingFn, {
        maxRetries: 2,
        baseDelayMs: 5
      })).rejects.toThrow('502 Bad Gateway');

      expect(attempts).toBe(3); // 1 initial + 2 retries
    });

    test('executeWithRetry does not retry on non-retryable 401/403 client errors', async () => {
      let attempts = 0;
      const unauthFn = jest.fn(async () => {
        attempts++;
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      });

      await expect(registry.executeWithRetry(unauthFn, { maxRetries: 3, baseDelayMs: 5 })).rejects.toThrow('Unauthorized');
      expect(attempts).toBe(1);
    });
  });

  // =========================================================================
  // 4. Supabase & Cloudflare Worker Contracts
  // =========================================================================
  describe('Supabase & Cloudflare Worker Contracts', () => {
    test('deduplicateKVEntries deduplicates and resolves newer records by timestamp', () => {
      const local = [
        { id: 'routine_1', title: 'Squat 60FPS Local', updated_at: '2026-11-10T10:00:00Z' },
        { id: 'routine_2', title: 'Clash Viral Hook', updated_at: '2026-11-10T11:00:00Z' }
      ];
      const remote = [
        { id: 'routine_1', title: 'Squat 60FPS Remote Updated', updated_at: '2026-11-10T12:00:00Z' },
        { id: 'routine_3', title: 'New Remote Routine', updated_at: '2026-11-10T13:00:00Z' }
      ];

      const deduplicated = registry.deduplicateKVEntries(local, remote);
      expect(deduplicated).toHaveLength(3);

      const r1 = deduplicated.find(r => r.id === 'routine_1');
      expect(r1.title).toBe('Squat 60FPS Remote Updated');

      const r2 = deduplicated.find(r => r.id === 'routine_2');
      expect(r2.title).toBe('Clash Viral Hook');

      const r3 = deduplicated.find(r => r.id === 'routine_3');
      expect(r3.title).toBe('New Remote Routine');
    });

    test('resolveRoutineConflicts implements Last-Write-Wins (LWW) version comparison', () => {
      const local = { id: 'rt_1', version: 3, updated_at: '2026-11-10T09:00:00Z' };
      const remote = { id: 'rt_1', version: 2, updated_at: '2026-11-10T11:00:00Z' };

      const resLocalWinner = registry.resolveRoutineConflicts(local, remote);
      expect(resLocalWinner.winner).toBe('local');
      expect(resLocalWinner.resolved.version).toBe(3);

      const localOlder = { id: 'rt_1', version: 4, updated_at: '2026-11-10T09:00:00Z' };
      const remoteNewer = { id: 'rt_1', version: 5, updated_at: '2026-11-10T09:00:00Z' };

      const resRemoteWinner = registry.resolveRoutineConflicts(localOlder, remoteNewer);
      expect(resRemoteWinner.winner).toBe('remote');
      expect(resRemoteWinner.resolved.version).toBe(5);
    });

    test('resolveRoutineConflicts falls back to timestamp comparison when versions match', () => {
      const local = { id: 'rt_1', version: 2, updated_at: '2026-11-10T10:00:00Z' };
      const remote = { id: 'rt_1', version: 2, updated_at: '2026-11-10T12:00:00Z' };

      const conflictRes = registry.resolveRoutineConflicts(local, remote);
      expect(conflictRes.winner).toBe('remote');
      expect(conflictRes.resolved.updated_at).toBe('2026-11-10T12:00:00Z');
    });
  });

  // =========================================================================
  // 5. MCP Server Contract
  // =========================================================================
  describe('MCP Server Contract', () => {
    test('isMcpServerEnabled returns true only when mcpEnabled is explicitly true', () => {
      const connections = {
        sentry: { mcpEnabled: true },
        tailscale: { mcpEnabled: false },
        picsart: {}
      };
      expect(registry.isMcpServerEnabled('sentry', connections)).toBe(true);
      expect(registry.isMcpServerEnabled('tailscale', connections)).toBe(false);
      expect(registry.isMcpServerEnabled('picsart', connections)).toBe(false);
      expect(registry.isMcpServerEnabled('unknown', connections)).toBe(false);
    });

    test('formatMcpToolCall formats valid JSON-RPC 2.0 tool invocation', () => {
      const toolCall = registry.formatMcpToolCall('sentry', 'get_issue', { issue_id: 'ISSUE-123' });
      expect(toolCall.jsonrpc).toBe('2.0');
      expect(toolCall.method).toBe('tools/call');
      expect(toolCall.params.server).toBe('sentry');
      expect(toolCall.params.name).toBe('get_issue');
      expect(toolCall.params.arguments).toEqual({ issue_id: 'ISSUE-123' });
    });

    test('validateMcpToolApproval identifies mutating or sensitive tools requiring modal approval', () => {
      expect(registry.validateMcpToolApproval('neon', 'execute_sql')).toBe(true);
      expect(registry.validateMcpToolApproval('github', 'delete_branch')).toBe(true);
      expect(registry.validateMcpToolApproval('termux', 'write_file')).toBe(true);

      expect(registry.validateMcpToolApproval('sentry', 'get_issue')).toBe(false);
      expect(registry.validateMcpToolApproval('context7', 'search_docs')).toBe(false);
    });
  });

  // =========================================================================
  // 6. Request Execution Pipeline & Approval Queue Requirements
  // =========================================================================
  describe('Request Execution Pipeline & Approval Queue Requirements', () => {
    test('isMutatingOrSensitiveAction flags sensitive actions across providers', () => {
      expect(registry.isMutatingOrSensitiveAction('gmail', 'send')).toBe(true);
      expect(registry.isMutatingOrSensitiveAction('gmail', 'delete')).toBe(true);
      expect(registry.isMutatingOrSensitiveAction('gmail', 'read')).toBe(false);

      expect(registry.isMutatingOrSensitiveAction('termux', 'exec')).toBe(true);
      expect(registry.isMutatingOrSensitiveAction('termux', 'read_file')).toBe(false);

      expect(registry.isMutatingOrSensitiveAction('youtube', 'shorts_publish')).toBe(true);
      expect(registry.isMutatingOrSensitiveAction('youtube', 'channel_stats')).toBe(false);

      expect(registry.isMutatingOrSensitiveAction('routines', 'delete_routine')).toBe(true);
    });

    test('executeProviderRequest blocks MCP execution when server is disabled', async () => {
      const appConnections = {
        picsart: { mcpEnabled: false }
      };

      const result = await registry.executeProviderRequest({
        providerId: 'picsart',
        action: 'generate_image',
        token: 'key-123',
        appConnections
      });

      expect(result.status).toBe(403);
      expect(result.error).toBe('MCP_DISABLED');
      expect(result.message).toContain('is disabled');
    });

    test('executeProviderRequest blocks sensitive actions without approval and triggers approval gate', async () => {
      let gateTriggered = false;
      let gateReason = '';

      const result = await registry.executeProviderRequest({
        providerId: 'termux',
        action: 'exec',
        token: 'bridge-token-xyz',
        grantedScopes: ['terminal:exec'],
        approved: false,
        approvalGateHandler: ({ reason }) => {
          gateTriggered = true;
          gateReason = reason;
        }
      });

      expect(result.status).toBe(403);
      expect(result.error).toBe('APPROVAL_REQUIRED');
      expect(result.pendingApproval).toBe(true);
      expect(gateTriggered).toBe(true);
      expect(gateReason).toContain('exec on termux');
    });

    test('Negative Security Test: requireApproval: false CANNOT bypass approval for sensitive actions (github:push / gmail:send)', async () => {
      // Attempt to bypass approval on sensitive action github:push by passing requireApproval: false
      const resGithub = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_valid_test_token',
        grantedScopes: ['repo'],
        requireApproval: false, // Malicious or buggy caller attempt to bypass
        approvalToken: null,
        executeFn: async () => ({ pushed: true })
      });

      expect(resGithub.status).toBe(403);
      expect(resGithub.error).toBe('APPROVAL_REQUIRED');
      expect(resGithub.pendingApproval).toBe(true);

      // Attempt to bypass approval on sensitive action gmail:send by passing requireApproval: false
      const resGmail = await registry.executeProviderRequest({
        providerId: 'gmail',
        action: 'send',
        token: 'ya29.valid_test_token',
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send'],
        requireApproval: false, // Malicious or buggy caller attempt to bypass
        approvalToken: null,
        executeFn: async () => ({ sent: true })
      });

      expect(resGmail.status).toBe(403);
      expect(resGmail.error).toBe('APPROVAL_REQUIRED');
      expect(resGmail.pendingApproval).toBe(true);
    });

    test('executeProviderRequest succeeds when sensitive action is approved', async () => {
      const approvalToken = await getApprovedToken('termux', 'exec');
      const result = await registry.executeProviderRequest({
        providerId: 'termux',
        action: 'exec',
        token: 'bridge-token-xyz',
        grantedScopes: ['terminal:exec'],
        approvalToken,
        executeFn: async () => ({ stdout: 'Termux bridge active (60FPS verified)' })
      });

      expect(result.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('Termux bridge active (60FPS verified)');
    });

    test('executeProviderRequest blocks action with insufficient scopes', async () => {
      const result = await registry.executeProviderRequest({
        providerId: 'gmail',
        action: 'send',
        token: 'ya29.oauth-token',
        grantedScopes: 'https://www.googleapis.com/auth/gmail.readonly',
        approved: true
      });

      expect(result.status).toBe(403);
      expect(result.error).toBe('SCOPE_INSUFFICIENT');
    });

    test('executeProviderRequest validates token requirement for non-anonymous providers', async () => {
      const result = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'commits',
        token: '',
        grantedScopes: ['repo'],
        approved: true
      });

      expect(result.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
    });
  });

  // =========================================================================
  // 7. Memory Cleanup & Sync Concurrency
  // =========================================================================
  describe('Memory Cleanup & Sync Concurrency', () => {
    test('cleanMemoryState trims messages exceeding pruneThreshold to prevent RAM bloat', () => {
      const largeChatState = {
        chats: [
          {
            id: 'c1',
            messages: Array(150).fill(0).map((_, i) => ({ id: `msg_${i}`, text: `message ${i}` }))
          },
          {
            id: 'c2',
            messages: [{ id: 'msg_0', text: 'small chat' }]
          }
        ]
      };

      const cleaned = registry.cleanMemoryState(largeChatState, 50);
      expect(cleaned.chats[0].messages).toHaveLength(50);
      expect(cleaned.chats[0].messages[49].id).toBe('msg_149');
      expect(cleaned.chats[1].messages).toHaveLength(1);
    });

    test('createSyncLock serializes concurrent async sync operations', async () => {
      const lock = registry.createSyncLock();
      const executionOrder = [];

      async function worker(id, delayMs) {
        await lock.acquire();
        executionOrder.push(`start_${id}`);
        await new Promise(r => setTimeout(r, delayMs));
        executionOrder.push(`end_${id}`);
        lock.release();
      }

      await Promise.all([
        worker('A', 30),
        worker('B', 10),
        worker('C', 5)
      ]);

      expect(executionOrder).toEqual([
        'start_A', 'end_A',
        'start_B', 'end_B',
        'start_C', 'end_C'
      ]);
      expect(lock.isLocked()).toBe(false);
    });
  });

  // =========================================================================
  // 8. Provider Capability Tiers Contract
  // =========================================================================
  describe('Provider Capability Tiers Contract', () => {
    test('exposes PROVIDER_TIERS enumeration', () => {
      expect(registry.PROVIDER_TIERS).toEqual({
        PRODUCTION_READY: 'Production-ready',
        CONTRACT_TESTED: 'Contract-tested',
        BETA: 'Beta',
        CATALOG_ONLY: 'Catalog-only'
      });
    });

    test('getProviderTier returns Production-ready for Google, GitHub, Cloudflare, and Supabase', () => {
      const prodList = ['gmail', 'gcal', 'calendar', 'drive', 'google_drive', 'youtube', 'github', 'cloudflare', 'supabase', 'gworkspace'];
      prodList.forEach(id => {
        expect(registry.getProviderTier(id)).toBe('Production-ready');
        const cfg = registry.getProviderConfig(id);
        expect(cfg).toBeDefined();
        expect(cfg.tier).toBe('Production-ready');
      });
    });

    test('getProviderTier returns Contract-tested for Telegram, Termux, Clash Royale, and CoinGecko', () => {
      const contractList = ['telegram', 'termux', 'clash_royale', 'coingecko'];
      contractList.forEach(id => {
        expect(registry.getProviderTier(id)).toBe('Contract-tested');
        const cfg = registry.getProviderConfig(id);
        expect(cfg).toBeDefined();
        expect(cfg.tier).toBe('Contract-tested');
      });
    });

    test('getProviderTier returns Beta for Beta catalog apps', () => {
      const betaList = ['instagram', 'ig_creator', 'meta_ads', 'shopify', 'hubspot', 'morningstar', 'mercury', 'zoho'];
      betaList.forEach(id => {
        expect(registry.getProviderTier(id)).toBe('Beta');
        const cfg = registry.getProviderConfig(id);
        expect(cfg).toBeDefined();
        expect(cfg.tier).toBe('Beta');
      });
    });

    test('getProviderTier returns Catalog-only for MCP servers, Web Search, Tavily, and other catalog apps', () => {
      const adapterList = ['tavily', 'web_search', 'picsart', 'tailscale', 'sentry', 'linear'];
      adapterList.forEach(id => {
        expect(registry.getProviderTier(id)).toBe('Catalog-only');
        const cfg = registry.getProviderConfig(id);
        expect(cfg).toBeDefined();
        expect(cfg.tier).toBe('Catalog-only');
      });
    });

    test('every catalog entry in APPS_CATALOG has a valid tier attribute', () => {
      expect(registry.APPS_CATALOG.length).toBeGreaterThan(50);
      registry.APPS_CATALOG.forEach(app => {
        expect(app.tier).toBeDefined();
        expect(['Production-ready', 'Contract-tested', 'Beta', 'Catalog-only']).toContain(app.tier);
      });
    });
  });
});
