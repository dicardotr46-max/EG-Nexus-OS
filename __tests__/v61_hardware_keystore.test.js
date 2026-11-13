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
});
