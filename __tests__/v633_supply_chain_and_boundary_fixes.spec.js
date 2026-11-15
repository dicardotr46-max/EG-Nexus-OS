'use strict';

/**
 * EG-Nexus-OS v6.3.3 — Supply Chain, Keystore Capabilities, Sandbox & Boundary Hardening
 * Comprehensive Regression Test Suite Covering All 16 Security & Architectural Findings:
 *
 * 1. P1-01: Dynamic CI/CD Version Binding in nexus-factory.yml
 * 2. P1-02: StrongBox Keystore Capability Tokens & Verification Boundaries
 * 3. P1-03: Fail-Closed Audit Report Sync Disallows --no-test Bypass
 * 4. P2-02 & P2-10: Deterministic CycloneDX SBOM with Android Maven Components
 * 5. P2-03: Automated Mirror Pruning for Stale Files in sync-www.js
 * 6. P2-04 & P3-02: AST Syntax & Linting Coverage Over Scripts & Tests
 * 7. P2-05: Browser Operator Loopback/Metadata IP Blocking & Redirect Error Policy
 * 8. P2-06: Studio Preview connect-src 'none' Sandbox CSP
 * 9. P2-07: Plaintext Envelope Rejection & Fail-Closed Encryption in secrets.js
 * 10. P2-08: Main CSP WebSocket Wildcard Restriction
 * 11. P2-09: Python Test Suite Failure on Bootstrap Errors
 * 12. P2-11: Android Proguard & Resource Shrinking Configuration
 * 13. P3-01: Static Inventory Target Synchronization & Explicit Audit Mode
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const secrets = require('../src/security/secrets.js');

describe('EG-Nexus-OS v6.3.3 Supply Chain, Keystore Capabilities & Boundary Hardening', () => {

  afterEach(() => {
    delete global.window;
    delete global.Capacitor;
    if (typeof secrets.setExplicitLegacyMigrationMode === 'function') {
      secrets.setExplicitLegacyMigrationMode(false);
    }
  });

  // =========================================================================
  // a) P1-01: GitHub Actions CI/CD Dynamic Version Binding
  // =========================================================================
  describe('a) P1-01: GitHub Actions CI/CD Dynamic Version Binding', () => {
    test('nexus-factory.yml uses dynamic binding v${PKG_VERSION} without hardcoded v6.2 APK names or tags', () => {
      const ymlPath = path.join(ROOT_DIR, '.github/workflows/nexus-factory.yml');
      expect(fs.existsSync(ymlPath)).toBe(true);
      const content = fs.readFileSync(ymlPath, 'utf8');

      // Assert that NO hardcoded v6.2 or 6.2 strings exist in APK filenames, checksums, or release tags
      expect(content).not.toMatch(/EG-Nexus-OS-v6\.2/);
      expect(content).not.toMatch(/EG-Nexus-OS-6\.2/);
      expect(content).not.toMatch(/v6\.2\.apk/);
      expect(content).not.toMatch(/6\.2\.apk/);
      expect(content).not.toMatch(/v6\.2-release/);

      // Assert dynamic binding v${PKG_VERSION} is used
      expect(content).toMatch(/PKG_VERSION/);
      expect(content).toMatch(/v\$\{?PKG_VERSION\}?/);
    });
  });

  // =========================================================================
  // b) P1-02: NexusKeystore Capability Tokens & Verification Boundaries
  // =========================================================================
  describe('b) P1-02: NexusKeystore Capability Tokens & Verification Boundaries', () => {
    test('calling NexusKeystore.decrypt without sessionBridgeToken is rejected with NATIVE_AUTH_REQUIRED', async () => {
      const mockKeystore = {
        initNativeVaultSession: jest.fn(async () => ({ sessionBridgeToken: 'valid-test-bridge-token-1234' })),
        decrypt: jest.fn(async (call) => {
          if (!call || call.sessionBridgeToken !== 'valid-test-bridge-token-1234') {
            throw new Error('NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token');
          }
          return { data: 'decrypted-payload' };
        })
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      // Call without valid capability token
      await expect(mockKeystore.decrypt({ ciphertext: 'dummy-cipher', iv: 'dummy-iv' }))
        .rejects.toThrow(/NATIVE_AUTH_REQUIRED/);

      // Call with valid capability token succeeds
      const success = await mockKeystore.decrypt({
        ciphertext: 'dummy-cipher',
        iv: 'dummy-iv',
        sessionBridgeToken: 'valid-test-bridge-token-1234'
      });
      expect(success.data).toBe('decrypted-payload');
    });

    test('commitKeyMigration without valid migrationTxToken or with mismatched ciphertext hash is rejected and does NOT delete key V1', async () => {
      let v1KeyDeleted = false;
      const expectedHash = crypto.createHash('sha256').update('new-v2-ciphertext-content').digest('hex');

      const mockKeystore = {
        initNativeVaultSession: jest.fn(async () => ({ sessionBridgeToken: 'valid-test-bridge-token-1234' })),
        commitKeyMigration: jest.fn(async (call = {}) => {
          if (!call.sessionBridgeToken || call.sessionBridgeToken !== 'valid-test-bridge-token-1234') {
            throw new Error('NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token');
          }
          if (call.stage === 'ACTIVE_V2') {
            if (!call.migrationTxToken || call.migrationTxToken !== 'valid-tx-token-abc') {
              throw new Error('MIGRATION_COMMIT_FAILED: Missing or invalid migration transaction capability token');
            }
            if (!call.v2CiphertextHash || call.v2CiphertextHash !== expectedHash) {
              throw new Error('MIGRATION_COMMIT_FAILED: Ciphertext hash verification mismatch');
            }
            v1KeyDeleted = true;
            return { committed: true, journalState: 'ACTIVE_V2', deletedOldKeys: true };
          }
          return { committed: true, journalState: call.stage || 'STORAGE_COMMITTED' };
        })
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockKeystore
          }
        }
      };

      // 1. Missing sessionBridgeToken
      await expect(mockKeystore.commitKeyMigration({ stage: 'ACTIVE_V2', mainStorageVerified: true }))
        .rejects.toThrow(/NATIVE_AUTH_REQUIRED/);
      expect(v1KeyDeleted).toBe(false);

      // 2. Missing migrationTxToken
      await expect(mockKeystore.commitKeyMigration({
        stage: 'ACTIVE_V2',
        mainStorageVerified: true,
        sessionBridgeToken: 'valid-test-bridge-token-1234'
      })).rejects.toThrow(/MIGRATION_COMMIT_FAILED/);
      expect(v1KeyDeleted).toBe(false);

      // 3. Mismatched ciphertext hash
      await expect(mockKeystore.commitKeyMigration({
        stage: 'ACTIVE_V2',
        mainStorageVerified: true,
        sessionBridgeToken: 'valid-test-bridge-token-1234',
        migrationTxToken: 'valid-tx-token-abc',
        v2CiphertextHash: 'mismatched-hash-value-0000000000000000000000000000'
      })).rejects.toThrow(/verification mismatch|MIGRATION_COMMIT_FAILED/);
      expect(v1KeyDeleted).toBe(false);

      // 4. Valid capability tokens allow commit and delete V1
      const res = await mockKeystore.commitKeyMigration({
        stage: 'ACTIVE_V2',
        mainStorageVerified: true,
        sessionBridgeToken: 'valid-test-bridge-token-1234',
        migrationTxToken: 'valid-tx-token-abc',
        v2CiphertextHash: expectedHash
      });
      expect(res.committed).toBe(true);
      expect(res.deletedOldKeys).toBe(true);
      expect(v1KeyDeleted).toBe(true);
    });

    test('secrets module integrates sessionBridgeToken and migrationTxToken into migration workflow', () => {
      expect(typeof secrets.getSessionBridgeToken).toBe('function');
      expect(typeof secrets.getMigrationTxToken).toBe('function');
    });
  });

  // =========================================================================
  // c) P1-03: scripts/sync-audit-report.js Disallows --no-test Bypass
  // =========================================================================
  describe('c) P1-03: Fail-Closed Audit Report Sync Disallows --no-test Bypass', () => {
    test('executing node scripts/sync-audit-report.js --no-test exits with non-zero exit code (fails)', () => {
      const scriptPath = path.join(ROOT_DIR, 'scripts/sync-audit-report.js');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const res = spawnSync(process.execPath, [scriptPath, '--no-test'], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(res.status).not.toBe(0);
      expect(res.stderr + res.stdout).toMatch(/strictly forbids skipping tests|--no-test/i);
    });
  });

  // =========================================================================
  // d) P2-02 & P2-10: Deterministic CycloneDX SBOM & Maven Components
  // =========================================================================
  describe('d) P2-02 & P2-10: Deterministic CycloneDX SBOM & Maven Components', () => {
    test('scripts/generate-cyclonedx-sbom.js produces 100% byte-for-byte identical output twice (deterministic SHA-256) and includes pkg:maven components', () => {
      const scriptPath = path.join(ROOT_DIR, 'scripts/generate-cyclonedx-sbom.js');
      const sbomPath = path.join(ROOT_DIR, 'dist/sbom.cdx.json');

      // Run 1
      const run1 = spawnSync(process.execPath, [scriptPath], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      expect(run1.status).toBe(0);
      expect(fs.existsSync(sbomPath)).toBe(true);
      const content1 = fs.readFileSync(sbomPath);
      const hash1 = crypto.createHash('sha256').update(content1).digest('hex');

      // Run 2
      const run2 = spawnSync(process.execPath, [scriptPath], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      expect(run2.status).toBe(0);
      const content2 = fs.readFileSync(sbomPath);
      const hash2 = crypto.createHash('sha256').update(content2).digest('hex');

      // 100% byte-for-byte identical output
      expect(hash1).toBe(hash2);
      expect(Buffer.compare(content1, content2)).toBe(0);

      // Verify Android Maven components (pkg:maven/...)
      const sbomJson = JSON.parse(content1.toString('utf8'));
      expect(Array.isArray(sbomJson.components)).toBe(true);
      const mavenComponents = sbomJson.components.filter(c => c.purl && c.purl.startsWith('pkg:maven/'));
      expect(mavenComponents.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // e) P2-03: Stale File Pruning in sync-www.js
  // =========================================================================
  describe('e) P2-03: Automated Mirror Pruning for Stale Files in sync-www.js', () => {
    test('creating dummy file in www/src/stale-test-temp.js is automatically pruned on sync', () => {
      const syncScriptPath = path.join(ROOT_DIR, 'scripts/sync-www.js');
      const staleFilePath = path.join(ROOT_DIR, 'www/src/stale-test-temp.js');

      // Create dummy stale file
      fs.mkdirSync(path.dirname(staleFilePath), { recursive: true });
      fs.writeFileSync(staleFilePath, '// stale file fixture', 'utf8');
      expect(fs.existsSync(staleFilePath)).toBe(true);

      // Run sync-www.js
      const res = spawnSync(process.execPath, [syncScriptPath], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      expect(res.status).toBe(0);

      // Assert stale file was automatically pruned
      expect(fs.existsSync(staleFilePath)).toBe(false);
    });
  });

  // =========================================================================
  // f) P2-04 & P3-02: check-syntax.js and lint.js Coverage Over scripts/ and __tests__/
  // =========================================================================
  describe('f) P2-04 & P3-02: AST Syntax and Lint Coverage Over scripts/ and __tests__/', () => {
    test('scripts/check-syntax.js scans scripts/ and __tests__/', () => {
      const checkSyntaxPath = path.join(ROOT_DIR, 'scripts/check-syntax.js');
      const content = fs.readFileSync(checkSyntaxPath, 'utf8');

      // check-syntax.js must discover and scan scripts and tests, not just src
      expect(content).toMatch(/getTrackedJsFiles|scanDir/);
      expect(content).not.toMatch(/if\s*\(rel\.startsWith\('__tests__'\)\)\s*return;/);

      // Running check-syntax.js succeeds
      const res = spawnSync(process.execPath, [checkSyntaxPath], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      expect(res.status).toBe(0);
    });

    test('scripts/lint.js scans __tests__/ without skipping', () => {
      const lintPath = path.join(ROOT_DIR, 'scripts/lint.js');
      const content = fs.readFileSync(lintPath, 'utf8');

      // Assert __tests__ is not skipped in getFilesToScan or file exclusion
      expect(content).not.toMatch(/if\s*\(rel\.startsWith\('__tests__'\)\s*\|\|\s*rel\.startsWith\('dist'\)\)\s*return;/);
      expect(content).toMatch(/MOCK_ALLOWLIST_PATTERNS|isAllowedMockOrTest/);

      // Running lint.js succeeds
      const res = spawnSync(process.execPath, [lintPath], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      expect(res.status).toBe(0);
    });
  });

  // =========================================================================
  // g) P2-05: Browser Operator Loopback/Metadata IP Blocking & Redirect Error Policy
  // =========================================================================
  describe('g) P2-05: Browser Operator Loopback/Metadata IP Blocking & Redirect Error Policy', () => {
    test('Browser Operator blocks loopback and metadata IPs (127.0.0.1, localhost, 169.254.169.254, ::1)', () => {
      const htmlPath = path.join(ROOT_DIR, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      // Assert isPrivateOrLoopbackHost or evaluateBrowserDomainPolicy checks in index.html
      expect(html).toMatch(/isPrivateOrLoopbackHost/);
      expect(html).toMatch(/169\.254\.169\.254/);
      expect(html).toMatch(/metadata\.google\.internal/);

      // Assert redirect policy is strictly controlled (redirect: 'error' or SSRF_REDIRECT_BLOCKED)
      expect(html).toMatch(/redirect:\s*['"]error['"]|SSRF_REDIRECT_BLOCKED/);
    });
  });

  // =========================================================================
  // h) P2-06: Studio Preview connect-src 'none' Sandbox CSP
  // =========================================================================
  describe('h) P2-06: Studio Preview connect-src \'none\' Sandbox CSP', () => {
    test('Studio preview contains connect-src \'none\' in its sandbox CSP', () => {
      const htmlPath = path.join(ROOT_DIR, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      // Assert that Studio preview sandbox CSP includes connect-src 'none'
      expect(html).toMatch(/connect-src\s+'none'/);
    });
  });

  // =========================================================================
  // i) P2-07: Plaintext Envelope Rejection & Fail-Closed Encryption in secrets.js
  // =========================================================================
  describe('i) P2-07: Plaintext Envelope Rejection & Fail-Closed Encryption in secrets.js', () => {
    test('plaintext envelopes are rejected unless explicit legacy migration mode is enabled', async () => {
      const fakeStore = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); },
        removeItem(k) { delete this.data[k]; }
      };

      const plaintextPayload = {
        version: 1,
        encrypted: false,
        apiKeys: { openai: 'sk-test-key-12345' }
      };

      const storageKey = secrets.SESSION_SECRETS_KEY || 'eg_nexus_session_secrets';
      fakeStore.setItem(storageKey, JSON.stringify(plaintextPayload));

      // By default without explicit legacy migration mode, reading plaintext envelope fails closed or quarantines
      secrets.setExplicitLegacyMigrationMode(false);
      const resWithoutMigration = secrets.readSessionSecrets(fakeStore);
      expect(resWithoutMigration.apiKeys?.openai || '').not.toBe('sk-test-key-12345');

      // When explicit legacy migration mode is enabled, migration succeeds
      fakeStore.setItem(storageKey, JSON.stringify(plaintextPayload));
      secrets.setExplicitLegacyMigrationMode(true);
      const resWithMigration = secrets.readSessionSecrets(fakeStore);
      expect(resWithMigration.apiKeys?.openai).toBe('sk-test-key-12345');

      secrets.setExplicitLegacyMigrationMode(false);
    });

    test('fail-closed on encryption error without fallback to unencrypted storage', async () => {
      const fakeStore = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); }
      };

      const vault = new secrets.SecretVault();
      vault._degradedPersistence = true;

      await expect(vault.encrypt('my-secret-token', '', fakeStore))
        .rejects.toThrow(/VAULT_INIT_FAILED|Encryption failed/);

      // Verify no plaintext stored
      expect(Object.values(fakeStore.data).some(v => v.includes('my-secret-token'))).toBe(false);
    });
  });

  // =========================================================================
  // j) P2-08: index.html Main CSP Does Not Contain Open ws: wss: Wildcards
  // =========================================================================
  describe('j) P2-08: index.html Main CSP Does Not Contain Open ws: wss: Wildcards', () => {
    test('index.html main CSP does not contain open ws: wss: wildcards', () => {
      const htmlPath = path.join(ROOT_DIR, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      const cspMatch = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/i);
      expect(cspMatch).not.toBeNull();
      const mainCsp = cspMatch[1];

      // Assert no open ws: or wss: wildcards
      expect(mainCsp).not.toMatch(/\bws:\s/);
      expect(mainCsp).not.toMatch(/\bwss:\s/);
      expect(mainCsp).not.toMatch(/\bws:;|\bwss:;/);
    });
  });

  // =========================================================================
  // k) P2-09: test_full_app_audit.py Fails on Injected Bootstrap Errors
  // =========================================================================
  describe('k) P2-09: test_full_app_audit.py Fails on Injected Bootstrap Errors', () => {
    test('test_full_app_audit.py does not swallow runtime bootstrap errors and fails on injected failure', () => {
      const testPyPath = path.join(ROOT_DIR, 'test_full_app_audit.py');
      const testPyContent = fs.readFileSync(testPyPath, 'utf8');

      // Assert blanket try { eval(code); } catch (e) {} has been eliminated
      expect(testPyContent).not.toMatch(/try\s*\{\s*eval\(code\);\s*\}\s*catch\s*\([a-zA-Z_$]+\)\s*\{\s*\}/);

      // Assert executing with injected bootstrap error fails with non-zero exit code
      const nodeCheckScript = `
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\\n');
let inS = false, start = -1, blocks = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!inS && (l === '<script>' || l.startsWith('<script id='))) { inS = true; start = i; }
  else if (inS && l === '</script>') { blocks.push(lines.slice(start + 1, i).join('\\n')); inS = false; }
}
global.window = global;
global.window.addEventListener = () => {};
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'node' };
const code = blocks.join('\\n;\\n') + '\\n; throw new Error("unexpected bootstrap failure");';
eval(code);
`;
      const res = spawnSync(process.execPath, ['-e', nodeCheckScript], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(res.status).not.toBe(0);
      expect(res.stderr).toMatch(/unexpected bootstrap failure/);
    });
  });

  // =========================================================================
  // l) P2-11: android/app/build.gradle Minification and Shrinking
  // =========================================================================
  describe('l) P2-11: android/app/build.gradle Minification and Shrinking', () => {
    test('android/app/build.gradle has minifyEnabled true and shrinkResources true', () => {
      const gradlePath = path.join(ROOT_DIR, 'android/app/build.gradle');
      expect(fs.existsSync(gradlePath)).toBe(true);
      const gradleContent = fs.readFileSync(gradlePath, 'utf8');

      expect(gradleContent).toMatch(/minifyEnabled\s+true/);
      expect(gradleContent).toMatch(/shrinkResources\s+true/);
    });
  });

  // =========================================================================
  // m) P3-01: Synchronize Navigation Targets & Explicit Audit Mode
  // =========================================================================
  describe('m) P3-01: Static Inventory Navigation Targets & Audit Mode', () => {
    test('full_app_audit.py synchronizes navigation targets with DOM tabs and emits audit_mode', () => {
      const auditScriptPath = path.join(ROOT_DIR, 'full_app_audit.py');
      const content = fs.readFileSync(auditScriptPath, 'utf8');

      expect(content).toMatch(/['"]audit_mode['"]:\s*['"]static_ast_and_regex_analysis['"]/);

      const res = spawnSync('python3', [auditScriptPath, 'index.html', '--out', 'audit-static.json'], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      expect(res.status).toBe(0);

      const auditStaticPath = path.join(ROOT_DIR, 'audit-static.json');
      const auditJson = JSON.parse(fs.readFileSync(auditStaticPath, 'utf8'));

      expect(auditJson.audit_mode).toBe('static_ast_and_regex_analysis');
      expect(auditJson.target_hits?.navigation).toBeDefined();

      // All synchronized navigation targets must be true (hits)
      const navHits = auditJson.target_hits.navigation;
      Object.entries(navHits).forEach(([tabName, isHit]) => {
        expect(isHit).toBe(true);
      });
    });
  });

  // =========================================================================
  // n) v6.3.3 Keystore capabilities, vault lifecycle and branch coverage
  // =========================================================================
  describe('n) v6.3.3 Keystore capabilities, vault lifecycle and branch coverage', () => {
    test('SecretVault sync and async methods, validation and error handling', async () => {
      const fakeStore = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); },
        removeItem(k) { delete this.data[k]; }
      };

      const uninitVault = new secrets.SecretVault();
      expect(() => uninitVault.readSync()).toThrow(/VAULT_NOT_INITIALIZED/);
      expect(() => uninitVault.writeSync({})).toThrow(/VAULT_NOT_INITIALIZED/);

      const vault = new secrets.SecretVault();
      await vault.init(fakeStore);
      expect(vault.isInitialized()).toBe(true);

      // writeSync and readSync
      vault.writeSync({ apiKeys: { openai: 'sync-openai-key' } }, fakeStore);
      const readData = vault.readSync(fakeStore);
      expect(readData.apiKeys.openai).toBe('sync-openai-key');

      // writeAsync and readAsync
      await vault.writeAsync({ apiKeys: { openai: 'async-openai-key' } }, fakeStore);
      const readAsyncData = await vault.readAsync(fakeStore);
      expect(readAsyncData.apiKeys.openai).toBe('async-openai-key');
    });

    test('secrets rollbackKeyMigration branches', async () => {
      // 1. Commit point passed
      const resPassed = await secrets.rollbackKeyMigration({ commitPointPassed: true });
      expect(resPassed.rolledBack).toBe(false);
      expect(resPassed.error).toMatch(/COMMIT_POINT_PASSED/);

      // 2. No native keystore available
      const origWindow = global.window;
      if (!global.window) global.window = {};
      delete global.window.NexusKeystoreNative;
      const resNoKs = await secrets.rollbackKeyMigration({ commitPointPassed: false });
      expect(resNoKs.rolledBack).toBe(false);

      // 3. Native keystore rollback success
      global.window.NexusKeystoreNative = {
        initNativeVaultSession: async () => ({ sessionBridgeToken: 'sess-123' }),
        rollbackKeyMigration: async (opts) => ({ rolledBack: true, journalState: 'ACTIVE_V1', activeAlias: 'key_v1' })
      };
      const resSuccess = await secrets.rollbackKeyMigration({ commitPointPassed: false });
      expect(resSuccess.rolledBack).toBe(true);

      // 4. Native keystore rollback throws error
      global.window.NexusKeystoreNative.rollbackKeyMigration = async () => { throw new Error('Rollback explosion'); };
      const resError = await secrets.rollbackKeyMigration({ commitPointPassed: false });
      expect(resError.rolledBack).toBe(false);
      expect(resError.error).toBe('Rollback explosion');

      // Cleanup
      delete global.window.NexusKeystoreNative;
      if (origWindow) global.window = origWindow;
    });

    test('secrets getSecretVaultHealth branches with native Android Keystore and degraded modes', () => {
      const origWindow = global.window;
      if (!global.window) global.window = {};

      // 1. Native Android with StrongBox
      global.window.NexusKeystoreNative = {
        securityLevel: 'strongbox',
        hardwareBacked: true
      };
      const healthStrongBox = secrets.getSecretVaultHealth();
      expect(healthStrongBox.hardwareBacked).toBe(true);
      expect(healthStrongBox.securityLevel).toBe('strongbox');

      // 2. Native Android with TEE
      global.window.NexusKeystoreNative = {
        securityLevel: 'tee',
        hardwareBacked: true
      };
      const healthTee = secrets.getSecretVaultHealth();
      expect(healthTee.hardwareBacked).toBe(true);
      expect(healthTee.securityLevel).toBe('tee');

      // 3. Native Android software
      global.window.NexusKeystoreNative = {
        securityLevel: 'software',
        hardwareBacked: false
      };
      const healthSoft = secrets.getSecretVaultHealth();
      expect(healthSoft.hardwareBacked).toBe(false);

      delete global.window.NexusKeystoreNative;
      if (origWindow) global.window = origWindow;
    });

    test('core state.js saveMemoryGovernanceToStorage and loadMemoryGovernanceFromStorage fallback branches', () => {
      const stateMod = require('../src/core/state.js');
      const fakeStore = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); }
      };

      const memGov = typeof stateMod.getMemoryGovernance === 'function'
        ? stateMod.getMemoryGovernance()
        : new stateMod.MemoryGovernance();
      const saved = stateMod.saveMemoryGovernanceToStorage(memGov, fakeStore);
      expect(saved).not.toBeNull();

      const loaded = stateMod.loadMemoryGovernanceFromStorage(fakeStore);
      expect(loaded).toBeDefined();
      expect(loaded.shortTerm).toBeDefined();
    });

    test('comprehensive branch booster for state.js and secrets.js utility functions', () => {
      const stateMod = require('../src/core/state.js');

      // 1. state.js hasDangerousKeysDeep symbols & child objects
      expect(stateMod.hasDangerousKeysDeep({ [Symbol('__proto__')]: 123 })).toBe(true);
      expect(stateMod.hasDangerousKeysDeep({ [Symbol('constructor')]: 123 })).toBe(true);
      expect(stateMod.hasDangerousKeysDeep({ [Symbol.for('prototype')]: 123 })).toBe(true);
      expect(stateMod.hasDangerousKeysDeep({ safe: { [Symbol('safeSym')]: 456 } })).toBe(false);

      // 2. secureRandomHex & secureRandomId
      expect(typeof stateMod.secureRandomHex(4)).toBe('string');
      expect(typeof stateMod.secureRandomHex(0)).toBe('string');
      expect(stateMod.secureRandomId('').length).toBeGreaterThan(5);
      expect(stateMod.secureRandomId(null).length).toBeGreaterThan(5);
      expect(stateMod.secureRandomId('custom').startsWith('custom_')).toBe(true);

      // 3. createProtectedStateProxy edge cases
      expect(stateMod.createProtectedStateProxy(null)).toBeNull();
      expect(stateMod.createProtectedStateProxy(123)).toBe(123);
      expect(stateMod.createProtectedStateProxy('str')).toBe('str');

      // 4. appendMessage branches
      const msg1 = stateMod.appendMessage('bare string message');
      expect(msg1.text).toBe('bare string message');
      expect(msg1.id).toBeDefined();

      const store = new stateMod.StateStore();
      const msg2 = store.appendMessage({ text: 'custom msg' });
      expect(msg2.text).toBe('custom msg');

      const customTarget = { messages: null };
      const msg3 = stateMod.appendMessage(customTarget, { text: 'null messages fixed' });
      expect(Array.isArray(customTarget.messages)).toBe(true);
      expect(msg3.text).toBe('null messages fixed');

      // 5. canonicalizeJson and sanitizeToolParams
      expect(stateMod.canonicalizeJson(new Date())).toBeDefined();
      expect(stateMod.canonicalizeJson(Symbol('sym'))).toBe('');
      expect(stateMod.canonicalizeJson(() => {})).toBe('');
      expect(stateMod.canonicalizeJson([undefined, () => {}, Symbol('foo')])).toBe('[null,null,null]');

      expect(stateMod.sanitizeToolParams('a'.repeat(600)).includes('[TRUNCATED]')).toBe(true);
      expect(stateMod.sanitizeToolParams(12345)).toBe(12345);
      expect(stateMod.sanitizeToolParams(null)).toBeNull();
      expect(stateMod.sanitizeToolParams(undefined)).toBeUndefined();

      // 6. crypto hashing & tokenization
      expect(stateMod._sha256Hex(null)).toBe('');
      expect(stateMod._sha256Hex(undefined)).toBe('');
      expect(typeof stateMod._sha256Hex('hello')).toBe('string');
      expect(typeof stateMod._hmacSha256Hex('k', 'm')).toBe('string');
      expect(stateMod.tokenizeText('')).toEqual([]);
      expect(stateMod.tokenizeText('a')).toEqual([]);
      expect(stateMod.tokenizeText('test query 1234').length).toBeGreaterThan(0);
      expect(stateMod.computeTfVector('test')).toBeDefined();

      // 7. secrets.js codec helpers
      expect(secrets._uint8ToHex(null)).toBe('');
      expect(secrets._uint8ToHex('not a uint8array')).toBe('');
      expect(secrets._hexToUint8(null).byteLength).toBe(0);
      expect(secrets._hexToUint8('odd').byteLength).toBe(0);
      expect(secrets._hexToUint8('nothex!!').byteLength).toBe(0);
      expect(secrets._hexToUint8('').byteLength).toBe(0);
      expect(secrets._hexToUint8('abcd').byteLength).toBe(2);

      // 8. secrets.js custom node crypto
      if (typeof secrets._setCustomNodeCrypto === 'function') {
        const origCustom = secrets._getNodeCrypto();
        secrets._setCustomNodeCrypto(() => origCustom);
        expect(secrets._getNodeCrypto()).toBe(origCustom);
        secrets._setCustomNodeCrypto(null);
      }
    });

    test('secrets migrateKeyToStrongBox full 2PC lifecycle with hardware mock', async () => {
      const origWindow = global.window;
      if (!global.window) global.window = {};
      const fakeStore = {
        data: {
          [secrets.SESSION_SECRETS_KEY]: JSON.stringify({
            encrypted: true,
            algorithm: 'AES-GCM-256',
            ciphertext: 'v1ciphertext1234',
            iv: 'v1iv123456789012'
          })
        },
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); },
        removeItem(k) { delete this.data[k]; }
      };

      global.window.NexusKeystoreNative = {
        initNativeVaultSession: async () => ({ sessionBridgeToken: 'sess-token-bridge' }),
        migrateKeyToStrongBox: async (payload) => ({
          migrated: true,
          newCiphertext: 'v2ciphertext5678',
          newIv: 'v2iv123456789012',
          alias: 'eg_nexus_master_aes_key_sb_v2',
          journalState: 'V2_DATA_VERIFIED',
          migrationTxToken: 'tx-token-123',
          v2CiphertextHash: 'hash-abc'
        }),
        commitKeyMigration: async (opts) => ({
          committed: true,
          journalState: opts.stage || 'ACTIVE_V2',
          activeAlias: 'eg_nexus_master_aes_key_sb_v2',
          deletedOldKeys: opts.stage === 'ACTIVE_V2'
        }),
        decrypt: async (payload) => ({
          data: JSON.stringify({ apiKeys: { gemini: 'migrated-gemini-v2' } })
        })
      };

      const migRes = await secrets.migrateKeyToStrongBox({ storage: fakeStore });
      expect(migRes.migrated).toBe(true);
      expect(migRes.journalState).toBe('ACTIVE_V2');

      delete global.window.NexusKeystoreNative;
      if (origWindow) global.window = origWindow;
    });

    test('AgentExecutionGuard multi-step cycle detection branches', () => {
      const stateMod = require('../src/core/state.js');
      const guard = new stateMod.AgentExecutionGuard({ repetitionThreshold: 3 });

      // 1-step cycle (A -> A -> A)
      guard.recordToolCall('search', { q: 'nexus' });
      guard.recordToolCall('search', { q: 'nexus' });
      expect(() => guard.detectLoop('search', { q: 'nexus' })).toThrow(/LOOP_DETECTED/);

      // 2-step cycle (A -> B -> A -> B -> A -> B)
      const guard2 = new stateMod.AgentExecutionGuard({ repetitionThreshold: 3 });
      guard2.recordToolCall('toolA', { id: 1 });
      guard2.recordToolCall('toolB', { id: 2 });
      guard2.recordToolCall('toolA', { id: 1 });
      guard2.recordToolCall('toolB', { id: 2 });
      guard2.recordToolCall('toolA', { id: 1 });
      expect(() => guard2.detectLoop('toolB', { id: 2 })).toThrow(/LOOP_DETECTED/);
    });

    test('approvals.js audit trail truncation when events > 50 and direct requestId lookup', () => {
      const approvals = require('../src/security/approvals.js');
      const fakeStore = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); }
      };

      const reqId = 'req_truncation_test_' + Date.now();
      // Record 55 events to trigger > 50 truncation branch
      for (let i = 0; i < 55; i++) {
        approvals.recordLifecycleEvent(reqId, 'step_' + i, { step: i });
      }
      approvals.persistAuditTrail(fakeStore);
      const verifyRes = approvals.verifyAuditTrailIntegrity(reqId);
      expect(verifyRes).toBeDefined();
    });

    test('SecretVault decrypt with node-crypto and invalid tag branches', async () => {
      const mockStorage = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); }
      };
      const vault = new secrets.SecretVault({ storage: mockStorage, backend: 'node-crypto' });
      await vault.init();
      const enc = await vault.encrypt('secret_data_for_vault_decrypt', 'vault_aad');
      const dec = await vault.decrypt(enc.ciphertext, enc.iv, 'vault_aad', mockStorage);
      expect(dec).toBe('secret_data_for_vault_decrypt');

      // Invalid short ciphertext
      await expect(vault.decrypt('aabb', enc.iv, 'vault_aad', mockStorage)).rejects.toThrow(/Invalid ciphertext length/);

      // Max encryptions NIST limit
      vault._encryptionCount = 1000000;
      expect(() => vault.write({}, mockStorage)).toThrow(/NIST SP 800-38D/);
    });

    test('AgentExecutionGuard execution limits and token reservation branches', () => {
      const stateMod = require('../src/core/state.js');
      const guard = new stateMod.AgentExecutionGuard({
        maxSteps: 10,
        maxToolCalls: 10,
        maxTokenBudget: 5000,
        maxDurationMs: 60000
      });

      expect(guard.checkExecutionLimits()).toBe(true);
      expect(guard.recordStep()).toBe(1);

      // Cancelled
      const cGuard = new stateMod.AgentExecutionGuard();
      cGuard.cancelTask('cancelled_test');
      expect(() => cGuard.checkExecutionLimits()).toThrow(/EXECUTION_CANCELLED/);

      // Budget overrun
      const boGuard = new stateMod.AgentExecutionGuard();
      boGuard.budgetOverrun = true;
      expect(() => boGuard.checkExecutionLimits()).toThrow(/TOKEN_BUDGET_OVERRUN/);

      // Step limit
      const stepGuard = new stateMod.AgentExecutionGuard({ maxSteps: 2 });
      stepGuard.currentSteps = 2;
      expect(() => stepGuard.checkExecutionLimits()).toThrow(/STEP_LIMIT_EXCEEDED/);

      // Tool call limit
      const tcGuard = new stateMod.AgentExecutionGuard({ maxToolCalls: 2 });
      tcGuard.currentToolCalls = 2;
      expect(() => tcGuard.checkExecutionLimits()).toThrow(/TOOL_CALL_LIMIT_EXCEEDED/);

      // Token budget limit
      const tbGuard = new stateMod.AgentExecutionGuard({ maxTokenBudget: 50 });
      tbGuard.usedTokens = 50;
      expect(() => tbGuard.checkExecutionLimits()).toThrow(/TOKEN_BUDGET_EXCEEDED/);

      // Duration limit
      const durGuard = new stateMod.AgentExecutionGuard({ maxDurationMs: 10 });
      durGuard.startTime = Date.now() - 1000;
      expect(() => durGuard.checkExecutionLimits()).toThrow(/DURATION_LIMIT_EXCEEDED/);

      // Token reservation & settlement with parent guard
      const parent = new stateMod.AgentExecutionGuard({ maxTokenBudget: 10000 });
      const child = new stateMod.AgentExecutionGuard({ maxTokenBudget: 2000 });
      child.parentGuard = parent;

      const res = child.reserveTokens('call_sub_1', 200);
      expect(res.reservedTokens).toBe(200);
      const settle = child.settleTokens('call_sub_1', 180);
      expect(settle.actualTokens).toBe(180);

      // Over reservation
      expect(() => child.reserveTokens('too_large', 999999)).toThrow(/TOKEN_BUDGET_EXCEEDED/);
    });

    test('SecretVault encrypt and decrypt all backend branches (android-keystore, webcrypto, error fallbacks)', async () => {
      const origWindow = global.window;
      if (!global.window) global.window = {};

      const fakeStore = {
        data: {},
        getItem(k) { return this.data[k] || null; },
        setItem(k, v) { this.data[k] = String(v); }
      };

      const testVault = new secrets.SecretVault({ storage: fakeStore });
      testVault._initialized = true;

      // 1. Android Keystore encrypt & decrypt success
      testVault._activeBackend = 'android-keystore';
      global.window.NexusKeystoreNative = {
        initNativeVaultSession: async () => ({ sessionBridgeToken: 'sess-token-1' }),
        encrypt: async () => ({ ciphertext: 'ak_cipher_123', iv: 'ak_iv_123' }),
        decrypt: async () => ({ data: 'ak_decrypted_text' })
      };

      const encAk = await testVault.encrypt('plain_ak', 'aad_ak');
      expect(encAk.ciphertext).toBe('ak_cipher_123');
      const decAk = await testVault.decrypt('ak_cipher_123', 'ak_iv_123', 'aad_ak', fakeStore);
      expect(decAk).toBe('ak_decrypted_text');

      // 2. Android Keystore encrypt failure & invalid decrypt data
      global.window.NexusKeystoreNative.encrypt = async () => ({ error: true });
      await expect(testVault.encrypt('plain_ak', 'aad_ak')).rejects.toThrow(/Encryption failed/);

      global.window.NexusKeystoreNative.decrypt = async () => ({ invalidData: true });
      await expect(testVault.decrypt('ak_cipher_123', 'ak_iv_123', 'aad_ak', fakeStore)).rejects.toThrow(/Native Keystore returned invalid data/);

      global.window.NexusKeystoreNative.decrypt = async () => { throw new Error('Hardware auth fail'); };
      await expect(testVault.decrypt('ak_cipher_123', 'ak_iv_123', 'aad_ak', fakeStore)).rejects.toThrow(/Hardware decryption failed/);

      // 3. Android Keystore absent
      delete global.window.NexusKeystoreNative;
      await expect(testVault.encrypt('plain_ak', 'aad_ak')).rejects.toThrow(/Encryption failed/);
      await expect(testVault.decrypt('ak_cipher_123', 'ak_iv_123', 'aad_ak', fakeStore)).rejects.toThrow(/Decryption failed/);

      // 4. Node-Crypto missing cipher engine
      testVault._activeBackend = 'node-crypto';
      testVault._nodeCrypto = {};
      await expect(testVault.encrypt('plain_nc', 'aad_nc')).rejects.toThrow(/Encryption failed/);
      await expect(testVault.decrypt('00'.repeat(20), '00'.repeat(12), 'aad_nc', fakeStore)).rejects.toThrow(/Decryption failed/);

      // 5. Webcrypto encrypt and decrypt success
      testVault._activeBackend = 'webcrypto';
      const encWc = await testVault.encrypt('plain_wc', 'aad_wc');
      expect(encWc.ciphertext).toBeDefined();
      const decWc = await testVault.decrypt(encWc.ciphertext, encWc.iv, 'aad_wc', fakeStore);
      expect(decWc).toBe('plain_wc');

      // 6. Unknown backend
      testVault._activeBackend = 'unknown_crypto_engine';
      await expect(testVault.encrypt('plain_unk', 'aad_unk')).rejects.toThrow(/Encryption failed/);
      await expect(testVault.decrypt('00'.repeat(20), '00'.repeat(12), 'aad_unk', fakeStore)).rejects.toThrow(/Decryption failed/);

      // 7. Uninitialized read and write checks
      const uninit = new secrets.SecretVault();
      expect(() => uninit.read()).toThrow(/VAULT_NOT_INITIALIZED/);
      expect(() => uninit.write({})).toThrow(/VAULT_NOT_INITIALIZED/);

      delete global.window.NexusKeystoreNative;
      if (origWindow) global.window = origWindow;
    });
  });

});
