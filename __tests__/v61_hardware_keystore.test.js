'use strict';

/**
 * Test Suite for v6.1 Hardware Keystore, Barrel Bridges & Storage Resilience
 */
describe('v6.1 Hardware Keystore, Bridges & Storage Resilience', () => {
  const secrets = require('../src/security/secrets.js');
  const persistence = require('../src/core/persistence.js');

  afterEach(() => {
    delete global.window;
  });

  describe('Native Android KeyStore Bridge (src/security/secrets.js)', () => {
    test('isHardwareKeystoreAvailable returns false when window or Capacitor is absent', async () => {
      delete global.window;
      const avail = await secrets.isHardwareKeystoreAvailable();
      expect(avail).toBe(false);
      expect(secrets.getKeystoreBackend()).toBe('NodeCrypto');
    });

    test('isHardwareKeystoreAvailable returns true when Capacitor.Plugins.NexusKeystore is present', async () => {
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => ({ available: true }),
              encrypt: async ({ data }) => ({ ciphertext: 'hw:' + data, iv: '123456789012' }),
              decrypt: async ({ ciphertext }) => ({ data: ciphertext.replace(/^hw:/, '') })
            }
          }
        }
      };

      const avail = await secrets.isHardwareKeystoreAvailable();
      expect(avail).toBe(true);
      expect(secrets.getKeystoreBackend()).toBe('AndroidKeyStore');

      const health = secrets.getSecretVaultHealth();
      expect(health.hardwareKeystoreAvailable).toBe(true);
    });

    test('SecretVault init, encrypt and decrypt with Hardware KeyStore active', async () => {
      const mockPlugin = {
        isAvailable: async () => ({ available: true }),
        encrypt: jest.fn(async ({ data }) => ({
          ciphertext: 'hw_encrypted_' + data,
          iv: '123456789012'
        })),
        decrypt: jest.fn(async ({ ciphertext }) => ({
          data: ciphertext.replace(/^hw_encrypted_/, '')
        }))
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockPlugin
          }
        }
      };

      const vault = new secrets.SecretVault();
      await vault.init();
      expect(vault.hardwareBacked).toBe(true);
      expect(vault.initialized).toBe(true);

      const enc = await vault.encrypt('secret-test-payload');
      expect(mockPlugin.encrypt).toHaveBeenCalled();
      expect(enc.ciphertext).toBe('hw_encrypted_secret-test-payload');
      expect(enc.keySource).toBe('AndroidKeyStore');

      const dec = await vault.decrypt(enc.ciphertext, enc.iv);
      expect(mockPlugin.decrypt).toHaveBeenCalled();
      expect(dec).toBe('secret-test-payload');
    });

    test('Hardware KeyStore fallback handles plugin error gracefully', async () => {
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => { throw new Error('Keystore probe error'); },
              encrypt: async () => { throw new Error('Keystore hardware fault'); },
              decrypt: async () => { throw new Error('Keystore hardware fault'); }
            }
          }
        }
      };

      const avail = await secrets.isHardwareKeystoreAvailable();
      expect(avail).toBe(false);

      const vault = new secrets.SecretVault();
      await vault.init();
      expect(vault.initialized).toBe(true);
      expect(vault.hardwareBacked).toBeUndefined();
    });

    test('getKeySecurityInfo detects StrongBox and TEE security levels', async () => {
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' }),
              getKeySecurityInfo: async () => ({ available: true, hardwareBacked: true, securityLevel: 'strongbox' })
            }
          }
        }
      };

      const info = await secrets.getKeySecurityInfo();
      expect(info.available).toBe(true);
      expect(info.hardwareBacked).toBe(true);
      expect(info.securityLevel).toBe('strongbox');
      expect(info.backend).toBe('AndroidKeyStore');
    });

    test('getKeySecurityInfo reports software when hardwareBacked is false', async () => {
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => ({ available: true, hardwareBacked: false, securityLevel: 'software' }),
              getKeySecurityInfo: async () => ({ available: true, hardwareBacked: false, securityLevel: 'software' })
            }
          }
        }
      };

      const info = await secrets.getKeySecurityInfo();
      expect(info.available).toBe(true);
      expect(info.hardwareBacked).toBe(false);
      expect(info.securityLevel).toBe('software');

      const avail = await secrets.isHardwareKeystoreAvailable();
      expect(avail).toBe(false);
    });

    test('SecretVault enforces AAD in hardware keystore and fails closed when AAD changes', async () => {
      let storedAad = null;
      const mockPlugin = {
        isAvailable: async () => ({ available: true, hardwareBacked: true, securityLevel: 'tee' }),
        encrypt: jest.fn(async ({ data, aad }) => {
          storedAad = aad;
          return { ciphertext: 'cipher_' + data, iv: 'iv1234567890', aad };
        }),
        decrypt: jest.fn(async ({ ciphertext, iv, aad }) => {
          if (aad !== storedAad) {
            throw new Error('GCM tag authentication failed (AAD mismatch)');
          }
          return { data: ciphertext.replace(/^cipher_/, '') };
        })
      };

      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: mockPlugin
          }
        }
      };

      const vault = new secrets.SecretVault();
      await vault.init();
      expect(vault.hardwareBacked).toBe(true);
      expect(vault.securityLevel).toBe('tee');

      const enc = await vault.encrypt('authenticated-secret', 'user_session_aad_123');
      expect(mockPlugin.encrypt).toHaveBeenCalledWith({ data: 'authenticated-secret', aad: 'user_session_aad_123' });
      expect(enc.aad).toBe('user_session_aad_123');

      // Successful decryption with matching AAD
      const dec = await vault.decrypt(enc.ciphertext, enc.iv, 'user_session_aad_123');
      expect(dec).toBe('authenticated-secret');

      // Failed decryption when AAD is changed (tampering)
      await expect(vault.decrypt(enc.ciphertext, enc.iv, 'tampered_aad_wrong')).rejects.toThrow(/Hardware decryption failed/);
    });

    test('getKeySecurityInfo exercises all fallback branches', async () => {
      // Branch 1: ks throws error
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              getKeySecurityInfo: async () => { throw new Error('Hardware failure'); }
            }
          }
        }
      };
      const errInfo = await secrets.getKeySecurityInfo();
      expect(errInfo.available).toBe(false);
      expect(errInfo.error).toBe('Hardware failure');

      // Branch 2: ks has only isAvailable (no getKeySecurityInfo)
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => ({ available: true, hardwareBacked: true })
            }
          }
        }
      };
      const fallbackInfo = await secrets.getKeySecurityInfo();
      expect(fallbackInfo.available).toBe(true);
      expect(fallbackInfo.securityLevel).toBe('tee');

      // Branch 3: ks isAvailable returns hardwareBacked false
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              isAvailable: async () => ({ available: true, hardwareBacked: false })
            }
          }
        }
      };
      const softInfo = await secrets.getKeySecurityInfo();
      expect(softInfo.securityLevel).toBe('software');

      // Branch 4: no ks plugin
      delete global.window;
      const noKs = await secrets.getKeySecurityInfo();
      expect(noKs.available).toBe(false);
    });

    test('One-Time Capability Approval Token branch coverage', async () => {
      const registry = require('../src/providers/registry.js');
      const approvals = require('../src/security/approvals.js');

      // 1. null / invalid token
      expect(registry.consumeApprovalToken(null)).toBe(false);
      expect(registry.consumeApprovalToken('')).toBe(false);
      expect(registry.consumeApprovalToken(123)).toBe(false);
      expect(registry.verifyApprovalToken(null)).toBe(false);

      // 2. non-existent token
      expect(registry.consumeApprovalToken('appr_nonexistent_token')).toBe(false);
      expect(registry.verifyApprovalToken('appr_nonexistent_token')).toBe(false);

      // 3. token with mismatched providerId
      const tok1 = registry.issueApprovalToken({ providerId: 'github', action: 'push' });
      expect(registry.consumeApprovalToken(tok1, { providerId: 'wrong_provider' })).toBe(false);

      // 4. token with mismatched action
      const tok2 = registry.issueApprovalToken({ providerId: 'github', action: 'push' });
      expect(registry.consumeApprovalToken(tok2, { providerId: 'github', action: 'delete' })).toBe(false);

      // 5. token with mismatched paramsHash
      const tok3 = registry.issueApprovalToken({ providerId: 'github', action: 'push', paramsHash: 'hash_1' });
      expect(registry.consumeApprovalToken(tok3, { providerId: 'github', action: 'push', paramsHash: 'hash_2' })).toBe(false);

      // 6. token with params mismatch
      const tok4 = registry.issueApprovalToken({ providerId: 'github', action: 'push', params: { file: 'a.txt' } });
      expect(registry.consumeApprovalToken(tok4, { providerId: 'github', action: 'push', params: { file: 'b.txt' } })).toBe(false);

      // 7. token with params match
      const tok5 = registry.issueApprovalToken({ providerId: 'github', action: 'push', params: { file: 'a.txt' } });
      expect(registry.consumeApprovalToken(tok5, { providerId: 'github', action: 'push', params: { file: 'a.txt' } })).toBe(true);

      // 8. token expiration
      const tok6 = registry.issueApprovalToken({ providerId: 'github', action: 'push' });
      const entry = globalThis.__nexusApprovalTokens.get(tok6);
      entry.expiresAt = Date.now() - 1000; // expired
      expect(registry.verifyApprovalToken(tok6)).toBe(false);
      const tok7 = registry.issueApprovalToken({ providerId: 'github', action: 'push' });
      const entry7 = globalThis.__nexusApprovalTokens.get(tok7);
      entry7.expiresAt = Date.now() - 1000;
      expect(registry.consumeApprovalToken(tok7)).toBe(false);

      // 9. approvals.js module token functions
      const tokAppr = approvals.issueApprovalToken({ providerId: 'gmail', action: 'send' });
      expect(approvals.verifyApprovalToken(tokAppr)).toBe(true);
      expect(approvals.consumeApprovalToken(tokAppr, { providerId: 'gmail', action: 'send' })).toBe(true);
      expect(approvals.consumeApprovalToken(tokAppr)).toBe(false); // replay blocked

      // 10. clearApprovalTokens
      const tokClear = approvals.issueApprovalToken({ providerId: 'gmail', action: 'send' });
      approvals.clearApprovalTokens();
      expect(approvals.verifyApprovalToken(tokClear)).toBe(false);

      // 11. executeProviderRequest with invalid approvalToken
      const resBad = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_dummy_token_123456789012345678901234567890',
        grantedScopes: ['repo'],
        approvalToken: 'invalid_token_id'
      });
      expect(resBad.status).toBe(403);
      expect(resBad.error).toBe('APPROVAL_REQUIRED');
    });

    test('validateProviderScope exhaustive branch coverage', () => {
      const registry = require('../src/providers/registry.js');
      expect(registry.validateProviderScope('github', 'push', null)).toBe(false);
      expect(registry.validateProviderScope('github', 'push', undefined)).toBe(false);
      expect(registry.validateProviderScope('github', 'push', [])).toBe(false);
      expect(registry.validateProviderScope('github', 'push', [''])).toBe(false);
      expect(registry.validateProviderScope('github', 'push', '   ')).toBe(false);
      expect(registry.validateProviderScope('github', 'push', 999)).toBe(false);
      expect(registry.validateProviderScope('github', 'push', ['*', 'repo'])).toBe(true);
      expect(registry.validateProviderScope('github', 'push', ['all', 'repo'])).toBe(true);
      expect(registry.validateProviderScope('github', 'push', ['admin', 'repo'])).toBe(true);
      expect(registry.validateProviderScope('github', 'push', ['admin'])).toBe(false);
      expect(registry.validateProviderScope('github', 'push', ['all'])).toBe(false);
      expect(registry.validateProviderScope('github', 'push', ['*'])).toBe(false);
    });
  });

  describe('Storage Guard & In-Memory Fallback (src/core/persistence.js)', () => {
    test('createMemoryStorage provides a full localStorage-compatible Map storage', () => {
      const store = persistence.createMemoryStorage();
      expect(store.length).toBe(0);
      expect(store.getItem('nonexistent')).toBeNull();

      store.setItem('key1', 'val1');
      expect(store.getItem('key1')).toBe('val1');
      expect(store.length).toBe(1);
      expect(store.key(0)).toBe('key1');

      store.removeItem('key1');
      expect(store.getItem('key1')).toBeNull();
      expect(store.length).toBe(0);

      store.setItem('a', '1');
      store.setItem('b', '2');
      store.clear();
      expect(store.length).toBe(0);
    });

    test('installStorageGuard replaces throwing localStorage and sessionStorage with memory shim', () => {
      const mockWin = {
        localStorage: {
          getItem: () => { throw new Error('SecurityError: Access denied'); },
          setItem: () => { throw new Error('SecurityError: Access denied'); },
          removeItem: () => { throw new Error('SecurityError: Access denied'); }
        },
        sessionStorage: {
          getItem: () => { throw new Error('SecurityError: Access denied'); },
          setItem: () => { throw new Error('SecurityError: Access denied'); },
          removeItem: () => { throw new Error('SecurityError: Access denied'); }
        }
      };

      const restricted = persistence.installStorageGuard(mockWin);
      expect(restricted).toBe(true);

      // Verify localStorage is now functional
      mockWin.localStorage.setItem('guardKey', 'guardValue');
      expect(mockWin.localStorage.getItem('guardKey')).toBe('guardValue');

      // Verify sessionStorage is now functional
      mockWin.sessionStorage.setItem('sessKey', 'sessVal');
      expect(mockWin.sessionStorage.getItem('sessKey')).toBe('sessVal');
    });
  });

  describe('Barrel Bridges (src/*.js)', () => {
    test('all 6 barrel bridge modules re-export identically to their target modules', () => {
      const app1 = require('../src/approvals.js');
      const app2 = require('../src/security/approvals.js');
      expect(app1).toBe(app2);

      const per1 = require('../src/persistence.js');
      const per2 = require('../src/core/persistence.js');
      expect(per1).toBe(per2);

      const reg1 = require('../src/registry.js');
      const reg2 = require('../src/providers/registry.js');
      expect(reg1).toBe(reg2);

      const san1 = require('../src/sanitization.js');
      const san2 = require('../src/core/sanitization.js');
      expect(san1).toBe(san2);

      const sec1 = require('../src/secrets.js');
      const sec2 = require('../src/security/secrets.js');
      expect(sec1).toBe(sec2);

      const sta1 = require('../src/state.js');
      const sta2 = require('../src/core/state.js');
      expect(sta1).toBe(sta2);
    });
  });

  describe('v6.2 Canonical Hashing and StrongBox Migration', () => {
    test('approvals and registry _sha256Pure executes pure JS hash loop', () => {
      const approvals = require('../src/security/approvals.js');
      const registry = require('../src/providers/registry.js');
      const data = new Uint8Array([101, 103, 45, 110, 101, 120, 117, 115]); // "eg-nexus"
      const hApp = approvals._sha256Pure(data);
      const hReg = registry._sha256Pure(data);
      expect(hApp instanceof Uint8Array).toBe(true);
      expect(hApp.length).toBe(32);
      expect(hApp).toEqual(hReg);

      // Exercise canonicalizeJson on nested objects, arrays, primitives, null, undefined
      const obj = { z: [1, { b: 2, a: 1 }], a: 'test', c: null, d: undefined };
      const c1 = approvals.canonicalizeJson(obj);
      const c2 = registry.canonicalizeJson(obj);
      expect(c1).toBe(c2);
      expect(c1).toBe('{"a":"test","c":null,"z":[1,{"a":1,"b":2}]}');

      // Test _generateTokenNonce
      expect(typeof approvals._generateTokenNonce()).toBe('string');
      expect(typeof registry._generateTokenNonce()).toBe('string');
    });

    test('secrets migrateKeyToStrongBox handles all branches', async () => {
      const secrets = require('../src/security/secrets.js');
      // When plugin not available
      delete global.window;
      const resNoPlugin = await secrets.migrateKeyToStrongBox();
      expect(resNoPlugin.migrated).toBe(false);

      // When plugin available and succeeds
      global.window = {
        Capacitor: {
          Plugins: {
            NexusKeystore: {
              migrateKeyToStrongBox: async () => ({ migrated: true, securityLevel: 'strongbox' })
            }
          }
        }
      };
      const resOk = await secrets.migrateKeyToStrongBox();
      expect(resOk.migrated).toBe(true);
      expect(resOk.securityLevel).toBe('strongbox');

      // Check vault health reflects strongbox
      const health = secrets.getSecretVaultHealth();
      expect(health.hardwareBacked).toBe(true);
      expect(health.securityLevel).toBe('strongbox');

      // Test vault health with software securityLevel
      global.window.Capacitor.Plugins.NexusKeystore.securityLevel = 'software';
      global.window.Capacitor.Plugins.NexusKeystore.hardwareBacked = false;
      // Clear cached info to exercise nativeKs properties
      await secrets.getKeySecurityInfo();
      const healthSw = secrets.getSecretVaultHealth();
      expect(healthSw.hardwareBacked).toBe(false);
      expect(healthSw.securityLevel).toBe('software');

      // When plugin throws
      global.window.Capacitor.Plugins.NexusKeystore.migrateKeyToStrongBox = async () => {
        throw new Error('StrongBox unavailable');
      };
      const resErr = await secrets.migrateKeyToStrongBox();
      expect(resErr.migrated).toBe(false);
      expect(resErr.error).toContain('StrongBox unavailable');
    });

    test('exhaustive branch coverage for canonicalizeJson and _hashParams', async () => {
      const approvals = require('../src/security/approvals.js');
      const registry = require('../src/providers/registry.js');

      // Empty / falsy params
      expect(approvals._hashParams(null)).toBe('');
      expect(approvals._hashParams('')).toBe('');
      expect(approvals._hashParams(undefined)).toBe('');
      expect(registry._hashParams(null)).toBe('');
      expect(registry._hashParams('')).toBe('');
      expect(registry._hashParams(undefined)).toBe('');

      // String params
      const hStrApp = approvals._hashParams('direct_string_params');
      const hStrReg = registry._hashParams('direct_string_params');
      expect(hStrApp).toBe(hStrReg);
      expect(hStrApp.length).toBe(64);

      // Primitives and function/symbol filtering in canonicalizeJson
      expect(approvals.canonicalizeJson(null)).toBe('null');
      expect(approvals.canonicalizeJson(42)).toBe('42');
      expect(approvals.canonicalizeJson(true)).toBe('true');
      expect(approvals.canonicalizeJson('hello')).toBe('"hello"');
      expect(approvals.canonicalizeJson([null, undefined, 42])).toBe('[null,null,42]');
      expect(approvals.canonicalizeJson({
        fn: () => {},
        sym: Symbol('x'),
        valid: 'ok'
      })).toBe('{"valid":"ok"}');

      // executeProviderRequest with authType === 'none' without scopes or token
      const resNoAuth = await registry.executeProviderRequest({
        providerId: 'web_search',
        action: 'search',
        executeFn: async () => ({ searched: true })
      });
      expect(resNoAuth.status).toBe(200);

      // executeProviderRequest sensitive action without approvalToken returns 403 APPROVAL_REQUIRED
      let gateCalled = false;
      const resSensitiveNoTok = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'tok_123',
        grantedScopes: ['repo'],
        approvalGateHandler: () => { gateCalled = true; }
      });
      expect(resSensitiveNoTok.status).toBe(403);
      expect(resSensitiveNoTok.error).toBe('APPROVAL_REQUIRED');
      expect(gateCalled).toBe(true);

      // executeProviderRequest with requireApproval: false on non-sensitive action succeeds
      const resNonSens = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'read',
        token: 'tok_123',
        grantedScopes: ['repo'],
        requireApproval: false,
        executeFn: async () => ({ read: true })
      });
      expect(resNonSens.status).toBe(200);

      // Thorough branch coverage for token validation & expiry
      const t1 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { a: 1 } });
      expect(approvals.consumeApprovalToken(null)).toBe(false);
      expect(approvals.consumeApprovalToken(123)).toBe(false);
      expect(approvals.consumeApprovalToken('non_existent_token')).toBe(false);
      expect(approvals.consumeApprovalToken(t1, { providerId: 'wrong_provider' })).toBe(false);

      const t2 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { a: 1 } });
      expect(approvals.consumeApprovalToken(t2, { action: 'wrong_action' })).toBe(false);

      const t3 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { a: 1 } });
      expect(approvals.consumeApprovalToken(t3, { paramsHash: 'wrong_hash' })).toBe(false);

      const t4 = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: { a: 1 } });
      expect(approvals.consumeApprovalToken(t4, { params: { a: 999 } })).toBe(false);

      // Verify token branches
      expect(approvals.verifyApprovalToken(null)).toBe(false);
      expect(approvals.verifyApprovalToken(123)).toBe(false);
      expect(approvals.verifyApprovalToken('non_existent')).toBe(false);

      // Registry token branches
      expect(registry.consumeApprovalToken(null)).toBe(false);
      expect(registry.consumeApprovalToken(123)).toBe(false);
      expect(registry.consumeApprovalToken('non_existent_token')).toBe(false);
      expect(registry.verifyApprovalToken(null)).toBe(false);
      expect(registry.verifyApprovalToken(123)).toBe(false);
      expect(registry.verifyApprovalToken('non_existent')).toBe(false);

      // Expired token branch
      const tExp = approvals.issueApprovalToken({ providerId: 'github', action: 'push' });
      const rawExp = global.__nexusApprovalTokens.get(tExp);
      if (rawExp) rawExp.expiresAt = Date.now() - 1000;
      expect(approvals.verifyApprovalToken(tExp)).toBe(false);

      const tExp2 = registry.issueApprovalToken({ providerId: 'github', action: 'push' });
      const rawExp2 = global.__nexusApprovalTokens.get(tExp2);
      if (rawExp2) rawExp2.expiresAt = Date.now() - 1000;
      expect(registry.consumeApprovalToken(tExp2)).toBe(false);
    });
  });
});
