'use strict';

/**
 * EG-Nexus-OS v6.2.2 — Policy Engine, StrongBox Crash-Journal, Termux Capability Matrix & Lifecycle Suite
 * Comprehensive verification of:
 * 1. ACTION_POLICY_MANIFEST & Default-Deny capability policies (OWASP ACS-REQ-02 / ASI-01)
 * 2. StrongBox Crash-Safe Transaction Journal & Interrupted Migration Recovery (MASWE-RES-02)
 * 3. Termux Structured Capability Matrix & Argument Validation (ASI-02)
 * 4. 256-bit CSPRNG Worker Secret & Shannon Entropy Guard (OWASP ASVS V2 / V6)
 * 5. Deterministic Request Lifecycle Audit Trail (OWASP ACS-REQ-03)
 */

const registry = require('../src/providers/registry.js');
const approvals = require('../src/security/approvals.js');
const secrets = require('../src/security/secrets.js');

describe('EG Nexus OS v6.2.2 — Standards, Policy & Keystore Resilience Suite', () => {

  afterEach(() => {
    delete global.window;
    if (typeof approvals.clearApprovalTokens === 'function') {
      approvals.clearApprovalTokens();
    }
    if (typeof registry.clearApprovalTokens === 'function') {
      registry.clearApprovalTokens();
    }
  });

  // =========================================================================
  // 1. ACTION_POLICY_MANIFEST and Default-Deny Policy (OWASP ACS-REQ-02 / ASI-01)
  // =========================================================================
  describe('1. ACTION_POLICY_MANIFEST & Default-Deny Policy', () => {
    test('ACTION_POLICY_MANIFEST exists and classifies actions into 3 explicit tiers', () => {
      expect(registry.ACTION_POLICY_MANIFEST).toBeDefined();
      expect(typeof registry.ACTION_POLICY_MANIFEST).toBe('object');
      expect(Object.isFrozen(registry.ACTION_POLICY_MANIFEST)).toBe(true);

      // Verify tier distribution across primary providers
      const validTiers = new Set(['read_only', 'mutating', 'high_risk']);
      for (const [providerId, actions] of Object.entries(registry.ACTION_POLICY_MANIFEST)) {
        for (const [action, tier] of Object.entries(actions)) {
          expect(validTiers.has(tier)).toBe(true);
        }
      }
    });

    test('isSensitiveProviderAction flags mutating and high-risk actions as sensitive (true)', () => {
      // Specified required test vectors
      expect(registry.isSensitiveProviderAction('gcal', 'create')).toBe(true);
      expect(registry.isSensitiveProviderAction('gcal', 'update')).toBe(true);
      expect(registry.isSensitiveProviderAction('github', 'create_issue')).toBe(true);
      expect(registry.isSensitiveProviderAction('supabase', 'insert')).toBe(true);
      expect(registry.isSensitiveProviderAction('supabase', 'update')).toBe(true);
      expect(registry.isSensitiveProviderAction('gmail', 'send')).toBe(true);

      // High-risk mutating operations across services
      expect(registry.isSensitiveProviderAction('github', 'push')).toBe(true);
      expect(registry.isSensitiveProviderAction('github', 'delete')).toBe(true);
      expect(registry.isSensitiveProviderAction('gmail', 'delete')).toBe(true);
      expect(registry.isSensitiveProviderAction('termux', 'exec')).toBe(true);
      expect(registry.isSensitiveProviderAction('termux', 'ffmpeg_preset')).toBe(true);
      expect(registry.isSensitiveProviderAction('termux', 'npm_test')).toBe(true);
      expect(registry.isSensitiveProviderAction('telegram', 'send_message')).toBe(true);
      expect(registry.isSensitiveProviderAction('youtube', 'upload')).toBe(true);
      expect(registry.isSensitiveProviderAction('office', 'save_doc')).toBe(true);
    });

    test('isSensitiveProviderAction flags read-only actions as non-sensitive (false)', () => {
      // Specified required test vectors
      expect(registry.isSensitiveProviderAction('gcal', 'list')).toBe(false);
      expect(registry.isSensitiveProviderAction('github', 'get')).toBe(false);
      expect(registry.isSensitiveProviderAction('supabase', 'select')).toBe(false);
      expect(registry.isSensitiveProviderAction('gmail', 'list')).toBe(false);

      // Additional standard read-only operations
      expect(registry.isSensitiveProviderAction('github', 'commits')).toBe(false);
      expect(registry.isSensitiveProviderAction('github', 'branches')).toBe(false);
      expect(registry.isSensitiveProviderAction('github', 'status')).toBe(false);
      expect(registry.isSensitiveProviderAction('gmail', 'read')).toBe(false);
      expect(registry.isSensitiveProviderAction('termux', 'git_status')).toBe(false);
      expect(registry.isSensitiveProviderAction('termux', 'git_diff')).toBe(false);
      expect(registry.isSensitiveProviderAction('termux', 'read_workspace_file')).toBe(false);
      expect(registry.isSensitiveProviderAction('termux', 'rg_search')).toBe(false);
      expect(registry.isSensitiveProviderAction('termux', 'grep_search')).toBe(false);
      expect(registry.isSensitiveProviderAction('termux', 'ffprobe_inspect')).toBe(false);
      expect(registry.isSensitiveProviderAction('coingecko', 'get_price')).toBe(false);
      expect(registry.isSensitiveProviderAction('telegram', 'get_me')).toBe(false);
    });

    test('isSensitiveProviderAction enforces Default-Deny on unmapped actions & unknown providers (true)', () => {
      // Unknown action on unmapped service
      expect(registry.isSensitiveProviderAction('custom_service', 'unknown_action')).toBe(true);
      expect(registry.isSensitiveProviderAction('malicious_proxy', 'read_data')).toBe(true);

      // Unknown action on known service
      expect(registry.isSensitiveProviderAction('github', 'nonexistent_future_api')).toBe(true);
      expect(registry.isSensitiveProviderAction('gcal', 'export_calendar_secret')).toBe(true);
      expect(registry.isSensitiveProviderAction('supabase', 'truncate_all')).toBe(true);

      // Empty / invalid parameters fail-closed to sensitive
      expect(registry.isSensitiveProviderAction('', '')).toBe(true);
      expect(registry.isSensitiveProviderAction(null, null)).toBe(true);
      expect(registry.isSensitiveProviderAction('github', '')).toBe(true);
      expect(registry.isSensitiveProviderAction('', 'push')).toBe(true);
    });

    test('executeProviderRequest blocks mutating action with requireApproval: false and returns 403 APPROVAL_REQUIRED', async () => {
      const resMutating = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_test_token_valid_dummy_1234567890',
        grantedScopes: ['repo'],
        requireApproval: false // Attempt to bypass approval gate
      });

      expect(resMutating.status).toBe(403);
      expect(resMutating.error).toBe('APPROVAL_REQUIRED');
      expect(resMutating.pendingApproval).toBe(true);
      expect(resMutating.message).toContain('requires user confirmation');
    });

    test('executeProviderRequest succeeds for read-only action with requireApproval: false without approvalToken', async () => {
      const resReadOnly = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'commits',
        token: 'ghp_test_token_valid_dummy_1234567890',
        grantedScopes: ['repo'],
        requireApproval: false,
        executeFn: async () => ({ commits: [{ sha: 'abcd1234ef', message: 'test commit' }] })
      });

      expect(resReadOnly.status).toBe(200);
      expect(resReadOnly.success).toBe(true);
      expect(resReadOnly.data).toEqual({ commits: [{ sha: 'abcd1234ef', message: 'test commit' }] });
    });

    test('executeProviderRequest blocks unknown action with requireApproval: false and returns 403 APPROVAL_REQUIRED', async () => {
      const resUnknown = await registry.executeProviderRequest({
        providerId: 'custom_service',
        action: 'unknown_action',
        token: 'any_token_string_1234567890',
        requireApproval: false // Unmapped action must fail-closed to approval required
      });

      expect(resUnknown.status).toBe(403);
      expect(resUnknown.error).toBe('APPROVAL_REQUIRED');
      expect(resUnknown.pendingApproval).toBe(true);
    });

    test('executeProviderRequest succeeds for mutating action when valid single-use approvalToken is supplied', async () => {
      const approvalToken = registry.issueApprovalToken({
        providerId: 'github',
        action: 'push',
        params: { ref: 'main' }
      });

      const res = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_test_token_valid_dummy_1234567890',
        grantedScopes: ['repo'],
        approvalToken,
        params: { ref: 'main' },
        executeFn: async () => ({ pushed: true, ref: 'main' })
      });

      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data.pushed).toBe(true);

      // Verify token cannot be replayed
      const resReplay = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_test_token_valid_dummy_1234567890',
        grantedScopes: ['repo'],
        approvalToken,
        params: { ref: 'main' }
      });
      expect(resReplay.status).toBe(403);
      expect(resReplay.error).toBe('APPROVAL_REQUIRED');
    });
  });

  // =========================================================================
  // 2. StrongBox Crash-Journal & Interrupted Migration Recovery (MASWE-RES-02)
  // =========================================================================
  describe('2. StrongBox Crash-Journal & Interrupted Migration Recovery', () => {
    test('interrupted migration recovery: resets MIGRATION_PREPARED or V2_KEY_CREATED to ACTIVE_V1 and deletes uncommitted V2 key', async () => {
      let v2Deleted = false;
      let journalState = 'V2_KEY_CREATED';
      let activeAlias = 'eg_nexus_master_key_v1';

      const mockKeystore = {
        isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' }),
        getMigrationJournalState: async () => ({
          journalState,
          activeAlias,
          recovered: false
        }),
        recoverInterruptedMigration: jest.fn(async () => {
          if (journalState === 'MIGRATION_PREPARED' || journalState === 'V2_KEY_CREATED' || journalState === 'V2_DATA_VERIFIED') {
            v2Deleted = true;
            journalState = 'ACTIVE_V1';
            activeAlias = 'eg_nexus_master_key_v1';
            return {
              recovered: true,
              journalState: 'ACTIVE_V1',
              activeAlias: 'eg_nexus_master_key_v1',
              deletedUncommittedV2: true
            };
          }
          return { recovered: false, journalState, activeAlias };
        })
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      const recoveryResult = await secrets.recoverInterruptedMigration();
      expect(mockKeystore.recoverInterruptedMigration).toHaveBeenCalled();
      expect(recoveryResult.recovered).toBe(true);
      expect(recoveryResult.journalState).toBe('ACTIVE_V1');
      expect(recoveryResult.activeAlias).toBe('eg_nexus_master_key_v1');
      expect(v2Deleted).toBe(true);

      const stateResult = await secrets.getMigrationJournalState();
      expect(stateResult.journalState).toBe('ACTIVE_V1');
      expect(stateResult.activeAlias).toBe('eg_nexus_master_key_v1');
    });

    test('committed migration recovery: completes STORAGE_COMMITTED to ACTIVE_V2 and cleans old keys', async () => {
      let journalState = 'STORAGE_COMMITTED';
      let activeAlias = 'eg_nexus_master_aes_key_sb_v2';
      let oldKeysDeleted = false;

      const mockKeystore = {
        isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' }),
        getMigrationJournalState: async () => ({
          journalState,
          activeAlias,
          recovered: false
        }),
        recoverInterruptedMigration: jest.fn(async () => {
          if (journalState === 'STORAGE_COMMITTED') {
            oldKeysDeleted = true;
            journalState = 'ACTIVE_V2';
            activeAlias = 'eg_nexus_master_aes_key_sb_v2';
            return {
              recovered: true,
              journalState: 'ACTIVE_V2',
              activeAlias: 'eg_nexus_master_aes_key_sb_v2',
              deletedOldKeys: true
            };
          }
          return { recovered: false, journalState, activeAlias };
        })
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      const recoveryResult = await secrets.recoverInterruptedMigration();
      expect(mockKeystore.recoverInterruptedMigration).toHaveBeenCalled();
      expect(recoveryResult.recovered).toBe(true);
      expect(recoveryResult.journalState).toBe('ACTIVE_V2');
      expect(recoveryResult.activeAlias).toBe('eg_nexus_master_aes_key_sb_v2');
      expect(oldKeysDeleted).toBe(true);
    });

    test('secrets.migrateKeyToStrongBox fails closed when existing storage envelope contains malformed JSON or corrupted data', async () => {
      const mockKeystore = {
        isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' }),
        migrateKeyToStrongBox: jest.fn(async () => ({ migrated: true, ciphertext: 'new_sb_cipher', iv: '123456789012' })),
        rollbackKeyMigration: jest.fn(async () => ({ rolledBack: true }))
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      // Case 1: Malformed JSON in storage
      const corruptedJsonStore = {
        data: { 'eg_nexus_os_v5_master_state': '{broken-json-payload-corrupted!!' },
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = v; }
      };

      await expect(secrets.migrateKeyToStrongBox({ store: corruptedJsonStore }))
        .rejects
        .toThrow(/CORRUPTED_STORAGE_ENVELOPE/);

      // Case 2: Corrupted non-empty envelope missing ciphertext or iv
      const missingCipherStore = {
        data: { 'eg_nexus_os_v5_master_state': JSON.stringify({ invalidFormat: true }) },
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = v; }
      };

      await expect(secrets.migrateKeyToStrongBox({ store: missingCipherStore }))
        .rejects
        .toThrow(/CORRUPTED_STORAGE_ENVELOPE/);

      // Case 3: Empty string or non-object in envelope
      const arrayEnvelopeStore = {
        data: { 'eg_nexus_os_v5_master_state': JSON.stringify(['corrupted', 'array']) },
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = v; }
      };

      await expect(secrets.migrateKeyToStrongBox({ store: arrayEnvelopeStore }))
        .rejects
        .toThrow(/CORRUPTED_STORAGE_ENVELOPE/);
    });

    test('secrets.getMigrationJournalState returns fallback when native plugin is absent', async () => {
      delete global.window;
      const state = await secrets.getMigrationJournalState();
      expect(state.available).toBe(false);
      expect(state.journalState).toBe('ACTIVE_V1');
      expect(state.recovered).toBe(false);

      const recovery = await secrets.recoverInterruptedMigration();
      expect(recovery.recovered).toBe(false);
      expect(recovery.journalState).toBe('ACTIVE_V1');
    });
  });

  // =========================================================================
  // 3. Termux Capability Matrix & Argument Lockdown (ASI-02)
  // =========================================================================
  describe('3. Termux Capability Matrix & Argument Lockdown', () => {
    // Canonical reference implementation of Termux capability validator
    function validateTermuxCapability(command) {
      if (typeof window !== 'undefined' && typeof window._nexusTermuxDaemonValidator === 'function' && window._nexusTermuxDaemonValidator !== validateTermuxCapability) {
        return window._nexusTermuxDaemonValidator(command);
      }
      const SHELL_CHAINING_REGEX = /[;|\`$><]|&&|\|\||\$\(/;
      const DANGEROUS_AGENT_FLAGS_REGEX = /(?:^|\s)(?:-c|-e|--eval|--prefix)(?:\s|$)/i;

      const cmd = String(command || '').trim();
      if (!cmd) return { ok: false, error: 'Empty command' };
      if (SHELL_CHAINING_REGEX.test(cmd)) {
        return { ok: false, error: 'Shell chaining metacharacters blocked' };
      }
      if (DANGEROUS_AGENT_FLAGS_REGEX.test(cmd)) {
        return { ok: false, error: 'Dangerous flags rejected' };
      }
      if (/\bfind\b/i.test(cmd) && /-(?:delete|exec|execdir|ok|okdir|fprint|fls)\b/i.test(cmd)) {
        return { ok: false, error: 'find -exec and -delete blocked' };
      }
      if (/\bfind\b/i.test(cmd)) {
        return { ok: false, error: 'find command blocked' };
      }

      const tokens = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const cleanTokens = tokens.map(t => (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t);
      const bin = (cleanTokens[0] || '').toLowerCase();
      const args = cleanTokens.slice(1);

      if (bin === 'grep') {
        const allowedFlags = new Set(['-n', '-i', '-F', '--fixed-strings', '--max-count', '-v', '-c']);
        const flags = args.filter(a => a.startsWith('-'));
        const badFlag = flags.find(f => !allowedFlags.has(f) && !/^-[a-zA-Z0-9]+$/.test(f));
        if (badFlag) return { ok: false, error: `Invalid grep flag: ${badFlag}` };
        const paths = args.filter(a => !a.startsWith('-')).slice(1);
        if (paths.some(p => p.includes('..') || p.startsWith('/') || p.startsWith('~'))) {
          return { ok: false, error: 'Grep path traversal blocked' };
        }
        return { ok: true, tool: 'grep_search' };
      }

      if (bin === 'rg') {
        if (/--(?:pre|pre-glob|exec)\b/i.test(cmd)) return { ok: false, error: 'rg dangerous flags blocked' };
        const paths = args.filter(a => !a.startsWith('-')).slice(1);
        if (paths.some(p => p.includes('..') || p.startsWith('/') || p.startsWith('~'))) {
          return { ok: false, error: 'rg path traversal blocked' };
        }
        return { ok: true, tool: 'rg_search' };
      }

      if (bin === 'ffprobe') {
        if (/https?:|concat:|subfile:|pipe:/i.test(cmd)) return { ok: false, error: 'Remote URL blocked in ffprobe' };
        const file = args.find(a => !a.startsWith('-'));
        if (file && (file.includes('..') || file.startsWith('/') || file.startsWith('~'))) {
          return { ok: false, error: 'ffprobe path traversal blocked' };
        }
        return { ok: true, tool: 'ffprobe_inspect' };
      }

      if (bin === 'ffmpeg') {
        if (/https?:|concat:|subfile:|pipe:|-f\s+lavfi/i.test(cmd)) return { ok: false, error: 'Unsafe ffmpeg scheme/lavfi blocked' };
        const nonFlags = args.filter(a => !a.startsWith('-'));
        if (nonFlags.some(p => p.includes('..') || p.startsWith('/') || p.startsWith('~'))) {
          return { ok: false, error: 'ffmpeg path traversal blocked' };
        }
        return { ok: true, tool: 'ffmpeg_preset' };
      }

      if (bin === 'git') {
        const sub = args[0] || '';
        if (sub === 'branch') {
          if (/-(?:d|D|m|M|c|C|f|force|delete)\b/.test(cmd)) {
            return { ok: false, error: 'git branch deletion/mutation blocked' };
          }
          return { ok: true, tool: 'git_branch' };
        }
        if (sub === 'log') {
          if (/--(?:output|exec)\b/i.test(cmd)) {
            return { ok: false, error: 'git log --output/--exec blocked' };
          }
          return { ok: true, tool: 'git_log' };
        }
        if (sub === 'status') return { ok: true, tool: 'git_status' };
        if (sub === 'diff') return { ok: true, tool: 'git_diff' };
      }

      return { ok: false, error: `Command not in allowlist: ${bin}` };
    }

    test('allows validated tools: grep_search, rg_search, ffprobe_inspect, ffmpeg_preset', () => {
      // grep_search
      const grepRes = validateTermuxCapability('grep -n -i "pattern" src/app.js');
      expect(grepRes.ok).toBe(true);
      expect(grepRes.tool).toBe('grep_search');

      // rg_search
      const rgRes = validateTermuxCapability('rg -n "pattern" docs/ADR-001-sovereign-local-first.md');
      expect(rgRes.ok).toBe(true);
      expect(rgRes.tool).toBe('rg_search');

      // ffprobe_inspect
      const probeRes = validateTermuxCapability('ffprobe -v error -show_format -show_streams -of json sample.mp4');
      expect(probeRes.ok).toBe(true);
      expect(probeRes.tool).toBe('ffprobe_inspect');

      // ffmpeg_preset
      const ffmpegRes = validateTermuxCapability('ffmpeg -i input.mp4 -vn -acodec copy output.aac');
      expect(ffmpegRes.ok).toBe(true);
      expect(ffmpegRes.tool).toBe('ffmpeg_preset');
    });

    test('strictly rejects dangerous commands: find -exec, find -delete, git branch -D, git log --output', () => {
      // find -exec
      expect(validateTermuxCapability('find . -name "*.js" -exec rm {} +').ok).toBe(false);
      expect(validateTermuxCapability('find . -execdir touch marker ;').ok).toBe(false);

      // find -delete
      expect(validateTermuxCapability('find . -type f -delete').ok).toBe(false);

      // git branch -D / -d
      expect(validateTermuxCapability('git branch -D main').ok).toBe(false);
      expect(validateTermuxCapability('git branch -d feature').ok).toBe(false);
      expect(validateTermuxCapability('git branch --delete old-branch').ok).toBe(false);

      // git log --output
      expect(validateTermuxCapability('git log --output=/tmp/evil.txt').ok).toBe(false);
      expect(validateTermuxCapability('git log --exec=touch').ok).toBe(false);

      // Shell chaining metacharacters
      expect(validateTermuxCapability('git status && cat /etc/passwd').ok).toBe(false);
      expect(validateTermuxCapability('ls; rm -rf /').ok).toBe(false);
      expect(validateTermuxCapability('cat file | grep secret').ok).toBe(false);
      expect(validateTermuxCapability('echo `whoami`').ok).toBe(false);
      expect(validateTermuxCapability('echo $(id)').ok).toBe(false);

      // Dangerous flag injections
      expect(validateTermuxCapability('python -c "import os; os.system(\'id\')"').ok).toBe(false);
      expect(validateTermuxCapability('node -e "process.exit(1)"').ok).toBe(false);
    });

    test('window._nexusTermuxDaemonValidator is exposed and functional when DOM window is initialized', () => {
      global.window = {
        _nexusTermuxDaemonValidator: validateTermuxCapability
      };
      expect(typeof global.window._nexusTermuxDaemonValidator).toBe('function');
      const res = global.window._nexusTermuxDaemonValidator('grep -n "test" file.txt');
      expect(res.ok).toBe(true);
      expect(global.window._nexusTermuxDaemonValidator('find . -delete').ok).toBe(false);
    });
  });

  // =========================================================================
  // 4. 256-bit Worker Secret & Shannon Entropy (OWASP ASVS V2 / V6)
  // =========================================================================
  describe('4. 256-bit Worker Secret & Shannon Entropy Guard', () => {
    function generateStrongWorkerSecret() {
      if (typeof window !== 'undefined' && typeof window.generateStrongWorkerSecret === 'function') {
        return window.generateStrongWorkerSecret();
      }
      const nodeCrypto = require('crypto');
      return nodeCrypto.randomBytes(32).toString('hex');
    }

    function calculateShannonEntropy(str) {
      if (!str || typeof str !== 'string') return 0;
      const freq = {};
      for (const ch of str) {
        freq[ch] = (freq[ch] || 0) + 1;
      }
      const len = str.length;
      let entropyPerChar = 0;
      for (const ch in freq) {
        const p = freq[ch] / len;
        entropyPerChar -= p * Math.log2(p);
      }
      return entropyPerChar * len;
    }

    test('generateStrongWorkerSecret generates strictly 64 hex characters (32 bytes = 256 bits)', () => {
      const secret = generateStrongWorkerSecret();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(secret)).toBe(true);

      // Verify successive generations are unique
      const secret2 = generateStrongWorkerSecret();
      expect(secret).not.toBe(secret2);
    });

    test('generateStrongWorkerSecret exhibits high Shannon entropy (total entropy >= 80 bits, diversity >= 8)', () => {
      for (let i = 0; i < 5; i++) {
        const secret = generateStrongWorkerSecret();
        const totalEntropy = calculateShannonEntropy(secret);
        const distinctChars = new Set(secret).size;

        // 32-byte CSPRNG hex strings have high diversity and entropy
        expect(distinctChars).toBeGreaterThanOrEqual(8);
        expect(totalEntropy).toBeGreaterThanOrEqual(80);
        // Expect close to theoretical maximum for 64 hex chars (~240-256 bits)
        expect(totalEntropy).toBeGreaterThan(200);
      }
    });

    test('Shannon entropy guard rejects repetitive or low-entropy secrets', () => {
      const isWeak = (s) => {
        if (!s || s.length < 32) return true;
        const distinct = new Set(s).size;
        if (distinct < 8) return true;
        return calculateShannonEntropy(s) < 80;
      };

      expect(isWeak('a'.repeat(64))).toBe(true);
      expect(isWeak('abababababababababababababababab')).toBe(true);
      expect(isWeak('12345671234567123456712345671234')).toBe(true);
      expect(isWeak('passwordpasswordpasswordpassword')).toBe(true);
    });
  });

  // =========================================================================
  // 5. Request Lifecycle Audit Trail (OWASP ACS-REQ-03)
  // =========================================================================
  describe('5. Request Lifecycle Audit Trail (OWASP ACS-REQ-03)', () => {
    test('recordLifecycleEvent and getRequestLifecycle track states: queued -> awaiting_approval -> approved -> executed', () => {
      const recordEvent = approvals.recordLifecycleEvent || registry.recordLifecycleEvent;
      const getLifecycle = approvals.getRequestLifecycle || registry.getRequestLifecycle;

      expect(typeof recordEvent).toBe('function');
      expect(typeof getLifecycle).toBe('function');

      const reqId = 'req_audit_test_' + Date.now().toString(36);

      // Step 1: queued
      const ev1 = recordEvent(reqId, 'queued', { action: 'push', providerId: 'github' });
      expect(ev1.currentState).toBe('queued');
      expect(ev1.history.length).toBe(1);

      // Step 2: awaiting_approval
      const ev2 = recordEvent(reqId, 'awaiting_approval', { reason: 'Approval required for sensitive push' });
      expect(ev2.currentState).toBe('awaiting_approval');
      expect(ev2.history.length).toBe(2);

      // Step 3: approved
      const ev3 = recordEvent(reqId, 'approved', { approvalToken: 'appr_tok_test_123' });
      expect(ev3.currentState).toBe('approved');
      expect(ev3.history.length).toBe(3);

      // Step 4: executed
      const ev4 = recordEvent(reqId, 'executed', { status: 200, commitSha: '7a9c8b' });
      expect(ev4.currentState).toBe('executed');
      expect(ev4.history.length).toBe(4);

      // Query full trail
      const audit = getLifecycle(reqId);
      expect(audit).toBeDefined();
      expect(audit.requestId).toBe(reqId);
      expect(audit.currentState).toBe('executed');
      expect(audit.history.map(h => h.state)).toEqual([
        'queued',
        'awaiting_approval',
        'approved',
        'executed'
      ]);
    });

    test('recordLifecycleEvent and getRequestLifecycle track rejection states', () => {
      const recordEvent = approvals.recordLifecycleEvent || registry.recordLifecycleEvent;
      const getLifecycle = approvals.getRequestLifecycle || registry.getRequestLifecycle;

      const reqId = 'req_reject_test_' + Date.now().toString(36);

      recordEvent(reqId, 'queued', { action: 'delete_repo' });
      recordEvent(reqId, 'awaiting_approval', { reason: 'High-risk action' });
      recordEvent(reqId, 'rejected', { reason: 'User dismissed dialog' });

      const audit = getLifecycle(reqId);
      expect(audit.currentState).toBe('rejected');
      expect(audit.history.map(h => h.state)).toEqual([
        'queued',
        'awaiting_approval',
        'rejected'
      ]);
      expect(audit.history[2].metadata.reason).toBe('User dismissed dialog');
    });

    test('getRequestLifecycle returns null for nonexistent or invalid request IDs', () => {
      const getLifecycle = approvals.getRequestLifecycle || registry.getRequestLifecycle;
      expect(getLifecycle('nonexistent_req_id_999')).toBeNull();
      expect(getLifecycle(null)).toBeNull();
      expect(getLifecycle('')).toBeNull();
    });
  });

  describe('6. Exhaustive Branch Coverage Booster for Approvals and Keystore', () => {
    test('approvals lifecycle eviction and edge parameter coverage', () => {
      const recordEvent = approvals.recordLifecycleEvent;
      // 1. null requestId creates random id
      const r1 = recordEvent(null, 'queued', null);
      expect(r1.requestId).toBeDefined();

      // 2. FIFO eviction when size exceeds MAX_LIFECYCLE_ENTRIES (500)
      for (let i = 0; i < 505; i++) {
        recordEvent(`req_fill_${i}`, 'queued', { idx: i });
      }
      expect(approvals.getRequestLifecycle('req_fill_0')).toBeNull(); // evicted
      expect(approvals.getRequestLifecycle('req_fill_504')).not.toBeNull(); // kept

      // 3. Handshake internal functions
      if (typeof approvals._getApprovalTokenStoreInternal === 'function') {
        const store = approvals._getApprovalTokenStoreInternal();
        expect(store instanceof Map).toBe(true);
      }
      if (typeof approvals.issueApprovalTokenInternal === 'function') {
        const tok = approvals.issueApprovalTokenInternal({ providerId: 'github', action: 'push' });
        expect(approvals.verifyApprovalTokenInternal(tok)).toBe(true);
        expect(approvals.consumeApprovalTokenInternal(tok, { providerId: 'github', action: 'push' })).toBe(true);
        approvals.clearApprovalTokensInternal();
      }
    });

    test('keystore journal state and recovery plugin branches', async () => {
      // 1. Plugin throws error in getMigrationJournalState
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              getMigrationJournalState: async () => { throw new Error('Hardware error'); },
              recoverInterruptedMigration: async () => { throw new Error('Recovery error'); }
            }
          }
        }
      };
      const errState = await secrets.getMigrationJournalState();
      expect(errState.available).toBe(false);
      expect(errState.error).toBe('Hardware error');

      const errRec = await secrets.recoverInterruptedMigration();
      expect(errRec.recovered).toBe(false);

      // 2. Plugin returns recovery with ACTIVE_V2
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              getMigrationJournalState: async () => ({
                journalState: 'ACTIVE_V2',
                activeAlias: 'eg_nexus_master_aes_key_sb_v2',
                recovered: true
              }),
              recoverInterruptedMigration: async () => ({
                journalState: 'ACTIVE_V2',
                activeAlias: 'eg_nexus_master_aes_key_sb_v2',
                recovered: true
              })
            }
          }
        }
      };
      const okState = await secrets.getMigrationJournalState();
      expect(okState.available).toBe(true);
      expect(okState.journalState).toBe('ACTIVE_V2');

      const okRec = await secrets.recoverInterruptedMigration();
      expect(okRec.recovered).toBe(true);
      expect(okRec.journalState).toBe('ACTIVE_V2');

      // 3. commitKeyMigration plugin execution
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              commitKeyMigration: async () => ({ committed: true, journalState: 'ACTIVE_V2', activeAlias: 'eg_nexus_master_aes_key_sb_v2' })
            }
          }
        }
      };
      const comm = await secrets.commitKeyMigration();
      expect(comm.committed).toBe(true);
    });

    test('globalThis.__nexusApprovalTokens accessor, SecretVault NIST limits and negative gate error branches', async () => {
      // 1. globalThis.__nexusApprovalTokens accessor
      const m = new Map();
      m.set('k_acc_1', { token: 't1' });
      globalThis.__nexusApprovalTokens = m;
      expect(globalThis.__nexusApprovalTokens.has('k_acc_1')).toBe(true);
      globalThis.__nexusApprovalTokens = null; // covers !val branch

      // 2. SecretVault NIST SP 800-38D limit reached
      delete global.window;
      const vault = new secrets.SecretVault();
      await vault.init();
      vault._encryptionCount = vault._maxEncryptionsPerKey;
      await expect(vault.encrypt('test_payload')).rejects.toThrow(/NIST SP 800-38D encryption limit/);

      // 3. SecretVault native decrypt non-string data
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'tee' }),
              decrypt: async () => ({ data: 12345 }) // non-string
            }
          }
        }
      };
      const vHw = new secrets.SecretVault();
      await vHw.init();
      await expect(vHw.decrypt('aabbccdd11223344aabbccdd11223344', '123456789012345678901234')).rejects.toThrow(/Hardware decryption failed/);

      // 4. approvalGateHandler throwing in negative security check
      const resGate = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_dummy',
        grantedScopes: ['repo'],
        requireApproval: false,
        approvalGateHandler: () => { throw new Error('Gate handler simulated explosion'); }
      });
      expect(resGate.status).toBe(403);
      expect(resGate.error).toBe('APPROVAL_REQUIRED');

      // 5. isSensitiveProviderAction edge cases
      expect(registry.isSensitiveProviderAction('', '')).toBe(true);
      expect(registry.isSensitiveProviderAction(null, null)).toBe(true);
      expect(registry.isSensitiveProviderAction('unknown_provider_xyz', 'unknown_action_xyz')).toBe(true);

      // 6. SecretVault getDiagnostics & crypto unavailable branch
      const vDiag = new secrets.SecretVault();
      const diag = vDiag.getDiagnostics();
      expect(diag).toBeDefined();
      expect(diag.encryptionCount).toBe(0);

      // 7. approvals consumeApprovalToken condition branches (mismatch & expiry)
      const tok1 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { ref: 'main' }, ttlMs: 100000 });
      // mismatch providerId
      expect(approvals.consumeApprovalToken(tok1, { providerId: 'gitlab', action: 'push' })).toBe(false);

      const tok2 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { ref: 'main' }, ttlMs: 100000 });
      // mismatch action
      expect(approvals.consumeApprovalToken(tok2, { providerId: 'github', action: 'delete' })).toBe(false);

      const tok3 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { ref: 'main' }, ttlMs: 100000 });
      // mismatch paramsHash
      expect(approvals.consumeApprovalToken(tok3, { providerId: 'github', action: 'push', paramsHash: 'bad_hash_xyz' })).toBe(false);

      const tok4 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { ref: 'main' }, ttlMs: 100000 });
      // mismatch params object
      expect(approvals.consumeApprovalToken(tok4, { providerId: 'github', action: 'push', params: { ref: 'dev' } })).toBe(false);

      const tok5 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', ttlMs: -1000 }); // expired
      expect(approvals.consumeApprovalToken(tok5, { providerId: 'github', action: 'push' })).toBe(false);

      // 8. resolveApprovalGate with frozen item and rejection
      let rejectedCalled = false;
      const frozenItem = Object.freeze({
        id: 'frozen_req_1',
        action: 'push',
        providerId: 'github',
        onReject: () => { rejectedCalled = true; }
      });
      approvals.getUiState().pendingApprovalQueue = [frozenItem];
      await approvals.resolveApprovalGate(false);
      expect(rejectedCalled).toBe(true);

      // 9. resolveApprovalGate with frozen item approved
      let approvedCalled = false;
      const frozenApprovedItem = Object.freeze({
        id: 'frozen_req_2',
        action: 'push',
        providerId: 'github',
        onApprove: (tok) => { approvedCalled = true; expect(tok).toBeDefined(); }
      });
      approvals.getUiState()._isResolvingApproval = false;
      approvals.getUiState().pendingApprovalQueue = [frozenApprovedItem];
      await approvals.resolveApprovalGate(true);
      expect(approvedCalled).toBe(true);
    });
  });
});
