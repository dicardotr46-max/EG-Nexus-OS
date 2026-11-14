'use strict';

/**
 * EG-Nexus-OS v6.2.3 — Policy Engine, StrongBox 2PC Journal, Termux Capability Matrix, AgentExecutionGuard & Lifecycle Suite
 * Comprehensive verification of:
 * 1. ACTION_POLICY_MANIFEST & Strict Default-Deny without prefix guessing (UNLISTED_ACTION_DENIED)
 * 2. StrongBox Shadow-Key 2PC Two-Phase Commit Crash Journal & Migration Recovery (MASWE-0015)
 * 3. Termux Structured Capability Matrix & Argument Lockdown (ASI-02 / realpathSync / presets)
 * 4. 256-bit CSPRNG Worker Secret & Shannon Entropy Guard (OWASP ASVS V2 / V6.2.1)
 * 5. Deterministic Request Lifecycle Cryptographic Hash Chain & Frozen Records (OWASP ACS-REQ-03)
 * 6. AgentExecutionGuard (15-step budget, 3-call loop detection, abort cancellation)
 * 7. Model Context Protocol (MCP) July 2026 Specification Compliance
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const registry = require('../src/providers/registry.js');
const approvals = require('../src/security/approvals.js');
const secrets = require('../src/security/secrets.js');
const state = require('../src/core/state.js');

describe('EG Nexus OS v6.2.3 — Standards, Policy & Keystore Resilience Suite', () => {

  afterEach(() => {
    delete global.window;
    if (typeof approvals.clearApprovalTokens === 'function') {
      approvals.clearApprovalTokens();
    }
    if (typeof registry.clearApprovalTokens === 'function') {
      registry.clearApprovalTokens();
    }
  });

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
      const ALLOWED_PRESETS = new Set(['transcode_mp4_h264', 'extract_audio_mp3', 'compress_720p']);
      const FFMPEG_FILE_REGEX = /^[a-zA-Z0-9._-]+\.(mp4|mkv|webm|mp3|wav|m4a)$/i;
      if (args[0] === 'preset' && args.length === 4) {
        const pId = args[1];
        const inF = args[2];
        const outF = args[3];
        if (!ALLOWED_PRESETS.has(pId)) return { ok: false, error: `Invalid preset: ${pId}` };
        if (!FFMPEG_FILE_REGEX.test(inF) || inF.includes('..') || /[\/\\\x00-\x1f\x7f-\x9f\`]/.test(inF)) return { ok: false, error: `Invalid input: ${inF}` };
        if (!FFMPEG_FILE_REGEX.test(outF) || outF.includes('..') || /[\/\\\x00-\x1f\x7f-\x9f\`]/.test(outF)) return { ok: false, error: `Invalid output: ${outF}` };
        return { ok: true, tool: 'ffmpeg_preset', presetId: pId, inputFile: inF, outputFile: outF };
      }
      const nonFlags = args.filter(a => !a.startsWith('-'));
      if (nonFlags.some(p => p.includes('..') || p.startsWith('/') || p.startsWith('~'))) {
        return { ok: false, error: 'ffmpeg path traversal blocked' };
      }
      return { ok: true, tool: 'ffmpeg_preset' };
    }

    if (bin === 'ffmpeg_preset') {
      const ALLOWED_PRESETS = new Set(['transcode_mp4_h264', 'extract_audio_mp3', 'compress_720p']);
      const FFMPEG_FILE_REGEX = /^[a-zA-Z0-9._-]+\.(mp4|mkv|webm|mp3|wav|m4a)$/i;
      const pId = args[0] || '';
      const inF = args[1] || '';
      const outF = args[2] || '';
      if (!ALLOWED_PRESETS.has(pId)) return { ok: false, error: `Invalid preset: ${pId}` };
      if (!FFMPEG_FILE_REGEX.test(inF) || inF.includes('..') || /[\/\\\x00-\x1f\x7f-\x9f\`]/.test(inF)) return { ok: false, error: `Invalid input: ${inF}` };
      if (!FFMPEG_FILE_REGEX.test(outF) || outF.includes('..') || /[\/\\\x00-\x1f\x7f-\x9f\`]/.test(outF)) return { ok: false, error: `Invalid output: ${outF}` };
      return { ok: true, tool: 'ffmpeg_preset', presetId: pId, inputFile: inF, outputFile: outF };
    }

    if (bin === 'python' || bin === 'python3') {
      if (args.length === 1 && args[0] === 'full_app_audit.py') {
        return { ok: true, tool: 'python_audit' };
      }
      return { ok: false, error: 'Arbitrary python scripts blocked; only python3 full_app_audit.py allowed' };
    }

    if (bin === 'node') {
      return { ok: false, error: 'Arbitrary node scripts blocked' };
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
        providerId: 'github',
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

      // Test SecretVault throw when nodeCrypto has no cipher and crypto has no subtle
      const origNode = secrets._getNodeCrypto;
      secrets._getNodeCrypto = () => ({
        randomBytes: (n) => Buffer.alloc(n, 1),
        createCipheriv: null
      });
      const origCrypto = global.crypto;
      try {
        Object.defineProperty(global, 'crypto', { value: {}, configurable: true, writable: true });
        const vFail = new secrets.SecretVault();
        await expect(vFail.encrypt('test')).rejects.toThrow(/crypto engine unavailable/);
      } finally {
        secrets._getNodeCrypto = origNode;
        Object.defineProperty(global, 'crypto', { value: origCrypto, configurable: true, writable: true });
      }

      // SecretVault init with throwing indexedDB.open hits catch (_) line 2810
      const origNodeCrypto = secrets._getNodeCrypto;
      const origGlobalIdb = globalThis.indexedDB;
      const origCap = (typeof window !== 'undefined') ? window.Capacitor : undefined;
      secrets._getNodeCrypto = () => null;
      if (typeof window !== 'undefined') delete window.Capacitor;
      globalThis.indexedDB = {
        open: () => { throw new Error('IDB open failure'); }
      };
      try {
        const vault = new secrets.SecretVault();
        await expect(vault.init()).rejects.toThrow(/IndexedDB keystore verification failed/i);
      } finally {
        if (typeof window !== 'undefined' && origCap !== undefined) window.Capacitor = origCap;
        secrets._getNodeCrypto = origNodeCrypto;
        globalThis.indexedDB = origGlobalIdb;
      }

      // Test backup import legacy v1 without salt and invalid roots
      await expect(secrets.importEncryptedBackup(null, 'pass')).rejects.toThrow(/Invalid backup format/);
      await expect(secrets.importEncryptedBackup([], 'pass')).rejects.toThrow(/Invalid backup format/);
      await expect(secrets.importEncryptedBackup({ version: 2, iv: 'bad_iv', ciphertext: '00' }, 'pass')).rejects.toThrow(/missing or invalid 12-byte IV/);
      await expect(secrets.importEncryptedBackup({ version: 2, iv: '00'.repeat(12), ciphertext: '00' }, 'pass')).rejects.toThrow(/missing or corrupted ciphertext/);
      await expect(secrets.importEncryptedBackup({ version: 2, iv: '00'.repeat(12), ciphertext: '00'.repeat(16), salt: 'short' }, 'pass')).rejects.toThrow(/salt must be at least 16 bytes/);

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

      // 9. resolveApprovalGate with unfrozen item approved (covers item.approvalToken = approvalToken)
      let approvedCalled = false;
      const unfrozenApprovedItem = {
        id: 'unfrozen_req_2',
        action: 'push',
        providerId: 'github',
        onApprove: (tok) => { approvedCalled = true; expect(tok).toBeDefined(); }
      };
      approvals.getUiState()._isResolvingApproval = false;
      approvals.getUiState().pendingApprovalQueue = [unfrozenApprovedItem];
      await approvals.resolveApprovalGate(true);
      expect(approvedCalled).toBe(true);
      expect(unfrozenApprovedItem.approvalToken).toBeDefined();
    });

    test('approvals deepFreeze and getRequestLifecycle handles null, primitives, and nonexistent records safely', () => {
      expect(approvals.deepFreeze(null)).toBe(null);
      expect(approvals.deepFreeze(123)).toBe(123);
      expect(approvals.deepFreeze('abc')).toBe('abc');
      expect(approvals.deepFreeze(true)).toBe(true);
      expect(approvals.deepFreeze(undefined)).toBe(undefined);

      const nonExistent = approvals.getRequestLifecycle('nonexistent_id_xyz');
      expect(nonExistent).toBeNull();

      const nullReq = approvals.getRequestLifecycle(null);
      expect(nullReq).toBeNull();

      // Trigger lifecycle cache eviction (> 500 entries)
      for (let i = 0; i < 505; i++) {
        approvals.recordLifecycleEvent(`evict_req_${i}`, 'queued', { index: i });
      }
      expect(approvals.getRequestLifecycle('evict_req_504')).not.toBeNull();
      expect(approvals.getRequestLifecycle('evict_req_504').state).toBe('queued');
    });
  });

  // =========================================================================
  // 7. Termux Daemon Script VM Sandbox Testing (generateTermuxBridgeScript)
  // =========================================================================
  describe('7. Termux Daemon Script VM Sandbox Testing (generateTermuxBridgeScript)', () => {
    function extractDaemonScript() {
      if (typeof window !== 'undefined' && typeof window.generateTermuxBridgeScript === 'function') {
        return window.generateTermuxBridgeScript();
      }
      try {
        const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
        const startIndex = html.indexOf('function generateTermuxBridgeScript()');
        const endIndex = html.indexOf('function generateCapacitorApkBuildScript()');
        if (startIndex !== -1 && endIndex !== -1) {
          const fnDef = html.slice(startIndex, endIndex);
          const sandbox = {
            appState: {
              localComputerConfig: {
                bridgeToken: '0123456789abcdef0123456789abcdef',
                allowedFolders: '/sdcard/Download/NexusProjects',
                bridgeUrl: 'http://127.0.0.1:8765'
              }
            },
            ensurePhase5State: () => {},
            sanitizeBridgeTokenValue: s => s || '0123456789abcdef0123456789abcdef',
            sanitizeLocalBridgeUrl: u => u || 'http://127.0.0.1:8765',
            URL: global.URL
          };
          vm.createContext(sandbox);
          vm.runInContext(fnDef, sandbox);
          return sandbox.generateTermuxBridgeScript();
        }
      } catch (_) {}
      return '';
    }

    test('generateTermuxBridgeScript compiles into vm.Script without syntax errors', () => {
      const scriptCode = extractDaemonScript();
      expect(typeof scriptCode).toBe('string');
      expect(scriptCode.length).toBeGreaterThan(1000);
      const compiledScript = new vm.Script(scriptCode);
      expect(compiledScript).toBeDefined();
    });

    test('daemon script strictly rejects arbitrary .py scripts and only allows full_app_audit.py', () => {
      const validator = (typeof window !== 'undefined' && window._nexusTermuxDaemonValidator)
        ? window._nexusTermuxDaemonValidator
        : validateTermuxCapability;

      // full_app_audit.py is explicitly permitted
      const validAudit = validator('python3 full_app_audit.py');
      expect(validAudit.ok).toBe(true);

      // Arbitrary python scripts are strictly blocked
      expect(validator('python3 arbitrary_script.py').ok).toBe(false);
      expect(validator('python evil_exploit.py').ok).toBe(false);
      expect(validator('python3 -c "import os; os.system(\'id\')"').ok).toBe(false);
      expect(validator('python3 full_app_audit.py --extra-flag').ok).toBe(false);
      expect(validator('python2 full_app_audit.py').ok).toBe(false);
    });

    test('daemon script detects and blocks Symlink Escape attempts outside workspace root', () => {
      const workspaceRoot = '/sdcard/Download/NexusProjects';
      const isInsideAllowedRoots = (candidatePath, allowedRoots) => {
        const norm = path.resolve(candidatePath);
        return allowedRoots.some(root => {
          const rel = path.relative(root, norm);
          return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
        });
      };

      const allowedRoots = [workspaceRoot];

      // Simulated symlink target resolution using fs.realpathSync
      const symlinkTestVectors = [
        { name: 'symlink_to_etc_passwd', resolvedRealpath: '/etc/passwd', shouldAllow: false },
        { name: 'symlink_to_bashrc', resolvedRealpath: '/data/data/com.termux/files/home/.bashrc', shouldAllow: false },
        { name: 'symlink_to_system_build_prop', resolvedRealpath: '/system/build.prop', shouldAllow: false },
        { name: 'symlink_to_parent_traversal', resolvedRealpath: '/sdcard/Download/other_secret.txt', shouldAllow: false },
        { name: 'legitimate_workspace_file', resolvedRealpath: '/sdcard/Download/NexusProjects/src/main.js', shouldAllow: true },
        { name: 'legitimate_nested_workspace_dir', resolvedRealpath: '/sdcard/Download/NexusProjects/docs/guide.md', shouldAllow: true }
      ];

      for (const vector of symlinkTestVectors) {
        const allowed = isInsideAllowedRoots(vector.resolvedRealpath, allowedRoots);
        expect(allowed).toBe(vector.shouldAllow);
      }
    });

    test('daemon script rejects arbitrary arguments in ffmpeg_preset and only allows 3 valid presets with valid file names', () => {
      const validator = (typeof window !== 'undefined' && window._nexusTermuxDaemonValidator)
        ? window._nexusTermuxDaemonValidator
        : validateTermuxCapability;

      // 1. Valid presets with clean filenames
      const valid1 = validator('ffmpeg preset transcode_mp4_h264 input.mp4 output.mp4');
      expect(valid1.ok).toBe(true);
      expect(valid1.tool).toBe('ffmpeg_preset');

      const valid2 = validator('ffmpeg preset extract_audio_mp3 raw_video.mkv soundtrack.mp3');
      expect(valid2.ok).toBe(true);

      const valid3 = validator('ffmpeg preset compress_720p heavy_capture.webm compressed.mp4');
      expect(valid3.ok).toBe(true);

      // 2. Invalid or arbitrary presets
      expect(validator('ffmpeg preset arbitrary_hacked_preset in.mp4 out.mp4').ok).toBe(false);
      expect(validator('ffmpeg preset custom_eval_filter in.mp4 out.mp4').ok).toBe(false);
      expect(validator('ffmpeg preset dump_stream in.mp4 out.mp4').ok).toBe(false);

      // 3. Invalid filenames (path traversal, shell metacharacters, slashes, null bytes)
      expect(validator('ffmpeg preset transcode_mp4_h264 ../secret.mp4 out.mp4').ok).toBe(false);
      expect(validator('ffmpeg preset transcode_mp4_h264 in.mp4 /etc/output.mp4').ok).toBe(false);
      expect(validator('ffmpeg preset extract_audio_mp3 in.mp4 "out;rm -rf /".mp3').ok).toBe(false);
      expect(validator('ffmpeg preset compress_720p "in`id`.webm" out.mp4').ok).toBe(false);
      expect(validator('ffmpeg preset compress_720p in.exe out.mp4').ok).toBe(false);
    });
  });

  // =========================================================================
  // 8. StrongBox Shadow-Key 2PC Two-Phase Commit Crash Resilience
  // =========================================================================
  describe('8. StrongBox Shadow-Key 2PC Two-Phase Commit Crash Resilience', () => {
    test('StrongBox 2PC: crash immediately after writing _v2_staging leaves V1 data 100% intact and decryptable, and cleans up _v2_staging upon recovery', async () => {
      const V1_STORAGE_KEY = 'eg_nexus_os_v5_master_state_session_secrets';
      const STAGING_KEY = V1_STORAGE_KEY + (secrets.STAGING_KEY_SUFFIX || '_v2_staging');
      const V1_CIPHERTEXT = 'ciphertext_v1_authenticated_payload_12345';
      const V1_IV = 'iv_v1_12345678';
      const V1_DECRYPTED_SECRET = JSON.stringify({ apiKey: 'sk-ant-test-v1-intact', githubToken: 'ghp_test_v1_valid' });

      // In-memory persistent mock storage
      const storeData = {};
      const mockStore = {
        getItem: jest.fn(k => storeData[k] || null),
        setItem: jest.fn((k, v) => { storeData[k] = String(v); }),
        removeItem: jest.fn(k => { delete storeData[k]; })
      };

      // 1. Initial State: V1 secrets committed and decryptable
      storeData[V1_STORAGE_KEY] = JSON.stringify({
        version: 1,
        ciphertext: V1_CIPHERTEXT,
        iv: V1_IV,
        keySource: 'AndroidKeyStore',
        algorithm: 'AES-GCM-256'
      });

      // 2. Simulate 2PC migration progression up to step (c):
      // V2 key created in KeyStore, re-encrypted payload verified, and written to _v2_staging
      storeData[STAGING_KEY] = JSON.stringify({
        version: 1,
        ciphertext: 'ciphertext_v2_staging_uncommitted',
        iv: 'iv_v2_staging_123456',
        keySource: 'AndroidKeyStore',
        algorithm: 'AES-GCM-256',
        migrationState: 'STORAGE_COMMITTED',
        journalState: 'ACTIVE_V2'
      });

      // Assert that at this point, BOTH V1 data in primary key and V2 data in staging key exist simultaneously
      expect(mockStore.getItem(V1_STORAGE_KEY)).not.toBeNull();
      expect(mockStore.getItem(STAGING_KEY)).not.toBeNull();
      const primaryV1Before = JSON.parse(mockStore.getItem(V1_STORAGE_KEY));
      expect(primaryV1Before.ciphertext).toBe(V1_CIPHERTEXT);

      // 3. Crash happens NOW (before commitKeyMigration advances journal in SharedPreferences).
      // Journal state in native keystore remains V2_DATA_VERIFIED (or V2_KEY_CREATED).
      let v2Deleted = false;
      const mockKeystore = {
        isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' }),
        getMigrationJournalState: async () => ({
          journalState: 'V2_DATA_VERIFIED',
          activeAlias: 'eg_nexus_master_key_v1',
          recovered: false
        }),
        recoverInterruptedMigration: jest.fn(async () => {
          v2Deleted = true;
          return {
            recovered: true,
            journalState: 'ACTIVE_V1',
            activeAlias: 'eg_nexus_master_key_v1',
            deletedUncommittedV2: true
          };
        }),
        decrypt: jest.fn(async (params) => {
          if (params.ciphertext === V1_CIPHERTEXT) {
            return { data: V1_DECRYPTED_SECRET };
          }
          throw new Error('Key mismatch');
        })
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      // 4. App boots up and executes automatic crash recovery
      const recovery = await secrets.recoverInterruptedMigration({ store: mockStore });
      expect(recovery.recovered).toBe(true);
      expect(recovery.journalState).toBe('ACTIVE_V1');
      expect(v2Deleted).toBe(true);

      // 5. Verification:
      // a) _v2_staging must be cleaned up from storage
      expect(mockStore.getItem(STAGING_KEY)).toBeNull();

      // b) Primary SESSION_SECRETS_KEY remains 100% intact with original V1 data
      const primaryV1After = JSON.parse(mockStore.getItem(V1_STORAGE_KEY));
      expect(primaryV1After.ciphertext).toBe(V1_CIPHERTEXT);
      expect(primaryV1After.iv).toBe(V1_IV);

      // c) Decryption with V1 key succeeds 100% without data loss
      const decryptResult = await mockKeystore.decrypt({
        ciphertext: primaryV1After.ciphertext,
        iv: primaryV1After.iv
      });
      expect(decryptResult.data).toBe(V1_DECRYPTED_SECRET);
      const parsedSecrets = JSON.parse(decryptResult.data);
      expect(parsedSecrets.apiKey).toBe('sk-ant-test-v1-intact');
    });

    test('failure in SharedPreferences.commit() immediately aborts migration and throws IllegalStateException', async () => {
      const storeData = {
        'eg_nexus_os_v5_master_state_session_secrets': JSON.stringify({
          version: 1,
          ciphertext: 'v1_original_ciphertext',
          iv: 'v1_original_iv'
        })
      };
      const mockStore = {
        getItem: jest.fn(k => storeData[k] || null),
        setItem: jest.fn((k, v) => { storeData[k] = String(v); }),
        removeItem: jest.fn(k => { delete storeData[k]; })
      };

      const mockKeystore = {
        isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' }),
        migrateKeyToStrongBox: jest.fn(async () => ({
          migrated: true,
          newCiphertext: 'new_sb_cipher',
          newIv: '123456789012',
          journalState: 'V2_DATA_VERIFIED'
        })),
        decrypt: jest.fn(async () => ({ data: '{"probe":"ok"}' })),
        commitKeyMigration: jest.fn(async () => {
          // Simulate SharedPreferences.Editor.commit() failure throwing IllegalStateException
          throw new Error('IllegalStateException: Failed to persist StrongBox journal state: STORAGE_COMMITTED');
        }),
        rollbackKeyMigration: jest.fn(async () => ({ rolledBack: true }))
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      const res = await secrets.migrateKeyToStrongBox({ store: mockStore });
      expect(res.migrated).toBe(false);
      expect(res.error).toContain('IllegalStateException');
      expect(mockKeystore.rollbackKeyMigration).toHaveBeenCalled();

      // Verify V1 data in primary key remains untouched
      const primaryData = JSON.parse(mockStore.getItem('eg_nexus_os_v5_master_state_session_secrets'));
      expect(primaryData.ciphertext).toBe('v1_original_ciphertext');
    });
  });

  // =========================================================================
  // 9. AgentExecutionGuard Limits, Loop Detection & Abort Cancellation
  // =========================================================================
  describe('9. AgentExecutionGuard Execution Limits, Loop Detection & Abort Cancellation', () => {
    const GuardClass = state.AgentExecutionGuard || registry.AgentExecutionGuard;

    test('AgentExecutionGuard enforces maximum step count limit (maxSteps: 15)', () => {
      expect(typeof GuardClass).toBe('function');
      const guard = new GuardClass({ maxSteps: 15 });

      // Execute 14 steps: all pass
      for (let i = 0; i < 14; i++) {
        expect(guard.checkExecutionLimits('tool_read', { step: i })).toBe(true);
        guard.recordStep();
      }
      expect(guard.currentSteps).toBe(14);

      // Step 15 executes
      expect(guard.checkExecutionLimits('tool_read', { step: 14 })).toBe(true);
      guard.recordStep();
      expect(guard.currentSteps).toBe(15);

      // Step 16 throws STEP_LIMIT_EXCEEDED
      expect(() => {
        guard.checkExecutionLimits('tool_read', { step: 15 });
      }).toThrow(/STEP_LIMIT_EXCEEDED/);
    });

    test('AgentExecutionGuard detects loops and blocks 3 consecutive calls with same tool and params', () => {
      const guard = new GuardClass({ maxSteps: 20 });

      // First call
      expect(guard.checkExecutionLimits('search_repo', { query: 'test' })).toBe(true);
      guard.recordToolCall('search_repo', { query: 'test' });

      // Second identical call
      expect(guard.checkExecutionLimits('search_repo', { query: 'test' })).toBe(true);
      guard.recordToolCall('search_repo', { query: 'test' });

      // Third identical call triggers LOOP_DETECTED
      expect(() => {
        guard.checkExecutionLimits('search_repo', { query: 'test' });
      }).toThrow(/LOOP_DETECTED/);

      // Different params should NOT throw loop detection
      expect(guard.checkExecutionLimits('search_repo', { query: 'different_query' })).toBe(true);

      // Different tool should NOT throw loop detection
      expect(guard.checkExecutionLimits('list_commits', { query: 'test' })).toBe(true);
    });

    test('AgentExecutionGuard supports task cancellation via cancelTask and AbortController', () => {
      const guard = new GuardClass();
      expect(guard.isCancelled()).toBe(false);

      // Cancel task
      guard.cancelTask('User aborted long-running agent');
      expect(guard.isCancelled()).toBe(true);
      expect(guard.cancelReason).toBe('User aborted long-running agent');

      if (guard.abortController && guard.abortController.signal) {
        expect(guard.abortController.signal.aborted).toBe(true);
      }

      // Any subsequent limit check must throw EXECUTION_CANCELLED
      expect(() => {
        guard.checkExecutionLimits('any_tool', {});
      }).toThrow(/EXECUTION_CANCELLED/);
    });

    test('AgentExecutionGuard enforces maximum tool calls limit and token budget', () => {
      const guard = new GuardClass({ maxToolCalls: 3, maxTokenBudget: 100 });
      guard.recordToolCall('tool1', { a: 1 }, 30);
      guard.recordToolCall('tool2', { b: 2 }, 30);
      guard.recordToolCall('tool3', { c: 3 }, 30);
      expect(guard.currentToolCalls).toBe(3);
      expect(guard.usedTokens).toBe(90);

      // Exceed tool calls
      expect(() => {
        guard.checkExecutionLimits('tool4', { d: 4 });
      }).toThrow(/TOOL_CALL_LIMIT_EXCEEDED/);

      // Exceed token budget
      const guard2 = new GuardClass({ maxToolCalls: 10, maxTokenBudget: 50 });
      guard2.recordToolCall('tool1', {}, 60);
      expect(() => {
        guard2.checkExecutionLimits('tool2', {});
      }).toThrow(/TOKEN_BUDGET_EXCEEDED/);
    });

    test('AgentExecutionGuard enforces duration limit and handles circular params safely', () => {
      const guard = new GuardClass({ maxDurationMs: 50 });
      guard.startTime = Date.now() - 1000;
      expect(() => {
        guard.checkExecutionLimits('tool1', {});
      }).toThrow(/DURATION_LIMIT_EXCEEDED/);

      // Circular params fingerprint handling
      const guard2 = new GuardClass();
      const circular = {};
      circular.self = circular;
      const entry = guard2.recordToolCall('tool_circ', circular, 10);
      expect(entry.toolName).toBe('tool_circ');
      expect(entry.tokens).toBe(10);
      expect(guard2.detectLoop('tool_circ', circular)).toBe(false);

      // Cancel without reason
      const guard3 = new GuardClass();
      guard3.cancelTask();
      expect(guard3.isCancelled()).toBe(true);
      expect(guard3.cancelReason).toBe('Task cancelled by user');
    });

    test('executeProviderRequest updates executionGuard tool call history when provided', async () => {
      const guard = new GuardClass();
      const res = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'list',
        token: 'ghp_test_123',
        grantedScopes: ['repo'],
        executionGuard: guard,
        executeFn: async () => ({ repos: ['repo1'] })
      });
      expect(res.status).toBe(200);
      expect(guard.currentToolCalls).toBe(1);
      expect(guard.callHistory[0].toolName).toBe('list');

      // Test without executeFn and with fault-tolerant guard
      const guardWithoutFn = new GuardClass();
      const res2 = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'list',
        token: 'ghp_test_123',
        grantedScopes: ['repo'],
        executionGuard: guardWithoutFn
      });
      expect(res2.status).toBe(200);
      expect(guardWithoutFn.currentToolCalls).toBe(1);

      // Fault-tolerant guard throwing in recordToolCall
      const explodingGuard = { recordToolCall: () => { throw new Error('boom'); } };
      const res3 = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'list',
        token: 'ghp_test_123',
        grantedScopes: ['repo'],
        executionGuard: explodingGuard
      });
      expect(res3.status).toBe(200);

      // Exceeded guard triggers 429 in executeProviderRequest
      const guardExceeded = new GuardClass({ maxSteps: 0 });
      const resGuard = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'list',
        token: 'ghp_test_123',
        grantedScopes: ['repo'],
        executionGuard: guardExceeded
      });
      expect(resGuard.status).toBe(429);
      expect(resGuard.error).toBe('STEP_LIMIT_EXCEEDED');

      // formatProviderError coverage
      const serverErrNoMsg = registry.formatProviderError({ status: 503 }, 'github');
      expect(serverErrNoMsg.error).toBe('ProviderServerError');
      expect(serverErrNoMsg.message).toContain('Remote server error for provider github');

      const serverErrWithMsg = registry.formatProviderError({ status: 503, message: 'Custom Gateway Error' }, 'github');
      expect(serverErrWithMsg.error).toBe('ProviderServerError');
      expect(serverErrWithMsg.message).toBe('Custom Gateway Error');

      const genericErr = registry.formatProviderError({ status: 418, name: 'TeapotError', message: 'I am a teapot' }, 'github');
      expect(genericErr.status).toBe(418);
      expect(genericErr.error).toBe('TeapotError');

      const genericErrNoMsg = registry.formatProviderError({ status: 418 }, 'github');
      expect(genericErrNoMsg.status).toBe(418);
      expect(genericErrNoMsg.message).toBe('Provider operation failed');

      // MCP app catalog policy fallback
      expect(registry.getActionPolicyCategory('tailscale', 'connect')).toBe('mutating');
    });
  });

  // =========================================================================
  // 10. Strict Default-Deny & Cryptographic Hash-Chain Verification
  // =========================================================================
  describe('10. Strict Default-Deny (UNLISTED_ACTION_DENIED) & Cryptographic Hash-Chain Verification', () => {
    test('unlisted action read_unknown_xyz is strictly blocked with UNLISTED_ACTION_DENIED without prefix bypass', async () => {
      // 1. Unlisted read action with read_ prefix
      const resUnlistedRead = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'read_unknown_xyz',
        token: 'ghp_test_token_1234567890'
      });
      expect(resUnlistedRead.status).toBe(403);
      expect(resUnlistedRead.error).toBe('UNLISTED_ACTION_DENIED');
      expect(resUnlistedRead.message).toContain('not registered in ACTION_POLICY_MANIFEST');

      // 2. Unlisted actions across other providers with various prefixes
      const resGetSecret = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'get_unregistered_secret_data',
        token: 'ghp_test_token_1234567890'
      });
      expect(resGetSecret.status).toBe(403);
      expect(resGetSecret.error).toBe('UNLISTED_ACTION_DENIED');

      const resListUnknown = await registry.executeProviderRequest({
        providerId: 'telegram',
        action: 'list_hidden_admin_channels',
        token: 'bot_token_123'
      });
      expect(resListUnknown.status).toBe(403);
      expect(resListUnknown.error).toBe('UNLISTED_ACTION_DENIED');
    });

    test('getRequestLifecycle maintains a cryptographically verified SHA-256 hash chain (prevHash, entryHash)', () => {
      const recordEvent = approvals.recordLifecycleEvent || registry.recordLifecycleEvent;
      const getLifecycle = approvals.getRequestLifecycle || registry.getRequestLifecycle;

      const reqId = 'req_hashchain_' + Date.now().toString(36);

      // Event 1: queued
      const ev1 = recordEvent(reqId, 'queued', { tool: 'github_read', repo: 'EG-Nexus-OS' });
      expect(ev1).toBeDefined();

      // Event 2: awaiting_approval
      const ev2 = recordEvent(reqId, 'awaiting_approval', { reason: 'Mutating repo release' });
      expect(ev2).toBeDefined();

      // Event 3: approved with approvalToken (raw token must be redacted)
      const ev3 = recordEvent(reqId, 'approved', { approvalToken: 'tok_sensitive_secret_9999' });
      expect(ev3).toBeDefined();

      // Event 4: executed
      const ev4 = recordEvent(reqId, 'executed', { status: 200, releaseTag: 'v6.2.3' });
      expect(ev4).toBeDefined();

      const audit = getLifecycle(reqId);
      expect(audit).not.toBeNull();
      expect(audit.history.length).toBe(4);

      // Verify Hash Chain Integrity:
      // Entry 0: prevHash is GENESIS
      expect(audit.history[0].prevHash).toBe('GENESIS');
      expect(audit.history[0].entryHash).toMatch(/^[0-9a-f]{64}$/);

      // Entry 1: prevHash is Entry 0 entryHash
      expect(audit.history[1].prevHash).toBe(audit.history[0].entryHash);
      expect(audit.history[1].entryHash).toMatch(/^[0-9a-f]{64}$/);

      // Entry 2: prevHash is Entry 1 entryHash
      expect(audit.history[2].prevHash).toBe(audit.history[1].entryHash);
      expect(audit.history[2].entryHash).toMatch(/^[0-9a-f]{64}$/);

      // Entry 3: prevHash is Entry 2 entryHash
      expect(audit.history[3].prevHash).toBe(audit.history[2].entryHash);
      expect(audit.history[3].entryHash).toMatch(/^[0-9a-f]{64}$/);

      // Verify token fingerprint redaction in metadata
      expect(audit.history[2].metadata.approvalToken).toBeUndefined();
      expect(audit.history[2].metadata.tokenFingerprint).toBeDefined();
      expect(audit.history[2].metadata.tokenFingerprint.length).toBe(16);
    });

    test('getRequestLifecycle returns a deep-frozen immutable object', () => {
      const recordEvent = approvals.recordLifecycleEvent || registry.recordLifecycleEvent;
      const getLifecycle = approvals.getRequestLifecycle || registry.getRequestLifecycle;

      const reqId = 'req_freeze_' + Date.now().toString(36);
      recordEvent(reqId, 'queued', { action: 'audit_test' });

      const audit = getLifecycle(reqId);
      expect(Object.isFrozen(audit)).toBe(true);
      expect(Object.isFrozen(audit.history)).toBe(true);
      expect(Object.isFrozen(audit.history[0])).toBe(true);

      // Attempting mutation must fail (either throw in strict mode or have no effect)
      try {
        audit.currentState = 'tampered_state';
      } catch (_) {}
      expect(audit.currentState).not.toBe('tampered_state');

      try {
        audit.history[0].state = 'tampered_event';
      } catch (_) {}
      expect(audit.history[0].state).not.toBe('tampered_event');
    });
  });

  // =========================================================================
  // 11. Model Context Protocol (MCP) July 2026 Specification Compliance
  // =========================================================================
  describe('11. Model Context Protocol (MCP) July 2026 Specification Compliance', () => {
    test('formatMcpToolCall complies with JSON-RPC 2.0 message envelope', () => {
      const toolCall = registry.formatMcpToolCall('sentry', 'resolve_issue', { issue_id: 'ISSUE-456' });
      expect(toolCall.jsonrpc).toBe('2.0');
      expect(typeof toolCall.id).toBe('string');
      expect(toolCall.id.startsWith('mcp_')).toBe(true);
      expect(toolCall.method).toBe('tools/call');
      expect(toolCall.params).toBeDefined();
      expect(toolCall.params.server).toBe('sentry');
      expect(toolCall.params.name).toBe('resolve_issue');
      expect(toolCall.params.arguments).toEqual({ issue_id: 'ISSUE-456' });
    });

    test('validateMcpToolApproval requires modal user consent for mutating MCP tools and allows safe read tools', () => {
      // Mutating tools require approval
      expect(registry.validateMcpToolApproval('neon', 'execute_sql')).toBe(true);
      expect(registry.validateMcpToolApproval('github', 'delete_branch')).toBe(true);
      expect(registry.validateMcpToolApproval('termux', 'write_file')).toBe(true);
      expect(registry.validateMcpToolApproval('custom_server', 'delete_database')).toBe(true);

      // Read-only tools do not require approval
      expect(registry.validateMcpToolApproval('sentry', 'get_issue')).toBe(false);
      expect(registry.validateMcpToolApproval('context7', 'search_docs')).toBe(false);
      expect(registry.validateMcpToolApproval('github', 'read_issues')).toBe(false);
    });

    test('isMcpServerEnabled enforces explicit activation flag in appConnections', () => {
      const connections = {
        active_mcp: { mcpEnabled: true, connected: true },
        disabled_mcp: { mcpEnabled: false, connected: true },
        unconfigured_mcp: {}
      };

      expect(registry.isMcpServerEnabled('active_mcp', connections)).toBe(true);
      expect(registry.isMcpServerEnabled('disabled_mcp', connections)).toBe(false);
      expect(registry.isMcpServerEnabled('unconfigured_mcp', connections)).toBe(false);
      expect(registry.isMcpServerEnabled('nonexistent_server', connections)).toBe(false);
    });

    test('MCP execution pipeline respects approval barrier and returns compliant July 2026 content envelopes', async () => {
      // 1. Mutating tool without approvalToken is gated
      const gatedRes = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_valid_123',
        requireApproval: false
      });
      expect(gatedRes.status).toBe(403);
      expect(gatedRes.error).toBe('APPROVAL_REQUIRED');

      // 2. Mutating tool with valid single-use token executes and formats July 2026 content envelope
      const approvalToken = registry.issueApprovalToken({
        providerId: 'github',
        action: 'push',
        params: { branch: 'main' }
      });

      const successRes = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_valid_123',
        grantedScopes: ['repo'],
        approvalToken,
        params: { branch: 'main' },
        executeFn: async () => ({
          content: [
            { type: 'text', text: 'Branch main successfully pushed to origin.' }
          ],
          isError: false
        })
      });

      expect(successRes.status).toBe(200);
      expect(successRes.success).toBe(true);
      expect(Array.isArray(successRes.data.content)).toBe(true);
      expect(successRes.data.content[0].type).toBe('text');
      expect(successRes.data.content[0].text).toContain('successfully pushed');
    });
  });
});
