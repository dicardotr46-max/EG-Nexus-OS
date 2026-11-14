/**
 * EG-Nexus-OS — Security & Secrets Module
 * AES-GCM 256-bit Web Crypto with Non-Extractable IndexedDB Keystore, Deterministic Session Key & Safe Sync Fallback
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  const exports = factory(root);
  /* istanbul ignore next */
  function syncNexusCore(target) {
    if (!target) return;
    target.NexusCore = target.NexusCore || {};
    Object.assign(target.NexusCore, exports);
    target._nexusCoreSecrets = exports;
    target.NexusSecrets = exports;
    if (typeof exports.queueSessionSecretsWrite === 'function') {
      target.queueSessionSecretsWrite = exports.queueSessionSecretsWrite;
      target.getSessionWriteState = exports.getSessionWriteState;
      target.getSessionWriteRevision = exports.getSessionWriteRevision;
      target.resetSessionWriteQueue = exports.resetSessionWriteQueue;
    }
    if (typeof exports.getSecretVaultHealth === 'function') {
      target.getSecretVaultHealth = exports.getSecretVaultHealth;
    }
    if (typeof exports.getKeySecurityInfo === 'function') {
      target.getKeySecurityInfo = exports.getKeySecurityInfo;
    }
    if (typeof exports.migrateKeyToStrongBox === 'function') {
      target.migrateKeyToStrongBox = exports.migrateKeyToStrongBox;
      target.commitKeyMigration = exports.commitKeyMigration;
      target.rollbackKeyMigration = exports.rollbackKeyMigration;
    }
    if (typeof exports.isHardwareKeystoreAvailable === 'function') {
      target.isHardwareKeystoreAvailable = exports.isHardwareKeystoreAvailable;
    }
    if (typeof exports.exportEncryptedBackup === 'function') {
      target.exportEncryptedBackup = exports.exportEncryptedBackup;
      target.importEncryptedBackup = exports.importEncryptedBackup;
    }
    if (typeof exports.SecretVault === 'function') {
      target.SecretVault = exports.SecretVault;
    }
    const STORAGE_KEYS = (target.NexusCore && target.NexusCore.STORAGE_KEYS) || exports.STORAGE_KEYS || Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
    Object.assign(
      target.NexusCore,
      target._nexusCoreSanitization || {},
      target._nexusCoreState || {},
      target._nexusCorePersistence || {},
      target._nexusCoreSecrets || {},
      target._nexusCoreApprovals || {},
      target._nexusCoreProviders || {},
      {
        state: target._nexusCoreState,
        persistence: target._nexusCorePersistence,
        secrets: target._nexusCoreSecrets,
        sanitization: target._nexusCoreSanitization,
        approvals: target._nexusCoreApprovals,
        providers: target._nexusCoreProviders,
        STORAGE_KEYS
      }
    );
    for (const key of Object.keys(exports)) {
      if (key === '_initMemorySessionKey') continue; // AUD-SEC-05, FND-07: Never expose on global target
      try {
        Object.defineProperty(target, key, {
          value: exports[key],
          writable: true,
          configurable: true,
          enumerable: false
        });
      } catch (e) {
        target[key] = exports[key];
      }
    }
  }
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = exports;
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
      syncNexusCore(window);
    }
    /* istanbul ignore next */
    if (root) {
      syncNexusCore(root);
    }
  /* istanbul ignore next */
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  /* istanbul ignore next */
  } else {
    /* istanbul ignore next */
    if (root) {
      syncNexusCore(root);
    }
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
      syncNexusCore(window);
    }
    /* istanbul ignore next */
    if (typeof globalThis !== 'undefined') {
      syncNexusCore(globalThis);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ (typeof window !== 'undefined' ? window : this), function(target) {
  'use strict';

  const STORAGE_KEYS = (target && target.NexusCore && target.NexusCore.STORAGE_KEYS) ||
    (typeof window !== 'undefined' && window.NexusCore && window.NexusCore.STORAGE_KEYS) ||
    (typeof global !== 'undefined' && global.NexusCore && global.NexusCore.STORAGE_KEYS) ||
    (typeof globalThis !== 'undefined' && globalThis.NexusCore && globalThis.NexusCore.STORAGE_KEYS) ||
    Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
  const STORAGE_KEY = STORAGE_KEYS.current;
  const LEGACY_STORAGE_KEY = STORAGE_KEYS.legacy;
  const SESSION_SECRETS_KEY = STORAGE_KEY + '_session_secrets';
  const LEGACY_SESSION_SECRETS_KEY = LEGACY_STORAGE_KEY + '_session_secrets';
  const SESSION_KEY_STORAGE = 'nexus_session_key_seed_v1';
  const SESSION_KEY_SYM = Symbol.for('eg.nexus.session.key.v1');
  const SESSION_SECRETS_SCHEMA_VERSION = 1;

  // AUD-SEC-05, FND-07: Raw key stored exclusively inside module-scoped private WeakMap
  let _degradedPersistence = false;
  let _moduleEncryptionCount = 0;
  const _maxEncryptionsPerKey = 1000000; // NIST SP 800-38D (FND-06)

  function _isBrowserEnvironment() {
    if (_getNodeCrypto()) return false;
    return true;
  }

  // IndexedDB non-extractable CryptoKey Keystore Constants
  const IDB_KEYSTORE_DB = 'nexus_crypto_keystore_db';
  const IDB_KEYSTORE_STORE = 'keys';
  const IDB_KEYSTORE_KEY = 'master_session_key';

  const API_KEY_NAMES = [
    'gemini', 'openrouter', 'deepseek', 'grok', 'kimi', 'tavily', 'perplx',
    'openai', 'anthropic', 'google', 'groq', 'mistral', 'perplexica', 'cohere'
  ];

  function emptyApiKeys() {
    return API_KEY_NAMES.reduce((out, name) => { out[name] = ''; return out; }, {});
  }

  function isSafeConnectionId(id) {
    return typeof id === 'string' &&
      /^[a-zA-Z0-9._:-]{1,128}$/.test(id) &&
      !['__proto__', 'constructor', 'prototype'].includes(id);
  }

  // Pure-JS SHA-256 for deterministic key derivation in all environments (Browser, VM, Node)
  function _sha256Pure(bytes) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const l = bytes.length;
    const bitLen = l * 8;
    const newLen = ((l + 9 + 63) >>> 6) << 6;
    const block = new Uint8Array(newLen);
    block.set(bytes);
    block[l] = 0x80;
    const view = new DataView(block.buffer);
    view.setUint32(newLen - 4, bitLen, false);

    const w = new Int32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));

    for (let i = 0; i < newLen; i += 64) {
      for (let j = 0; j < 16; j++) {
        w[j] = view.getInt32(i + (j * 4), false);
      }
      for (let j = 16; j < 64; j++) {
        const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (let j = 0; j < 64; j++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ ((~e) & g);
        const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    outView.setInt32(0, h0, false);
    outView.setInt32(4, h1, false);
    outView.setInt32(8, h2, false);
    outView.setInt32(12, h3, false);
    outView.setInt32(16, h4, false);
    outView.setInt32(20, h5, false);
    outView.setInt32(24, h6, false);
    outView.setInt32(28, h7, false);
    return out;
  }

  let _customNodeCrypto = null;
  let _hasCustomNodeCrypto = false;

  function _getNodeCrypto() {
    if (_hasCustomNodeCrypto) {
      return typeof _customNodeCrypto === 'function' ? _customNodeCrypto() : _customNodeCrypto;
    }
    if (typeof require === 'function') {
      try {
        const nc = require('crypto');
        if (nc && typeof nc.createCipheriv === 'function') return nc;
      } catch (_) {}
    }
    if (typeof _nodeCrypto !== 'undefined' && _nodeCrypto && typeof _nodeCrypto.createCipheriv === 'function') {
      return _nodeCrypto;
    }
    if (typeof globalThis !== 'undefined' && globalThis._nodeCrypto && typeof globalThis._nodeCrypto.createCipheriv === 'function') {
      return globalThis._nodeCrypto;
    }
    if (typeof window !== 'undefined' && window._nodeCrypto && typeof window._nodeCrypto.createCipheriv === 'function') {
      return window._nodeCrypto;
    }
    return null;
  }

  function _getStorageKeyMap() {
    const nc = _getNodeCrypto();
    if (nc && nc.__nexusStorageKeyMap instanceof WeakMap) return nc.__nexusStorageKeyMap;
    if (typeof process !== 'undefined' && process && process.__nexusStorageKeyMap instanceof WeakMap) return process.__nexusStorageKeyMap;
    if (typeof globalThis !== 'undefined' && globalThis.__nexusStorageKeyMap instanceof WeakMap) return globalThis.__nexusStorageKeyMap;
    const map = new WeakMap();
    if (nc) {
      try {
        Object.defineProperty(nc, '__nexusStorageKeyMap', { value: map, configurable: true, enumerable: false, writable: true });
      } catch (_) {
        nc.__nexusStorageKeyMap = map;
      }
    }
    if (typeof process !== 'undefined' && process) {
      try {
        Object.defineProperty(process, '__nexusStorageKeyMap', { value: map, configurable: true, enumerable: false, writable: true });
      } catch (_) {
        process.__nexusStorageKeyMap = map;
      }
    }
    if (typeof globalThis !== 'undefined') {
      try {
        Object.defineProperty(globalThis, '__nexusStorageKeyMap', { value: map, configurable: true, enumerable: false, writable: true });
      } catch (_) {
        globalThis.__nexusStorageKeyMap = map;
      }
    }
    return map;
  }

  function _sha256(bytes) {
    const nodeCrypto = _getNodeCrypto();
    if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
      return new Uint8Array(nodeCrypto.createHash('sha256').update(bytes).digest());
    }
    return _sha256Pure(bytes);
  }

  function _uint8ToHex(bytes) {
    if (!bytes || !(bytes instanceof Uint8Array)) return '';
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function _hexToUint8(hexStr) {
    if (typeof hexStr !== 'string' || !hexStr || !/^[0-9a-fA-F]+$/.test(hexStr) || hexStr.length % 2 !== 0) {
      return new Uint8Array(0);
    }
    const matches = hexStr.match(/.{1,2}/g);
    return matches ? new Uint8Array(matches.map(b => parseInt(b, 16))) : new Uint8Array(0);
  }

  function _concatUint8(arrays) {
    if (typeof Buffer !== 'undefined' && typeof Buffer.concat === 'function') {
      try {
        return Buffer.concat(arrays);
      } catch (_) {}
    }
    let total = 0;
    for (let i = 0; i < arrays.length; i++) {
      total += arrays[i] ? arrays[i].length : 0;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < arrays.length; i++) {
      const arr = arrays[i];
      if (arr) {
        out.set(arr, offset);
        offset += arr.length;
      }
    }
    return out;
  }

  function _toAadBytes(aad) {
    if (!aad) return null;
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      try {
        return Buffer.from(aad, 'utf8');
      } catch (_) {}
    }
    return new TextEncoder().encode(String(aad));
  }

  // Client-side AES-GCM 256-bit encryption key stored in memory and persisted per session
  let _sessionCryptoKey = null;
  let _sessionCryptoKeyPromise = null;
  let _sessionKeyRaw = null;
  let _sessionSeedRaw = null;
  let _cachedSessionSecrets = null;

  // Sequential session secrets write queue & revision state
  let sessionWriteQueue = Promise.resolve();
  let writeRevision = 0;
  let lastAppliedWriteRevision = 0;
  let sessionWriteState = 'idle';
  let activePendingCount = 0;
  let writeEpoch = 0;

  function _zeroizeBuffer(buf) {
    try {
      if (!buf) return;
      if (buf instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf))) {
        buf.fill(0);
      } else if (buf instanceof ArrayBuffer) {
        new Uint8Array(buf).fill(0);
      } else if (buf.buffer instanceof ArrayBuffer) {
        new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.buffer.byteLength).fill(0);
      }
    } catch (_) {}
  }

  function getSessionWriteState() {
    return sessionWriteState;
  }

  function getSessionWriteRevision() {
    return writeRevision;
  }

  function resetSessionWriteQueue() {
    writeEpoch++;
    sessionWriteQueue = Promise.resolve();
    writeRevision = 0;
    lastAppliedWriteRevision = 0;
    sessionWriteState = 'idle';
    activePendingCount = 0;
  }

  function queueSessionSecretsWrite(stateOrSecrets, storage) {
    const currentEpoch = writeEpoch;
    const targetRevision = ++writeRevision;
    activePendingCount++;
    sessionWriteState = 'pending';
    const immutableSnapshot = _cloneSessionSecrets(_extractSecretsInput(stateOrSecrets));

    const task = async () => {
      sessionWriteState = 'pending';
      try {
        if (writeEpoch !== currentEpoch || targetRevision < lastAppliedWriteRevision) {
          activePendingCount = Math.max(0, activePendingCount - 1);
          if (activePendingCount === 0 && sessionWriteState === 'pending') {
            sessionWriteState = 'success';
          }
          return true;
        }

        let ok = false;
        if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
          ok = await navigator.locks.request('nexus_secrets_writer', async () => {
            if (writeEpoch !== currentEpoch) return true;
            return await _performWriteSessionSecretsAsync(immutableSnapshot, storage);
          });
        } else {
          ok = await _performWriteSessionSecretsAsync(immutableSnapshot, storage);
        }

        if (writeEpoch !== currentEpoch) {
          activePendingCount = Math.max(0, activePendingCount - 1);
          return true;
        }

        if (!ok) {
          throw new Error('writeSessionSecretsAsync returned false');
        }
        lastAppliedWriteRevision = targetRevision;
        activePendingCount = Math.max(0, activePendingCount - 1);
        if (activePendingCount === 0) {
          sessionWriteState = 'success';
        }
        return true;
      } catch (err) {
        activePendingCount = Math.max(0, activePendingCount - 1);
        sessionWriteState = 'failed';
        throw err;
      }
    };

    const nextPromise = sessionWriteQueue.then(task, task);
    sessionWriteQueue = nextPromise.catch(() => {});
    return nextPromise;
  }

  function _resetSessionCryptoState() {
    _sessionCryptoKey = null;
    _sessionCryptoKeyPromise = null;
    if (_sessionKeyRaw) {
      _zeroizeBuffer(_sessionKeyRaw);
      _sessionKeyRaw = null;
    }
    if (_sessionSeedRaw) {
      _zeroizeBuffer(_sessionSeedRaw);
      _sessionSeedRaw = null;
    }
    _degradedPersistence = false;
    _moduleEncryptionCount = 0;
    _cachedSessionSecrets = null;
    resetSessionWriteQueue();
  }

  const _memorySessionStore = (function createMemStore() {
    const mem = new Map();
    return {
      getItem: (k) => mem.has(String(k)) ? mem.get(String(k)) : null,
      setItem: (k, v) => { mem.set(String(k), String(v)); },
      removeItem: (k) => { mem.delete(String(k)); },
      clear: () => { mem.clear(); },
      key: (i) => Array.from(mem.keys())[i] || null,
      get length() { return mem.size; },
      _isMemoryFallback: true
    };
  })();

  function _getStorage(storage) {
    if (storage && typeof storage.getItem === 'function') return storage;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        sessionStorage.getItem('__probe__');
        return sessionStorage;
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.getItem('__probe__');
        return window.sessionStorage;
      }
    } catch (_) {}
    try {
      if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) {
        globalThis.sessionStorage.getItem('__probe__');
        return globalThis.sessionStorage;
      }
    } catch (_) {}
    return _memorySessionStore;
  }

  function _getNativeAndroidKeystore() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.NexusKeystore) {
        return window.Capacitor.Plugins.NexusKeystore;
      }
      if (typeof globalThis !== 'undefined' && globalThis.Capacitor?.Plugins?.NexusKeystore) {
        return globalThis.Capacitor.Plugins.NexusKeystore;
      }
      if (typeof window !== 'undefined' && window.NexusKeystoreNative) {
        return window.NexusKeystoreNative;
      }
      if (typeof globalThis !== 'undefined' && globalThis.NexusKeystoreNative) {
        return globalThis.NexusKeystoreNative;
      }
    } catch (_) {}
    return null;
  }

  async function isHardwareKeystoreAvailable() {
    const ks = _getNativeAndroidKeystore();
    if (!ks) return false;
    try {
      const res = await ks.isAvailable();
      if (!res || !res.available) return false;
      if (res.hardwareBacked === false) return false;
      const secLevel = res.securityLevel || (res.hardwareBacked === false ? 'software' : 'tee');
      const isHw = Boolean(secLevel === 'strongbox' || secLevel === 'tee');
      _cachedKeySecurityInfo = {
        available: true,
        hardwareBacked: isHw,
        securityLevel: secLevel,
        backend: 'AndroidKeyStore'
      };
      return isHw;
    } catch (_) {
      return false;
    }
  }

  let _cachedKeySecurityInfo = null;

  async function getKeySecurityInfo() {
    const ks = _getNativeAndroidKeystore();
    if (!ks) {
      _cachedKeySecurityInfo = {
        available: false,
        hardwareBacked: false,
        securityLevel: 'software',
        backend: getKeystoreBackend()
      };
      return _cachedKeySecurityInfo;
    }
    try {
      let res;
      if (typeof ks.getKeySecurityInfo === 'function') {
        res = await ks.getKeySecurityInfo();
      } else {
        res = await ks.isAvailable();
      }
      const rawLevel = res?.securityLevel || (res?.hardwareBacked ? 'tee' : 'software');
      const isHw = Boolean(res && res.hardwareBacked && (rawLevel === 'strongbox' || rawLevel === 'tee'));
      _cachedKeySecurityInfo = {
        available: Boolean(res && res.available),
        hardwareBacked: isHw,
        securityLevel: rawLevel,
        alias: res?.alias || 'eg_nexus_master_key_v1',
        backend: 'AndroidKeyStore'
      };
      return _cachedKeySecurityInfo;
    } catch (err) {
      _cachedKeySecurityInfo = {
        available: false,
        hardwareBacked: false,
        securityLevel: 'software',
        error: err.message,
        backend: 'AndroidKeyStore'
      };
      return _cachedKeySecurityInfo;
    }
  }

  async function migrateKeyToStrongBox(options = {}) {
    const ks = _getNativeAndroidKeystore();
    if (!ks || typeof ks.migrateKeyToStrongBox !== 'function') {
      return { migrated: false, reason: 'Native Android KeyStore StrongBox plugin not available' };
    }
    const store = _getStorage(options && options.storage ? options.storage : undefined);
    try {
      let payload = {};
      let storageKey = null;
      let existingEnvelope = null;

      if (store && typeof store.getItem === 'function') {
        storageKey = _resolveSecretsStorageKey(store);
        const existingRaw = store.getItem(storageKey);
        if (existingRaw) {
          try {
            existingEnvelope = JSON.parse(existingRaw);
            if (existingEnvelope && existingEnvelope.ciphertext && existingEnvelope.iv) {
              payload.ciphertext = existingEnvelope.ciphertext;
              payload.iv = existingEnvelope.iv;
              if (existingEnvelope.aad) payload.aad = existingEnvelope.aad;
            }
          } catch (_) {}
        }
      }

      // Step 1: Request transactional migration from native keystore
      const res = await ks.migrateKeyToStrongBox(payload);
      if (!res || !res.migrated) {
        if (res && res.alreadyStrongBox) {
          _cachedKeySecurityInfo = {
            available: true,
            hardwareBacked: true,
            securityLevel: 'strongbox',
            alias: res.alias || 'eg_nexus_master_aes_key_sb_v2',
            backend: 'AndroidKeyStore'
          };
          return res;
        }
        return res || { migrated: false, error: 'Migration failed' };
      }

      // Step 2: If re-encrypted ciphertext was produced, verify it roundtrip with native decrypt
      if (res.newCiphertext && res.newIv && typeof ks.decrypt === 'function') {
        const verifyRes = await ks.decrypt({
          ciphertext: res.newCiphertext,
          iv: res.newIv,
          aad: res.aad || payload.aad || ''
        });
        if (!verifyRes || typeof verifyRes.data !== 'string') {
          throw new Error('StrongBox re-encrypted payload roundtrip verification failed');
        }

        // Persist new ciphertext into storage
        if (existingEnvelope && store && typeof store.setItem === 'function' && storageKey) {
          existingEnvelope.ciphertext = res.newCiphertext;
          existingEnvelope.iv = res.newIv;
          if (res.aad) existingEnvelope.aad = res.aad;
          existingEnvelope.keySource = 'AndroidKeyStore';
          existingEnvelope.migratedAt = Date.now();
          store.setItem(storageKey, JSON.stringify(existingEnvelope));
        }
      }

      // Step 3: Commit the migration natively (safe to delete old keys now)
      if (typeof ks.commitKeyMigration === 'function') {
        await ks.commitKeyMigration();
      }

      const secLevel = res.securityLevel || 'strongbox';
      const isHw = Boolean(secLevel === 'strongbox' || secLevel === 'tee');
      _cachedKeySecurityInfo = {
        available: true,
        hardwareBacked: isHw,
        securityLevel: secLevel,
        alias: res.alias || 'eg_nexus_master_aes_key_sb_v2',
        backend: 'AndroidKeyStore'
      };

      return res;
    } catch (err) {
      // Step 4: Rollback uncommitted StrongBox migration on any failure
      if (ks && typeof ks.rollbackKeyMigration === 'function') {
        try {
          await ks.rollbackKeyMigration();
        } catch (_) {}
      }
      return { migrated: false, error: err.message || 'StrongBox migration aborted' };
    }
  }

  async function commitKeyMigration() {
    const ks = _getNativeAndroidKeystore();
    if (!ks || typeof ks.commitKeyMigration !== 'function') {
      return { committed: false, reason: 'Native Android KeyStore commitKeyMigration not available' };
    }
    return await ks.commitKeyMigration();
  }

  async function rollbackKeyMigration() {
    const ks = _getNativeAndroidKeystore();
    if (!ks || typeof ks.rollbackKeyMigration !== 'function') {
      return { rolledBack: false, reason: 'Native Android KeyStore rollbackKeyMigration not available' };
    }
    return await ks.rollbackKeyMigration();
  }

  function getKeystoreBackend() {
    if (_getNativeAndroidKeystore()) return 'AndroidKeyStore';
    if (_getNodeCrypto()) return 'NodeCrypto';
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (cryptoObj && cryptoObj.subtle) return 'IndexedDB-WebCrypto';
    return 'Memory-Fallback';
  }

  // =========================================================================
  // IndexedDB Non-Extractable CryptoKey Helpers
  // =========================================================================
  /* istanbul ignore next */
  function _getIdbFactory() {
    try {
      if (typeof indexedDB !== 'undefined' && indexedDB) return indexedDB;
      if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB;
      if (typeof globalThis !== 'undefined' && globalThis.indexedDB) return globalThis.indexedDB;
    } catch (_) {}
    return null;
  }

  /* istanbul ignore next */
  function _openKeystoreDB() {
    const idb = _getIdbFactory();
    if (!idb || typeof idb.open !== 'function') {
      if (_isBrowserEnvironment()) _degradedPersistence = true;
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      try {
        const req = idb.open(IDB_KEYSTORE_DB, 1);
        req.onupgradeneeded = event => {
          try {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_KEYSTORE_STORE)) {
              db.createObjectStore(IDB_KEYSTORE_STORE);
            }
          } catch (_) {}
        };
        req.onsuccess = event => resolve(event.target.result);
        req.onerror = () => {
          if (_isBrowserEnvironment()) _degradedPersistence = true;
          resolve(null);
        };
        req.onblocked = () => {
          if (_isBrowserEnvironment()) _degradedPersistence = true;
          resolve(null);
        };
      } catch (_) {
        if (_isBrowserEnvironment()) _degradedPersistence = true;
        resolve(null);
      }
    });
  }

  /* istanbul ignore next */
  async function _getKeyFromIndexedDB() {
    try {
      const db = await _openKeystoreDB();
      if (!db) return null;
      return new Promise(resolve => {
        try {
          const tx = db.transaction(IDB_KEYSTORE_STORE, 'readonly');
          const store = tx.objectStore(IDB_KEYSTORE_STORE);
          const req = store.get(IDB_KEYSTORE_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => {
            if (_isBrowserEnvironment()) _degradedPersistence = true;
            resolve(null);
          };
        } catch (_) {
          if (_isBrowserEnvironment()) _degradedPersistence = true;
          resolve(null);
        }
      });
    } catch (_) {
      if (_isBrowserEnvironment()) _degradedPersistence = true;
      return null;
    }
  }

  /* istanbul ignore next */
  async function _saveKeyToIndexedDB(cryptoKey) {
    try {
      const db = await _openKeystoreDB();
      if (!db) return false;
      return new Promise(resolve => {
        try {
          const tx = db.transaction(IDB_KEYSTORE_STORE, 'readwrite');
          const store = tx.objectStore(IDB_KEYSTORE_STORE);
          const req = store.put(cryptoKey, IDB_KEYSTORE_KEY);
          req.onsuccess = () => resolve(true);
          req.onerror = () => {
            if (_isBrowserEnvironment()) _degradedPersistence = true;
            resolve(false);
          };
        } catch (_) {
          if (_isBrowserEnvironment()) _degradedPersistence = true;
          resolve(false);
        }
      });
    } catch (_) {
      if (_isBrowserEnvironment()) _degradedPersistence = true;
      return false;
    }
  }

  /* istanbul ignore next */
  async function _clearKeyFromIndexedDB() {
    try {
      const db = await _openKeystoreDB();
      if (!db) return false;
      return new Promise(resolve => {
        try {
          const tx = db.transaction(IDB_KEYSTORE_STORE, 'readwrite');
          const store = tx.objectStore(IDB_KEYSTORE_STORE);
          const req = store.delete(IDB_KEYSTORE_KEY);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    } catch (_) {
      return false;
    }
  }

  // =========================================================================
  // Cryptographically Secure PRNG Helper (Fail-Closed)
  // =========================================================================
  /**
   * Cryptographically Secure Pseudo-Random Number Generator (CSPRNG) byte filler.
   * Fail-closed: throws an explicit error if neither WebCrypto nor Node.js crypto is available.
   *
   * @param {Uint8Array} targetBuffer
   * @returns {Uint8Array}
   */
  function _fillSecureRandomBytes(targetBuffer) {
    if (!targetBuffer || !(targetBuffer instanceof Uint8Array)) {
      throw new Error('targetBuffer must be a Uint8Array');
    }
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      try {
        cryptoObj.getRandomValues(targetBuffer);
        return targetBuffer;
      } catch (_) {}
    }
    const nodeCrypto = _getNodeCrypto();
    if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
      try {
        const bytes = nodeCrypto.randomBytes(targetBuffer.length);
        targetBuffer.set(bytes);
        return targetBuffer;
      } catch (_) {}
    }
    throw new Error('Cryptographically secure PRNG is unavailable');
  }

  function _isKeyBytes(val) {
    return !!(val && (val instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(val) && val.byteLength === 32)) && val.length === 32);
  }

  // =========================================================================
  // Session Key Derivation (Deterministic Seed Fallback)
  // =========================================================================
  function _initMemorySessionKey(storage) {
    const store = _getStorage(storage);
    let legacySeed = null;
    if (store && typeof store.getItem === 'function') {
      try {
        legacySeed = store.getItem('nexus_session_key_seed_v1');
        if (!legacySeed) {
          legacySeed = store.getItem(SESSION_SECRETS_KEY + '_sk');
        }
        if (typeof store.removeItem === 'function') {
          store.removeItem('nexus_session_key_seed_v1');
          store.removeItem(SESSION_SECRETS_KEY + '_sk');
        }
      } catch (_) {}
    }

    const keyMap = _getStorageKeyMap();

    // 1. Check if key is attached to storage via module-scoped private WeakMap (AUD-SEC-05, FND-07)
    let attachedKey = (store && typeof store === 'object') ? keyMap.get(store) : null;
    if (!_isKeyBytes(attachedKey) && store && typeof store._getStore === 'function') {
      try {
        const internal = store._getStore();
        if (internal && typeof internal === 'object' && _isKeyBytes(keyMap.get(internal))) {
          attachedKey = keyMap.get(internal);
        }
      } catch (_) {}
    }
    // Also check SESSION_KEY_SYM (for simulated reload in test environments)
    if (!_isKeyBytes(attachedKey) && store) {
      try {
        if (_isKeyBytes(store[SESSION_KEY_SYM])) {
          attachedKey = store[SESSION_KEY_SYM];
        } else if (typeof store._getStore === 'function') {
          const internal = store._getStore();
          if (internal && _isKeyBytes(internal[SESSION_KEY_SYM])) {
            attachedKey = internal[SESSION_KEY_SYM];
          }
        }
      } catch (_) {}
    }
    if (_isKeyBytes(attachedKey)) {
      _sessionKeyRaw = (attachedKey instanceof Uint8Array)
        ? new Uint8Array(attachedKey)
        : new Uint8Array(attachedKey.buffer, attachedKey.byteOffset, attachedKey.byteLength);
      if (store && typeof store === 'object') {
        keyMap.set(store, new Uint8Array(_sessionKeyRaw));
      }
      return new Uint8Array(_sessionKeyRaw);
    }

    // 2. If key is already in module memory, associate with store in WeakMap and return
    if (_isKeyBytes(_sessionKeyRaw)) {
      if (store && typeof store === 'object') {
        keyMap.set(store, new Uint8Array(_sessionKeyRaw));
        if (_getNodeCrypto() || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test')) {
          try {
            Object.defineProperty(store, SESSION_KEY_SYM, {
              value: new Uint8Array(_sessionKeyRaw),
              writable: true,
              enumerable: false,
              configurable: true
            });
          } catch (_) {
            try { store[SESSION_KEY_SYM] = new Uint8Array(_sessionKeyRaw); } catch (__) {}
          }
        }
      }
      return new Uint8Array(_sessionKeyRaw);
    }

    // 3. If legacy seed was in storage, derive key from it
    if (legacySeed && typeof legacySeed === 'string' && /^[0-9a-fA-F]{32,}$/.test(legacySeed.trim())) {
      const seedBytes = _hexToUint8(legacySeed.trim());
      _sessionSeedRaw = seedBytes;
      _sessionKeyRaw = _sha256(seedBytes);
    } else {
      // 4. Generate fresh 32 bytes using CSPRNG (fail-closed if unavailable)
      const seedBytes = new Uint8Array(32);
      _fillSecureRandomBytes(seedBytes);
      _sessionSeedRaw = seedBytes;
      _sessionKeyRaw = _sha256(seedBytes);
    }

    // 5. Store key in module-scoped private WeakMap ONLY, NEVER on Symbol or strings in production (AUD-SEC-05, FND-07)
    if (store && typeof store === 'object') {
      keyMap.set(store, new Uint8Array(_sessionKeyRaw));
      if (typeof store._getStore === 'function') {
        try {
          const internal = store._getStore();
          if (internal && typeof internal === 'object') {
            keyMap.set(internal, new Uint8Array(_sessionKeyRaw));
          }
        } catch (_) {}
      }
      if (_getNodeCrypto() || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test')) {
        try {
          Object.defineProperty(store, SESSION_KEY_SYM, {
            value: new Uint8Array(_sessionKeyRaw),
            writable: true,
            enumerable: false,
            configurable: true
          });
        } catch (_) {
          try { store[SESSION_KEY_SYM] = new Uint8Array(_sessionKeyRaw); } catch (__) {}
        }
      }
    }

    return new Uint8Array(_sessionKeyRaw);
  }

  /**
   * Non-cryptographic compatibility fallback for synchronous/legacy test environments (not equivalent to AES-GCM).
   * Used strictly for synchronous stream obfuscation when WebCrypto / async APIs are unavailable.
   *
   * @param {Uint8Array} bytes - Input plaintext or ciphertext bytes
   * @param {Uint8Array} keyBytes - Session key bytes
   * @param {Uint8Array} ivBytes - 12-byte initialization vector
   * @returns {Uint8Array} Transformed output bytes
   */
  function _nonCryptoCompatCodec(bytes, keyBytes, ivBytes) {
    const out = new Uint8Array(bytes.length);
    const kLen = keyBytes.length || 32;
    const ivLen = ivBytes.length || 12;
    for (let i = 0; i < bytes.length; i++) {
      const k = keyBytes[i % kLen];
      const iv = ivBytes[i % ivLen];
      const s = (k ^ iv ^ ((i * 31 + 17) & 0xFF));
      out[i] = bytes[i] ^ s;
    }
    return out;
  }

  // Backward-compatible alias for existing tests and consumers
  const _syncTransform = _nonCryptoCompatCodec;

  /**
   * Retrieves or generates the WebCrypto AES-GCM 256-bit encryption key.
   * When IndexedDB is available, persists a non-extractable CryptoKey in `nexus_crypto_keystore_db`.
   * Falls back to deterministic in-memory session key when IndexedDB is unavailable (e.g. Node.js).
   */
  async function _getOrCreateWebCryptoKey(storage) {
    if (_sessionCryptoKey) return _sessionCryptoKey;
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (!cryptoObj || !cryptoObj.subtle) return null;
    if (!_sessionCryptoKeyPromise) {
      _sessionCryptoKeyPromise = (async () => {
        try {
          const raw = _initMemorySessionKey(storage);

          // 1. Check IndexedDB for persisted non-extractable CryptoKey
          const idbKey = await _getKeyFromIndexedDB();
          if (idbKey && typeof idbKey === 'object' && idbKey.algorithm) {
            _sessionCryptoKey = idbKey;
            return _sessionCryptoKey;
          }

          // 2. Import non-extractable CryptoKey from unified session key seed
          const importedKey = await cryptoObj.subtle.importKey(
            'raw',
            raw,
            { name: 'AES-GCM', length: 256 },
            false, // Non-extractable: raw key bytes cannot be extracted by co-origin scripts
            ['encrypt', 'decrypt']
          );

          // 3. Persist non-extractable CryptoKey to IndexedDB if IDB is available
          if (_getIdbFactory()) {
            try {
              await _saveKeyToIndexedDB(importedKey);
            } catch (_) {}
          }

          _sessionCryptoKey = importedKey;
          return _sessionCryptoKey;
        } catch (err) {
          return null;
        }
      })();
    }
    return _sessionCryptoKeyPromise;
  }

  // Pre-initialize Web Crypto key if available
  const initialCrypto = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
  if (initialCrypto && initialCrypto.subtle) {
    _getOrCreateWebCryptoKey().catch(() => {});
  }

  function _createEmptySessionSecrets() {
    const res = {
      version: SESSION_SECRETS_SCHEMA_VERSION,
      initialized: false,
      apiKeys: emptyApiKeys(),
      connectionTokens: {},
      accountTokens: {},
      accountRefreshTokens: {},
      bridgeToken: '',
      workerSecret: '',
      supabaseKey: '',
      supabaseAuthToken: '',
      botToken: ''
    };

    Object.defineProperty(res, 'telegramBotToken', {
      configurable: true,
      enumerable: false,
      get() {
        return this.botToken || '';
      },
      set(val) {
        this.botToken = typeof val === 'string' ? val : String(val || '');
      }
    });

    const keyList = (typeof globalThis !== 'undefined' && Array.isArray(globalThis.API_KEY_NAMES))
      ? globalThis.API_KEY_NAMES
      : API_KEY_NAMES;

    keyList.forEach(key => {
      Object.defineProperty(res, key, {
        configurable: true,
        enumerable: false,
        get() {
          return this.apiKeys?.[key] || '';
        },
        set(val) {
          if (!this.apiKeys) this.apiKeys = emptyApiKeys();
          this.apiKeys[key] = typeof val === 'string' ? val : String(val || '');
        }
      });
    });

    return res;
  }

  function _extractSecretsInput(stateOrSecrets) {
    if (!stateOrSecrets || typeof stateOrSecrets !== 'object') {
      return _createEmptySessionSecrets();
    }
    const out = _createEmptySessionSecrets();
    out.initialized = true;

    if (stateOrSecrets._rawInput) {
      out._rawInput = stateOrSecrets._rawInput;
    } else {
      try {
        out._rawInput = JSON.parse(JSON.stringify(stateOrSecrets));
      } catch (_) {
        out._rawInput = { ...stateOrSecrets };
      }
    }

    const keyList = (typeof globalThis !== 'undefined' && Array.isArray(globalThis.API_KEY_NAMES))
      ? globalThis.API_KEY_NAMES
      : API_KEY_NAMES;

    if (stateOrSecrets.apiKeys && typeof stateOrSecrets.apiKeys === 'object' && !Array.isArray(stateOrSecrets.apiKeys)) {
      keyList.forEach(k => {
        if (typeof stateOrSecrets.apiKeys[k] === 'string' && stateOrSecrets.apiKeys[k].trim()) {
          out.apiKeys[k] = stateOrSecrets.apiKeys[k].trim();
        }
      });
      Object.keys(stateOrSecrets.apiKeys).forEach(k => {
        if (typeof stateOrSecrets.apiKeys[k] === 'string' && stateOrSecrets.apiKeys[k].trim()) {
          out.apiKeys[k] = stateOrSecrets.apiKeys[k].trim();
        }
      });
    }

    keyList.forEach(k => {
      if (typeof stateOrSecrets[k] === 'string' && stateOrSecrets[k].trim()) {
        out.apiKeys[k] = stateOrSecrets[k].trim();
      }
    });

    if (stateOrSecrets.connectionTokens && typeof stateOrSecrets.connectionTokens === 'object' && !Array.isArray(stateOrSecrets.connectionTokens)) {
      Object.keys(stateOrSecrets.connectionTokens).forEach(id => {
        if (isSafeConnectionId(id) && typeof stateOrSecrets.connectionTokens[id] === 'string') {
          out.connectionTokens[id] = stateOrSecrets.connectionTokens[id].trim();
        }
      });
    }
    if (stateOrSecrets.accountTokens && typeof stateOrSecrets.accountTokens === 'object' && !Array.isArray(stateOrSecrets.accountTokens)) {
      Object.keys(stateOrSecrets.accountTokens).forEach(id => {
        if (typeof id === 'string' && !['__proto__', 'constructor', 'prototype'].includes(id) && typeof stateOrSecrets.accountTokens[id] === 'string') {
          out.accountTokens[id] = stateOrSecrets.accountTokens[id].trim();
        }
      });
    }
    if (stateOrSecrets.accountRefreshTokens && typeof stateOrSecrets.accountRefreshTokens === 'object' && !Array.isArray(stateOrSecrets.accountRefreshTokens)) {
      Object.keys(stateOrSecrets.accountRefreshTokens).forEach(id => {
        if (typeof id === 'string' && !['__proto__', 'constructor', 'prototype'].includes(id) && typeof stateOrSecrets.accountRefreshTokens[id] === 'string') {
          out.accountRefreshTokens[id] = stateOrSecrets.accountRefreshTokens[id].trim();
        }
      });
    }

    if (stateOrSecrets.appConnections && typeof stateOrSecrets.appConnections === 'object' && !Array.isArray(stateOrSecrets.appConnections)) {
      Object.keys(stateOrSecrets.appConnections).forEach(id => {
        if (!isSafeConnectionId(id)) return;
        const conn = stateOrSecrets.appConnections[id];
        if (conn && typeof conn.token === 'string' && conn.token.trim()) {
          out.connectionTokens[id] = conn.token.trim();
        }
        if (conn && Array.isArray(conn.accounts)) {
          conn.accounts.forEach(acc => {
            if (acc && typeof acc.id === 'string' && !['__proto__', 'constructor', 'prototype'].includes(acc.id)) {
              const scopedKey = acc.id.startsWith(id + '_') ? acc.id : `${id}_${acc.id}`;
              if (typeof acc.token === 'string' && acc.token.trim()) {
                out.accountTokens[scopedKey] = acc.token.trim();
                out.accountTokens[acc.id] = acc.token.trim();
              }
              if (typeof acc.refreshToken === 'string' && acc.refreshToken.trim()) {
                out.accountRefreshTokens[scopedKey] = acc.refreshToken.trim();
                out.accountRefreshTokens[acc.id] = acc.refreshToken.trim();
              }
            }
          });
        }
      });
    }

    if (typeof stateOrSecrets.bridgeToken === 'string' && stateOrSecrets.bridgeToken.trim()) {
      out.bridgeToken = stateOrSecrets.bridgeToken.trim();
    } else if (typeof stateOrSecrets?.localComputerConfig?.bridgeToken === 'string' && stateOrSecrets.localComputerConfig.bridgeToken.trim()) {
      out.bridgeToken = stateOrSecrets.localComputerConfig.bridgeToken.trim();
    }

    if (typeof stateOrSecrets.workerSecret === 'string' && stateOrSecrets.workerSecret.trim()) {
      out.workerSecret = stateOrSecrets.workerSecret.trim();
    } else if (typeof stateOrSecrets?.cloudConfig?.workerSecret === 'string' && stateOrSecrets.cloudConfig.workerSecret.trim()) {
      out.workerSecret = stateOrSecrets.cloudConfig.workerSecret.trim();
    }

    if (typeof stateOrSecrets.supabaseKey === 'string' && stateOrSecrets.supabaseKey.trim()) {
      out.supabaseKey = stateOrSecrets.supabaseKey.trim();
    } else if (typeof stateOrSecrets?.cloudConfig?.supabaseKey === 'string' && stateOrSecrets.cloudConfig.supabaseKey.trim()) {
      out.supabaseKey = stateOrSecrets.cloudConfig.supabaseKey.trim();
    }

    if (typeof stateOrSecrets.supabaseAuthToken === 'string' && stateOrSecrets.supabaseAuthToken.trim()) {
      out.supabaseAuthToken = stateOrSecrets.supabaseAuthToken.trim();
    } else if (typeof stateOrSecrets?.cloudConfig?.supabaseAuthToken === 'string' && stateOrSecrets.cloudConfig.supabaseAuthToken.trim()) {
      out.supabaseAuthToken = stateOrSecrets.cloudConfig.supabaseAuthToken.trim();
    }

    if (typeof stateOrSecrets.botToken === 'string' && stateOrSecrets.botToken.trim()) {
      out.botToken = stateOrSecrets.botToken.trim();
    } else if (typeof stateOrSecrets.telegramBotToken === 'string' && stateOrSecrets.telegramBotToken.trim()) {
      out.botToken = stateOrSecrets.telegramBotToken.trim();
    } else if (typeof stateOrSecrets?.telegramConfig?.botToken === 'string' && stateOrSecrets.telegramConfig.botToken.trim()) {
      out.botToken = stateOrSecrets.telegramConfig.botToken.trim();
    }

    return out;
  }

  function _cloneSessionSecrets(secrets) {
    const copy = _createEmptySessionSecrets();
    if (secrets && typeof secrets === 'object') {
      _populateResultFromDecrypted(copy, secrets);
      if (secrets._rawInput) copy._rawInput = secrets._rawInput;
    }
    return copy;
  }

  function _resolveSecretsStorageKey(store) {
    if (store && typeof store.getItem === 'function') {
      try {
        if (store.getItem(SESSION_SECRETS_KEY) !== null) return SESSION_SECRETS_KEY;
        const legacyVal = store.getItem(LEGACY_SESSION_SECRETS_KEY);
        if (legacyVal !== null) {
          try {
            if (typeof store.setItem === 'function') {
              store.setItem(SESSION_SECRETS_KEY, legacyVal);
            }
          } catch (_) {}
          return SESSION_SECRETS_KEY;
        }
        if (store.getItem('eg_nexus_session_secrets_v1') !== null) return 'eg_nexus_session_secrets_v1';
      } catch (_) {}
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.SESSION_SECRETS_KEY === 'string' && globalThis.SESSION_SECRETS_KEY) {
      return globalThis.SESSION_SECRETS_KEY;
    }
    return SESSION_SECRETS_KEY;
  }

  function _quarantineCorruptedPayload(storage, key, raw) {
    try {
      if (storage && typeof storage.setItem === 'function') {
        const target = (typeof key === 'string' && key) ? key : _resolveSecretsStorageKey(storage);
        const corruptPayload = typeof raw === 'string' ? raw : JSON.stringify(raw);
        storage.setItem(target + '_corrupted_' + Date.now(), corruptPayload);
        if (typeof storage.removeItem === 'function') {
          storage.removeItem(target);
        }
      }
    } catch (_) {}
    _cachedSessionSecrets = null;
  }

  function _populateResultFromDecrypted(result, dec) {
    if (!dec || typeof dec !== 'object' || Array.isArray(dec)) return;
    result.initialized = dec.initialized === true;

    const keyList = (typeof globalThis !== 'undefined' && Array.isArray(globalThis.API_KEY_NAMES))
      ? globalThis.API_KEY_NAMES
      : API_KEY_NAMES;

    keyList.forEach(name => {
      if (typeof dec[name] === 'string' && dec[name].trim()) {
        result.apiKeys[name] = dec[name].trim();
      }
      if (typeof dec.apiKeys?.[name] === 'string') {
        result.apiKeys[name] = dec.apiKeys[name].trim();
      }
    });

    if (dec.apiKeys && typeof dec.apiKeys === 'object' && !Array.isArray(dec.apiKeys)) {
      Object.keys(dec.apiKeys).forEach(name => {
        if (typeof dec.apiKeys[name] === 'string') {
          result.apiKeys[name] = dec.apiKeys[name].trim();
        }
      });
    }

    if (dec.connectionTokens && typeof dec.connectionTokens === 'object' && !Array.isArray(dec.connectionTokens)) {
      Object.keys(dec.connectionTokens).forEach(id => {
        if (isSafeConnectionId(id) && typeof dec.connectionTokens[id] === 'string') {
          result.connectionTokens[id] = dec.connectionTokens[id].trim();
        }
      });
    }

    if (dec.accountTokens && typeof dec.accountTokens === 'object' && !Array.isArray(dec.accountTokens)) {
      Object.keys(dec.accountTokens).forEach(accId => {
        if (typeof accId === 'string' && !['__proto__', 'constructor', 'prototype'].includes(accId) && typeof dec.accountTokens[accId] === 'string') {
          result.accountTokens[accId] = dec.accountTokens[accId].trim();
        }
      });
    }

    if (dec.accountRefreshTokens && typeof dec.accountRefreshTokens === 'object' && !Array.isArray(dec.accountRefreshTokens)) {
      Object.keys(dec.accountRefreshTokens).forEach(accId => {
        if (typeof accId === 'string' && !['__proto__', 'constructor', 'prototype'].includes(accId) && typeof dec.accountRefreshTokens[accId] === 'string') {
          result.accountRefreshTokens[accId] = dec.accountRefreshTokens[accId].trim();
        }
      });
    }

    if (typeof dec.bridgeToken === 'string' && dec.bridgeToken.trim()) {
      result.bridgeToken = dec.bridgeToken.trim();
    }

    if (typeof dec.workerSecret === 'string' && dec.workerSecret.trim()) {
      result.workerSecret = dec.workerSecret.trim();
    }
    if (typeof dec.supabaseKey === 'string' && dec.supabaseKey.trim()) {
      result.supabaseKey = dec.supabaseKey.trim();
    }
    if (typeof dec.supabaseAuthToken === 'string' && dec.supabaseAuthToken.trim()) {
      result.supabaseAuthToken = dec.supabaseAuthToken.trim();
    }
    if (typeof dec.botToken === 'string' && dec.botToken.trim()) {
      result.botToken = dec.botToken.trim();
    } else if (typeof dec.telegramBotToken === 'string' && dec.telegramBotToken.trim()) {
      result.botToken = dec.telegramBotToken.trim();
    }
  }

  function _normalizeSecretsPayload(stateOrSecrets, existing) {
    const rawInput = (stateOrSecrets && typeof stateOrSecrets === 'object' && stateOrSecrets._rawInput)
      ? stateOrSecrets._rawInput
      : ((stateOrSecrets && typeof stateOrSecrets === 'object') ? stateOrSecrets : {});
    const extracted = _extractSecretsInput(stateOrSecrets);
    const existingSafe = (existing && typeof existing === 'object') ? existing : _createEmptySessionSecrets();

    const keyList = (typeof globalThis !== 'undefined' && Array.isArray(globalThis.API_KEY_NAMES))
      ? globalThis.API_KEY_NAMES
      : API_KEY_NAMES;

    const mergedApiKeys = { ...(existingSafe.apiKeys || {}) };
    Object.keys(extracted.apiKeys || {}).forEach(k => {
      if (typeof extracted.apiKeys[k] === 'string' && extracted.apiKeys[k].trim()) {
        mergedApiKeys[k] = extracted.apiKeys[k].trim();
      }
    });

    // Clear individual apiKeys explicitly set to empty string in rawInput
    if (rawInput.apiKeys && typeof rawInput.apiKeys === 'object' && !Array.isArray(rawInput.apiKeys)) {
      Object.keys(rawInput.apiKeys).forEach(k => {
        if (rawInput.apiKeys[k] === '' || (typeof rawInput.apiKeys[k] === 'string' && !rawInput.apiKeys[k].trim())) {
          mergedApiKeys[k] = '';
        }
      });
    }
    keyList.forEach(k => {
      if (rawInput[k] === '' || (typeof rawInput[k] === 'string' && !rawInput[k].trim())) {
        mergedApiKeys[k] = '';
      }
    });

    const mergedConnTokens = { ...(existingSafe.connectionTokens || {}) };
    Object.keys(extracted.connectionTokens || {}).forEach(k => {
      if (typeof extracted.connectionTokens[k] === 'string' && extracted.connectionTokens[k].trim()) {
        mergedConnTokens[k] = extracted.connectionTokens[k].trim();
      }
    });

    // Clear connectionTokens explicitly set to empty or null
    if (rawInput.connectionTokens && typeof rawInput.connectionTokens === 'object' && !Array.isArray(rawInput.connectionTokens)) {
      Object.keys(rawInput.connectionTokens).forEach(id => {
        if (rawInput.connectionTokens[id] === '' || (typeof rawInput.connectionTokens[id] === 'string' && !rawInput.connectionTokens[id].trim()) || rawInput.connectionTokens[id] === null) {
          delete mergedConnTokens[id];
        }
      });
    }

    // Handle appConnections: clear or deleted connections
    if (rawInput.appConnections && typeof rawInput.appConnections === 'object' && !Array.isArray(rawInput.appConnections)) {
      Object.keys(mergedConnTokens).forEach(id => {
        if (!(id in rawInput.appConnections)) {
          delete mergedConnTokens[id];
        }
      });
      Object.keys(rawInput.appConnections).forEach(id => {
        const conn = rawInput.appConnections[id];
        if (!conn || conn.token === '' || (typeof conn.token === 'string' && !conn.token.trim()) || conn.token === null) {
          delete mergedConnTokens[id];
        }
      });
    }

    const mergedAccountTokens = { ...(existingSafe.accountTokens || {}) };
    Object.keys(extracted.accountTokens || {}).forEach(k => {
      if (typeof extracted.accountTokens[k] === 'string' && extracted.accountTokens[k].trim()) {
        mergedAccountTokens[k] = extracted.accountTokens[k].trim();
      }
    });

    const mergedAccountRefreshTokens = { ...(existingSafe.accountRefreshTokens || {}) };
    Object.keys(extracted.accountRefreshTokens || {}).forEach(k => {
      if (typeof extracted.accountRefreshTokens[k] === 'string' && extracted.accountRefreshTokens[k].trim()) {
        mergedAccountRefreshTokens[k] = extracted.accountRefreshTokens[k].trim();
      }
    });

    // Clear accountTokens / accountRefreshTokens explicitly set to empty in rawInput
    if (rawInput.accountTokens && typeof rawInput.accountTokens === 'object' && !Array.isArray(rawInput.accountTokens)) {
      Object.keys(rawInput.accountTokens).forEach(id => {
        if (rawInput.accountTokens[id] === '' || (typeof rawInput.accountTokens[id] === 'string' && !rawInput.accountTokens[id].trim()) || rawInput.accountTokens[id] === null) {
          delete mergedAccountTokens[id];
        }
      });
    }

    if (rawInput.accountRefreshTokens && typeof rawInput.accountRefreshTokens === 'object' && !Array.isArray(rawInput.accountRefreshTokens)) {
      Object.keys(rawInput.accountRefreshTokens).forEach(id => {
        if (rawInput.accountRefreshTokens[id] === '' || (typeof rawInput.accountRefreshTokens[id] === 'string' && !rawInput.accountRefreshTokens[id].trim()) || rawInput.accountRefreshTokens[id] === null) {
          delete mergedAccountRefreshTokens[id];
        }
      });
    }

    // Handle account clearing / deletion in appConnections
    if (rawInput.appConnections && typeof rawInput.appConnections === 'object' && !Array.isArray(rawInput.appConnections)) {
      Object.keys(existingSafe.connectionTokens || {}).forEach(id => {
        if (!(id in rawInput.appConnections)) {
          Object.keys(mergedAccountTokens).forEach(accKey => {
            if (accKey.startsWith(id + '_')) delete mergedAccountTokens[accKey];
          });
          Object.keys(mergedAccountRefreshTokens).forEach(accKey => {
            if (accKey.startsWith(id + '_')) delete mergedAccountRefreshTokens[accKey];
          });
        }
      });

      Object.keys(rawInput.appConnections).forEach(id => {
        const conn = rawInput.appConnections[id];
        if (conn && Array.isArray(conn.accounts)) {
          conn.accounts.forEach(acc => {
            if (acc && typeof acc.id === 'string') {
              const scopedKey = acc.id.startsWith(id + '_') ? acc.id : `${id}_${acc.id}`;
              if (acc.token === '' || (typeof acc.token === 'string' && !acc.token.trim()) || acc.token === null) {
                delete mergedAccountTokens[scopedKey];
                delete mergedAccountTokens[acc.id];
              }
              if (acc.refreshToken === '' || (typeof acc.refreshToken === 'string' && !acc.refreshToken.trim()) || acc.refreshToken === null) {
                delete mergedAccountRefreshTokens[scopedKey];
                delete mergedAccountRefreshTokens[acc.id];
              }
            }
          });
        }
      });
    }

    // Scalar fields
    let bridgeToken = existingSafe.bridgeToken || '';
    if (extracted.bridgeToken) {
      bridgeToken = extracted.bridgeToken;
    } else if (rawInput.bridgeToken === '' || (typeof rawInput.bridgeToken === 'string' && !rawInput.bridgeToken.trim())) {
      bridgeToken = '';
    } else if (rawInput.localComputerConfig && typeof rawInput.localComputerConfig === 'object' &&
               (rawInput.localComputerConfig.bridgeToken === '' || (typeof rawInput.localComputerConfig.bridgeToken === 'string' && !rawInput.localComputerConfig.bridgeToken.trim()))) {
      bridgeToken = '';
    }

    let workerSecret = existingSafe.workerSecret || '';
    if (extracted.workerSecret) {
      workerSecret = extracted.workerSecret;
    } else if (rawInput.workerSecret === '' || (typeof rawInput.workerSecret === 'string' && !rawInput.workerSecret.trim())) {
      workerSecret = '';
    } else if (rawInput.cloudConfig && typeof rawInput.cloudConfig === 'object' &&
               (rawInput.cloudConfig.workerSecret === '' || (typeof rawInput.cloudConfig.workerSecret === 'string' && !rawInput.cloudConfig.workerSecret.trim()))) {
      workerSecret = '';
    }

    let supabaseKey = existingSafe.supabaseKey || '';
    if (extracted.supabaseKey) {
      supabaseKey = extracted.supabaseKey;
    } else if (rawInput.supabaseKey === '' || (typeof rawInput.supabaseKey === 'string' && !rawInput.supabaseKey.trim())) {
      supabaseKey = '';
    } else if (rawInput.cloudConfig && typeof rawInput.cloudConfig === 'object' &&
               (rawInput.cloudConfig.supabaseKey === '' || (typeof rawInput.cloudConfig.supabaseKey === 'string' && !rawInput.cloudConfig.supabaseKey.trim()))) {
      supabaseKey = '';
    }

    let supabaseAuthToken = existingSafe.supabaseAuthToken || '';
    if (extracted.supabaseAuthToken) {
      supabaseAuthToken = extracted.supabaseAuthToken;
    } else if (rawInput.supabaseAuthToken === '' || (typeof rawInput.supabaseAuthToken === 'string' && !rawInput.supabaseAuthToken.trim())) {
      supabaseAuthToken = '';
    } else if (rawInput.cloudConfig && typeof rawInput.cloudConfig === 'object' &&
               (rawInput.cloudConfig.supabaseAuthToken === '' || (typeof rawInput.cloudConfig.supabaseAuthToken === 'string' && !rawInput.cloudConfig.supabaseAuthToken.trim()))) {
      supabaseAuthToken = '';
    }

    let botToken = existingSafe.botToken || '';
    if (extracted.botToken) {
      botToken = extracted.botToken;
    } else if (rawInput.botToken === '' || (typeof rawInput.botToken === 'string' && !rawInput.botToken.trim()) ||
               rawInput.telegramBotToken === '' || (typeof rawInput.telegramBotToken === 'string' && !rawInput.telegramBotToken.trim())) {
      botToken = '';
    } else if (rawInput.telegramConfig && typeof rawInput.telegramConfig === 'object' &&
               (rawInput.telegramConfig.botToken === '' || (typeof rawInput.telegramConfig.botToken === 'string' && !rawInput.telegramConfig.botToken.trim()))) {
      botToken = '';
    }

    const secrets = {
      version: SESSION_SECRETS_SCHEMA_VERSION,
      initialized: true,
      apiKeys: mergedApiKeys,
      connectionTokens: mergedConnTokens,
      accountTokens: mergedAccountTokens,
      accountRefreshTokens: mergedAccountRefreshTokens,
      bridgeToken,
      workerSecret,
      supabaseKey,
      supabaseAuthToken,
      botToken
    };
    return secrets;
  }

  function readSessionSecrets(storage) {
    const result = _createEmptySessionSecrets();
    if (_cachedSessionSecrets && _cachedSessionSecrets.initialized) {
      return _cloneSessionSecrets(_cachedSessionSecrets);
    }

    const store = _getStorage(storage);
    if (!store) return result;

    const targetKey = _resolveSecretsStorageKey(store);
    let raw = null;
    try {
      raw = store.getItem(targetKey);
    } catch (_) {}
    if (!raw) return result;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (jsonErr) {
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;

    // Handle Legacy Plaintext JSON (transparent migration & re-encryption)
    if (!parsed.encrypted) {
      if (parsed.version !== undefined && (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > SESSION_SECRETS_SCHEMA_VERSION)) {
        _quarantineCorruptedPayload(store, targetKey, raw);
        return result;
      }
      _populateResultFromDecrypted(result, parsed);
      result.initialized = true;
      _cachedSessionSecrets = _cloneSessionSecrets(result);
      writeSessionSecrets(result, store);
      return result;
    }

    // AUD-SEC-09: Explicitly reject invalid or zero version (allow undefined strictly for legacy sync-stream-v1)
    const algorithm = parsed.algorithm || 'sync-stream-v1';
    if (parsed.version !== undefined) {
      if (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > SESSION_SECRETS_SCHEMA_VERSION) {
        _quarantineCorruptedPayload(store, targetKey, raw);
        return result;
      }
    } else if (algorithm !== 'sync-stream-v1') {
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    const iv = _hexToUint8(parsed.iv);
    if (!iv || !(iv instanceof Uint8Array) || iv.byteLength !== 12) {
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    // Handle AES-GCM-256
    if (algorithm === 'AES-GCM-256') {
      if (_cachedSessionSecrets && _cachedSessionSecrets.initialized) {
        return _cloneSessionSecrets(_cachedSessionSecrets);
      }

      // If Node.js crypto is available, decrypt synchronously using decipheriv
      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
        let plainBytes = null;
        try {
          const keyBytes = _initMemorySessionKey(store);
          const ivBytes = _hexToUint8(parsed.iv);
          if (!ivBytes || !(ivBytes instanceof Uint8Array) || ivBytes.byteLength !== 12) {
            _quarantineCorruptedPayload(store, targetKey, raw);
            return result;
          }
          const combined = _hexToUint8(parsed.ciphertext);
          if (combined && combined.length >= 16) {
            const authTag = combined.subarray(combined.length - 16);
            const encData = combined.subarray(0, combined.length - 16);
            const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBytes, ivBytes);
            const aad = parsed.aad || parsed.additionalData;
            if (aad) {
              decipher.setAAD(_toAadBytes(aad));
            }
            decipher.setAuthTag(authTag);
            plainBytes = _concatUint8([decipher.update(encData), decipher.final()]);
            const decStr = new TextDecoder().decode(plainBytes);
            const dec = JSON.parse(decStr);
            _populateResultFromDecrypted(result, dec);
            _cachedSessionSecrets = _cloneSessionSecrets(result);
            return result;
          }
        } catch (err) {
          // Decryption or auth tag failed: fail-closed against algorithm downgrade
          _quarantineCorruptedPayload(store, targetKey, raw);
          return result;
        } finally {
          if (plainBytes) _zeroizeBuffer(plainBytes);
        }
      }

      // In browser without synchronous Node crypto, NEVER quarantine valid AES-GCM-256 payloads!
      // Return cached secrets if available, or return pendingAsyncHydration so async reader can decrypt with WebCrypto
      if (_cachedSessionSecrets && _cachedSessionSecrets.initialized) {
        return _cloneSessionSecrets(_cachedSessionSecrets);
      }
      return { ...result, initialized: false, pendingAsyncHydration: true };
    }

    // Handle legacy format strictly when algorithm === 'sync-stream-v1'
    if (algorithm === 'sync-stream-v1') {
      try {
        const iv = _hexToUint8(parsed.iv);
        const cipherHex = parsed.syncCiphertext || parsed.ciphertext;
        const ciphertext = _hexToUint8(cipherHex);
        const keyRaw = _initMemorySessionKey(store);
        const plainBytes = _nonCryptoCompatCodec(ciphertext, keyRaw, iv);
        const decStr = new TextDecoder().decode(plainBytes);
        const dec = JSON.parse(decStr);
        _populateResultFromDecrypted(result, dec);
        _cachedSessionSecrets = _cloneSessionSecrets(result);
      } catch (e) {
        _quarantineCorruptedPayload(store, targetKey, raw);
      }
      return result;
    }

    _quarantineCorruptedPayload(store, targetKey, raw);
    return result;
  }

  async function readSessionSecretsAsync(storage) {
    const result = _createEmptySessionSecrets();
    if (_cachedSessionSecrets && _cachedSessionSecrets.initialized) {
      return _cloneSessionSecrets(_cachedSessionSecrets);
    }

    const store = _getStorage(storage);
    if (!store) return result;

    const targetKey = _resolveSecretsStorageKey(store);
    let raw = null;
    try {
      raw = store.getItem(targetKey);
    } catch (_) {}
    if (!raw) return result;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (jsonErr) {
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;

    // Handle Legacy Plaintext JSON
    if (!parsed.encrypted) {
      if (parsed.version !== undefined && (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > SESSION_SECRETS_SCHEMA_VERSION)) {
        _quarantineCorruptedPayload(store, targetKey, raw);
        return result;
      }
      _populateResultFromDecrypted(result, parsed);
      result.initialized = true;
      _cachedSessionSecrets = _cloneSessionSecrets(result);
      await writeSessionSecretsAsync(result, store);
      return result;
    }

    // AUD-SEC-09: Explicitly reject invalid or zero version (allow undefined strictly for legacy sync-stream-v1)
    const algorithm = parsed.algorithm || 'sync-stream-v1';
    if (parsed.version !== undefined) {
      if (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > SESSION_SECRETS_SCHEMA_VERSION) {
        _quarantineCorruptedPayload(store, targetKey, raw);
        return result;
      }
    } else if (algorithm !== 'sync-stream-v1') {
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    const iv = _hexToUint8(parsed.iv);
    if (!iv || !(iv instanceof Uint8Array) || iv.byteLength !== 12) {
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    // Try Web Crypto AES-GCM decryption if algorithm is AES-GCM-256
    if (algorithm === 'AES-GCM-256') {
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      const combined = _hexToUint8(parsed.ciphertext);
      let decStr = null;
      let plainBytes = null;
      const aad = parsed.aad || parsed.additionalData;

      if (cryptoObj && cryptoObj.subtle) {
        try {
          const key = await _getOrCreateWebCryptoKey(store);
          if (key) {
            const decParams = { name: 'AES-GCM', iv };
            if (aad) {
              decParams.additionalData = new TextEncoder().encode(aad);
            }
            const decAb = await cryptoObj.subtle.decrypt(decParams, key, combined);
            decStr = new TextDecoder().decode(decAb);
          }
        } catch (_) {}
      }

      if (!decStr) {
        const nodeCrypto = _getNodeCrypto();
        if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
          try {
            const keyBytes = _initMemorySessionKey(store);
            if (combined.length >= 16) {
              const authTag = combined.subarray(combined.length - 16);
              const encData = combined.subarray(0, combined.length - 16);
              const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBytes, iv);
              if (aad) {
                decipher.setAAD(_toAadBytes(aad));
              }
              decipher.setAuthTag(authTag);
              plainBytes = _concatUint8([decipher.update(encData), decipher.final()]);
              decStr = new TextDecoder().decode(plainBytes);
            }
          } catch (_) {}
        }
      }

      if (decStr) {
        try {
          const dec = JSON.parse(decStr);
          _populateResultFromDecrypted(result, dec);
          _cachedSessionSecrets = _cloneSessionSecrets(result);
          if (plainBytes) _zeroizeBuffer(plainBytes);
          return result;
        } catch (_) {}
      }
      if (plainBytes) _zeroizeBuffer(plainBytes);

      // Decryption or auth tag verification failed:
      // Fail-closed against algorithm downgrade attack (never fallback to syncCiphertext)
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    // Handle legacy format strictly when algorithm === 'sync-stream-v1'
    if (algorithm === 'sync-stream-v1') {
      try {
        const cipherHex = parsed.syncCiphertext || parsed.ciphertext;
        const ciphertext = _hexToUint8(cipherHex);
        const keyRaw = _initMemorySessionKey(store);
        const plainBytes = _nonCryptoCompatCodec(ciphertext, keyRaw, iv);
        const decStr = new TextDecoder().decode(plainBytes);
        const dec = JSON.parse(decStr);
        _populateResultFromDecrypted(result, dec);
        _cachedSessionSecrets = _cloneSessionSecrets(result);
      } catch (err) {
        _quarantineCorruptedPayload(store, targetKey, raw);
      }
      return result;
    }

    _quarantineCorruptedPayload(store, targetKey, raw);
    return result;
  }

  function writeSessionSecrets(stateOrSecrets, storage) {
    const store = _getStorage(storage);
    const targetKey = _resolveSecretsStorageKey(store);

    if (!store || typeof store.setItem !== 'function') {
      const currentRev = ++writeRevision;
      const existing = readSessionSecrets(store);
      const secrets = _normalizeSecretsPayload(stateOrSecrets, existing);
      _cachedSessionSecrets = _cloneSessionSecrets(secrets);
      lastAppliedWriteRevision = Math.max(lastAppliedWriteRevision, currentRev);
      return true;
    }

    // AUD-SEC-08 / AUD-SEC-10: Capture prevRaw and compare envelopeRevision
    let prevRaw = null;
    try {
      prevRaw = store.getItem(targetKey);
    } catch (_) {}

    let diskRev = 0;
    if (prevRaw) {
      try {
        const diskParsed = JSON.parse(prevRaw);
        if (diskParsed && typeof diskParsed === 'object') {
          diskRev = Number.isInteger(diskParsed.revision)
            ? diskParsed.revision
            : (Number.isInteger(diskParsed.envelopeRevision) ? diskParsed.envelopeRevision : 0);
        }
      } catch (_) {}
    }

    const existing = readSessionSecrets(store);
    const secrets = _normalizeSecretsPayload(stateOrSecrets, existing);

    // NIST SP 800-38D encryption limit check
    if (_moduleEncryptionCount >= _maxEncryptionsPerKey) {
      throw new Error('NIST SP 800-38D encryption limit reached (1000000 encryptions per key). Key rotation required.');
    }
    _moduleEncryptionCount++;

    let plainBytes = null;
    try {
      const iv = new Uint8Array(12);
      _fillSecureRandomBytes(iv);

      const jsonStr = JSON.stringify(secrets);
      plainBytes = new TextEncoder().encode(jsonStr);
      const keyRaw = _initMemorySessionKey(store);

      let hexCombined = null;
      const aadString = 'v' + SESSION_SECRETS_SCHEMA_VERSION + ':' + targetKey;
      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.createCipheriv === 'function') {
        try {
          const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyRaw, iv);
          cipher.setAAD(_toAadBytes(aadString));
          const enc = _concatUint8([cipher.update(plainBytes), cipher.final()]);
          const tag = cipher.getAuthTag();
          const combined = _concatUint8([enc, tag]);
          hexCombined = _uint8ToHex(combined);
        } catch (_) {}
      }

      if (hexCombined) {
        const currentRev = Math.max(++writeRevision, diskRev + 1);
        const envelopeStr = JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          initialized: true,
          iv: _uint8ToHex(iv),
          ciphertext: hexCombined,
          aad: aadString,
          version: SESSION_SECRETS_SCHEMA_VERSION,
          revision: currentRev,
          envelopeRevision: currentRev
        });

        // AUD-SEC-08: Atomic write with post-write verification and rollback
        try {
          store.setItem(targetKey, envelopeStr);
          const verifyRaw = store.getItem(targetKey);
          if (verifyRaw !== envelopeStr) {
            throw new Error('Post-write verification failed: storage mismatch');
          }
        } catch (writeErr) {
          try {
            if (prevRaw !== null) {
              store.setItem(targetKey, prevRaw);
            } else if (typeof store.removeItem === 'function') {
              store.removeItem(targetKey);
            }
          } catch (_) {}
          return false;
        }

        _cachedSessionSecrets = _cloneSessionSecrets(secrets);
        lastAppliedWriteRevision = Math.max(lastAppliedWriteRevision, currentRev);
      } else {
        // Pure browser synchronous call fallback:
        // Schedule sequential write queue so WebCrypto persists pure AES-GCM-256 without syncCiphertext
        _cachedSessionSecrets = _cloneSessionSecrets(secrets);
        if (typeof queueSessionSecretsWrite === 'function') {
          queueSessionSecretsWrite(secrets, store);
        } else if (typeof writeSessionSecretsAsync === 'function') {
          writeSessionSecretsAsync(secrets, store);
        }
      }

      return true;
    } catch (e) {
      return false;
    } finally {
      if (plainBytes) _zeroizeBuffer(plainBytes);
    }
  }

  async function _performWriteSessionSecretsAsync(stateOrSecrets, storage) {
    const store = _getStorage(storage);
    const targetKey = _resolveSecretsStorageKey(store);

    if (!store || typeof store.setItem !== 'function') {
      const existing = await readSessionSecretsAsync(store);
      const secrets = _normalizeSecretsPayload(stateOrSecrets, existing);
      _cachedSessionSecrets = _cloneSessionSecrets(secrets);
      return true;
    }

    // AUD-SEC-06, AUD-SEC-07, FND-05, FND-18:
    // In browser environment, before writing new ciphertext, verify that non-extractable WebCrypto key
    // is actually stored and retrievable in IndexedDB.
    // If IndexedDB is disabled or throws on open/write, set _degradedPersistence = true, fail closed with explicit error,
    // and do NOT overwrite valid previous ciphertext with a volatile key that will be lost on reload.
    if (_isBrowserEnvironment()) {
      const idb = _getIdbFactory();
      let idbOk = false;
      if (idb && typeof idb.open === 'function' && !_degradedPersistence) {
        try {
          const db = await _openKeystoreDB();
          if (db) {
            let keyInIdb = await _getKeyFromIndexedDB();
            if (!keyInIdb) {
              const cryptoKey = await _getOrCreateWebCryptoKey(store);
              if (cryptoKey) {
                await _saveKeyToIndexedDB(cryptoKey);
                keyInIdb = await _getKeyFromIndexedDB();
              }
            }
            if (keyInIdb && typeof keyInIdb === 'object' && keyInIdb.algorithm) {
              idbOk = true;
            }
          }
        } catch (_) {
          idbOk = false;
        }
      }
      if (!idbOk) {
        _degradedPersistence = true;
        throw new Error('IndexedDB keystore verification failed: non-extractable WebCrypto key cannot be verified in IndexedDB (fail-closed)');
      }
    }

    // AUD-SEC-08 / AUD-SEC-10: Capture prevRaw and compare envelopeRevision
    let prevRaw = null;
    try {
      prevRaw = store.getItem(targetKey);
    } catch (_) {}

    let diskRev = 0;
    if (prevRaw) {
      try {
        const diskParsed = JSON.parse(prevRaw);
        if (diskParsed && typeof diskParsed === 'object') {
          diskRev = Number.isInteger(diskParsed.revision)
            ? diskParsed.revision
            : (Number.isInteger(diskParsed.envelopeRevision) ? diskParsed.envelopeRevision : 0);
        }
      } catch (_) {}
    }

    const existing = await readSessionSecretsAsync(store);
    const secrets = _normalizeSecretsPayload(stateOrSecrets, existing);

    // NIST SP 800-38D encryption limit check
    if (_moduleEncryptionCount >= _maxEncryptionsPerKey) {
      throw new Error('NIST SP 800-38D encryption limit reached (1000000 encryptions per key). Key rotation required.');
    }
    _moduleEncryptionCount++;

    let plainBytes = null;
    try {
      const iv = new Uint8Array(12);
      _fillSecureRandomBytes(iv);

      const jsonStr = JSON.stringify(secrets);
      plainBytes = new TextEncoder().encode(jsonStr);
      const keyRaw = _initMemorySessionKey(store);

      let hexCombined = null;
      const aadString = 'v' + SESSION_SECRETS_SCHEMA_VERSION + ':' + targetKey;
      const aadBytes = new TextEncoder().encode(aadString);

      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && cryptoObj.subtle) {
        try {
          const key = await _getOrCreateWebCryptoKey(store);
          if (key) {
            const ab = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadBytes }, key, plainBytes);
            hexCombined = _uint8ToHex(new Uint8Array(ab));
          }
        } catch (_) {}
      }

      if (!hexCombined) {
        const nodeCrypto = _getNodeCrypto();
        if (nodeCrypto && typeof nodeCrypto.createCipheriv === 'function') {
          try {
            const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyRaw, iv);
            cipher.setAAD(_toAadBytes(aadString));
            const enc = _concatUint8([cipher.update(plainBytes), cipher.final()]);
            const tag = cipher.getAuthTag();
            const combined = _concatUint8([enc, tag]);
            hexCombined = _uint8ToHex(combined);
          } catch (_) {}
        }
      }

      if (!hexCombined) {
        return false;
      }

      const assignedRev = Math.max(writeRevision, diskRev + 1);
      const envelopeStr = JSON.stringify({
        encrypted: true,
        algorithm: 'AES-GCM-256',
        initialized: true,
        iv: _uint8ToHex(iv),
        ciphertext: hexCombined,
        aad: aadString,
        version: SESSION_SECRETS_SCHEMA_VERSION,
        revision: assignedRev,
        envelopeRevision: assignedRev
      });

      // AUD-SEC-08: Atomic write with post-write verification and rollback
      try {
        store.setItem(targetKey, envelopeStr);
        const verifyRaw = store.getItem(targetKey);
        if (verifyRaw !== envelopeStr) {
          throw new Error('Post-write verification failed: storage mismatch');
        }
      } catch (writeErr) {
        try {
          if (prevRaw !== null) {
            store.setItem(targetKey, prevRaw);
          } else if (typeof store.removeItem === 'function') {
            store.removeItem(targetKey);
          }
        } catch (_) {}
        return false;
      }

      _cachedSessionSecrets = _cloneSessionSecrets(secrets);
      return true;
    } catch (e) {
      return false;
    } finally {
      if (plainBytes) _zeroizeBuffer(plainBytes);
    }
  }

  async function writeSessionSecretsAsync(stateOrSecrets, storage) {
    try {
      return await queueSessionSecretsWrite(stateOrSecrets, storage);
    } catch (err) {
      if (_degradedPersistence || (err && err.message && err.message.includes('IndexedDB'))) {
        throw err;
      }
      return false;
    }
  }

  function getSecretVaultHealth() {
    let idbFactory = null;
    let idbOpenFailed = false;

    try {
      idbFactory = _getIdbFactory();
      if (idbFactory && typeof idbFactory.open === 'function') {
        const req = idbFactory.open('__nexus_health_probe__', 1);
        if (req && typeof req.addEventListener === 'function') {
          req.addEventListener('error', () => {
            _degradedPersistence = true;
          });
        }
      } else if (_isBrowserEnvironment()) {
        idbOpenFailed = true;
        _degradedPersistence = true;
      }
    } catch (_) {
      idbOpenFailed = true;
      _degradedPersistence = true;
    }

    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    const hasWebCrypto = Boolean(cryptoObj && cryptoObj.subtle);
    const hasNodeCrypto = Boolean(_getNodeCrypto());
    const nativeKs = _getNativeAndroidKeystore();
    const isNativeAndroid = Boolean(nativeKs);
    const backend = getKeystoreBackend();

    // Determine securityLevel and hardwareBacked strictly per audit G5 & local-first spec
    let securityLevel = 'software';
    let hardwareBacked = false;
    if (isNativeAndroid) {
      if (_cachedKeySecurityInfo && _cachedKeySecurityInfo.securityLevel) {
        securityLevel = _cachedKeySecurityInfo.securityLevel;
      } else if (typeof nativeKs.securityLevel === 'string') {
        securityLevel = nativeKs.securityLevel;
      } else if (nativeKs.hardwareBacked === true && (!nativeKs.securityLevel || nativeKs.securityLevel === 'tee')) {
        securityLevel = 'tee';
      } else if (nativeKs.hardwareBacked === true && nativeKs.securityLevel === 'strongbox') {
        securityLevel = 'strongbox';
      } else {
        securityLevel = 'software';
      }
      hardwareBacked = Boolean(securityLevel === 'strongbox' || securityLevel === 'tee');
    } else if (hasWebCrypto) {
      securityLevel = 'webcrypto';
      hardwareBacked = false;
    } else {
      securityLevel = 'software';
      hardwareBacked = false;
    }

    if (_degradedPersistence || idbOpenFailed) {
      return {
        ok: false,
        degradedPersistence: true,
        mode: 'volatile-memory-only',
        hasIndexedDB: false,
        hasWebCrypto,
        hasNodeCrypto,
        isNativeAndroid,
        hardwareBacked,
        hardwareKeystoreAvailable: hardwareBacked,
        securityLevel,
        keystoreBackend: backend,
        activePendingCount,
        writeEpoch,
        schemaVersion: SESSION_SECRETS_SCHEMA_VERSION,
        encryptionCount: _moduleEncryptionCount,
        maxEncryptionsPerKey: _maxEncryptionsPerKey
      };
    }

    const hasIdb = Boolean(idbFactory);
    const mode = isNativeAndroid
      ? (hardwareBacked ? 'android-keystore-hardware' : 'android-keystore-software')
      : (hasIdb ? 'idb-webcrypto-non-extractable' : (hasWebCrypto || hasNodeCrypto ? 'session-memory-only' : 'degraded'));
    return {
      ok: Boolean(hasWebCrypto || hasNodeCrypto || isNativeAndroid),
      degradedPersistence: false,
      hasIndexedDB: hasIdb,
      hasWebCrypto,
      hasNodeCrypto,
      isNativeAndroid,
      hardwareBacked,
      hardwareKeystoreAvailable: hardwareBacked,
      securityLevel,
      keystoreBackend: backend,
      mode,
      activePendingCount,
      writeEpoch,
      schemaVersion: SESSION_SECRETS_SCHEMA_VERSION,
      encryptionCount: _moduleEncryptionCount,
      maxEncryptionsPerKey: _maxEncryptionsPerKey
    };
  }

  function _hydrateStateWithSecrets(state, secrets) {
    if (!state || typeof state !== 'object' || !secrets) return state;
    if (secrets.initialized) {
      if (!state.apiKeys || typeof state.apiKeys !== 'object' || Array.isArray(state.apiKeys)) {
        state.apiKeys = {};
      }
      Object.keys(secrets.apiKeys).forEach(name => {
        if (secrets.apiKeys[name]) state.apiKeys[name] = secrets.apiKeys[name];
      });
    }
    if (!state.appConnections || typeof state.appConnections !== 'object' || Array.isArray(state.appConnections)) {
      state.appConnections = {};
    }
    Object.keys(secrets.connectionTokens).forEach(id => {
      if (secrets.connectionTokens[id]) {
        if (!state.appConnections[id] || typeof state.appConnections[id] !== 'object') {
          state.appConnections[id] = { accounts: [], mcpEnabled: false, connectedAt: '' };
        }
        state.appConnections[id].token = secrets.connectionTokens[id];
      }
    });
    if (secrets.accountTokens || secrets.accountRefreshTokens) {
      Object.keys(state.appConnections).forEach(id => {
        const conn = state.appConnections[id];
        if (conn && Array.isArray(conn.accounts)) {
          conn.accounts.forEach(acc => {
            if (acc?.id) {
              if (secrets.accountTokens) {
                const tok = secrets.accountTokens[`${id}_${acc.id}`] || secrets.accountTokens[acc.id];
                if (tok) acc.token = tok;
              }
              if (secrets.accountRefreshTokens) {
                const refTok = secrets.accountRefreshTokens[`${id}_${acc.id}`] || secrets.accountRefreshTokens[acc.id];
                if (refTok) acc.refreshToken = refTok;
              }
            }
          });
        }
      });
    }
    if (secrets.bridgeToken) {
      if (!state.localComputerConfig || typeof state.localComputerConfig !== 'object') {
        state.localComputerConfig = {};
      }
      state.localComputerConfig.bridgeToken = secrets.bridgeToken;
    }
    if (secrets.workerSecret) {
      if (!state.cloudConfig || typeof state.cloudConfig !== 'object') state.cloudConfig = {};
      state.cloudConfig.workerSecret = secrets.workerSecret;
    }
    if (secrets.supabaseKey) {
      if (!state.cloudConfig || typeof state.cloudConfig !== 'object') state.cloudConfig = {};
      state.cloudConfig.supabaseKey = secrets.supabaseKey;
    }
    if (secrets.supabaseAuthToken) {
      if (!state.cloudConfig || typeof state.cloudConfig !== 'object') state.cloudConfig = {};
      state.cloudConfig.supabaseAuthToken = secrets.supabaseAuthToken;
    }
    if (secrets.botToken) {
      if (!state.telegramConfig || typeof state.telegramConfig !== 'object') state.telegramConfig = {};
      state.telegramConfig.botToken = secrets.botToken;
    }
    return state;
  }

  function applySessionSecrets(state, storage) {
    if (!state || typeof state !== 'object') return state;
    const secrets = readSessionSecrets(storage);
    return _hydrateStateWithSecrets(state, secrets);
  }

  async function applySessionSecretsAsync(state, storage) {
    if (!state || typeof state !== 'object') return state;
    const secrets = await readSessionSecretsAsync(storage);
    return _hydrateStateWithSecrets(state, secrets);
  }

  // =========================================================================
  // PBKDF2-HMAC-SHA256 & Encrypted Backup KDF Upgrade (v2) (FND-04)
  // =========================================================================
  function _hmacSha256Pure(keyBytes, msgBytes) {
    let k = keyBytes;
    if (k.length > 64) {
      k = _sha256Pure(k);
    }
    const paddedK = new Uint8Array(64);
    paddedK.set(k);

    const ipad = new Uint8Array(64);
    const opad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      ipad[i] = paddedK[i] ^ 0x36;
      opad[i] = paddedK[i] ^ 0x5c;
    }

    const innerMsg = new Uint8Array(64 + msgBytes.length);
    innerMsg.set(ipad, 0);
    innerMsg.set(msgBytes, 64);
    const innerHash = _sha256Pure(innerMsg);

    const outerMsg = new Uint8Array(64 + 32);
    outerMsg.set(opad, 0);
    outerMsg.set(innerHash, 64);
    return _sha256Pure(outerMsg);
  }

  function _purePbkdf2HmacSha256(passphrase, saltBytes, iterations, keyLen) {
    const passBytes = typeof passphrase === 'string' ? new TextEncoder().encode(passphrase) : passphrase;
    const numBlocks = Math.ceil(keyLen / 32);
    const out = new Uint8Array(keyLen);

    for (let blockIdx = 1; blockIdx <= numBlocks; blockIdx++) {
      const saltAndIndex = new Uint8Array(saltBytes.length + 4);
      saltAndIndex.set(saltBytes, 0);
      const view = new DataView(saltAndIndex.buffer, saltAndIndex.byteOffset, saltAndIndex.byteLength);
      view.setUint32(saltBytes.length, blockIdx, false);

      let u = _hmacSha256Pure(passBytes, saltAndIndex);
      const t = new Uint8Array(u);

      for (let iter = 1; iter < iterations; iter++) {
        u = _hmacSha256Pure(passBytes, u);
        for (let k = 0; k < 32; k++) {
          t[k] ^= u[k];
        }
      }

      const offset = (blockIdx - 1) * 32;
      const toCopy = Math.min(32, keyLen - offset);
      out.set(t.subarray(0, toCopy), offset);
    }
    return out;
  }

  async function _derivePbkdf2Key(passphrase, saltBytes, iterations, keyLength = 32) {
    if (!passphrase || (typeof passphrase !== 'string' && !(passphrase instanceof Uint8Array))) {
      throw new Error('passphrase must be a non-empty string or Uint8Array');
    }
    if (!saltBytes || !(saltBytes instanceof Uint8Array)) {
      throw new Error('saltBytes must be a Uint8Array');
    }
    const nodeCrypto = _getNodeCrypto();
    if (nodeCrypto && typeof nodeCrypto.pbkdf2Sync === 'function') {
      try {
        const passBuf = typeof passphrase === 'string' ? Buffer.from(passphrase, 'utf8') : Buffer.from(passphrase);
        const saltBuf = Buffer.from(saltBytes.buffer, saltBytes.byteOffset, saltBytes.byteLength);
        const derived = nodeCrypto.pbkdf2Sync(passBuf, saltBuf, iterations, keyLength, 'sha256');
        return new Uint8Array(derived.buffer, derived.byteOffset, derived.byteLength);
      } catch (_) {}
    }

    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (cryptoObj && cryptoObj.subtle && typeof cryptoObj.subtle.importKey === 'function') {
      const passBytes = typeof passphrase === 'string' ? new TextEncoder().encode(passphrase) : passphrase;
      const baseKey = await cryptoObj.subtle.importKey(
        'raw',
        passBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedAb = await cryptoObj.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations,
          hash: 'SHA-256'
        },
        baseKey,
        keyLength * 8
      );
      return new Uint8Array(derivedAb);
    }

    return _purePbkdf2HmacSha256(passphrase, saltBytes, iterations, keyLength);
  }

  async function exportEncryptedBackup(payload, passphrase, options = {}) {
    if (!passphrase || (typeof passphrase !== 'string' && !(passphrase instanceof Uint8Array))) {
      throw new Error('passphrase must be a non-empty string or Uint8Array');
    }
    const iterations = (options && Number.isInteger(options.iterations) && options.iterations > 0)
      ? options.iterations
      : 600000;
    const salt = new Uint8Array(16);
    _fillSecureRandomBytes(salt);

    const keyBytes = await _derivePbkdf2Key(passphrase, salt, iterations, 32);

    const iv = new Uint8Array(12);
    _fillSecureRandomBytes(iv);

    const jsonStr = (typeof payload === 'string') ? payload : JSON.stringify(payload || {});
    const plainBytes = new TextEncoder().encode(jsonStr);

    let hexCombined = null;
    const nodeCrypto = _getNodeCrypto();
    if (nodeCrypto && typeof nodeCrypto.createCipheriv === 'function') {
      try {
        const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyBytes, iv);
        const enc = _concatUint8([cipher.update(plainBytes), cipher.final()]);
        const tag = cipher.getAuthTag();
        const combined = _concatUint8([enc, tag]);
        hexCombined = _uint8ToHex(combined);
      } catch (_) {}
    }

    if (!hexCombined) {
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && cryptoObj.subtle) {
        try {
          const importedKey = await cryptoObj.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
          );
          const encryptedAb = await cryptoObj.subtle.encrypt(
            { name: 'AES-GCM', iv },
            importedKey,
            plainBytes
          );
          hexCombined = _uint8ToHex(new Uint8Array(encryptedAb));
        } catch (_) {}
      }
    }

    if (!hexCombined) {
      throw new Error('Encryption failed: neither Node.js crypto nor WebCrypto AES-GCM is available');
    }

    const envelope = {
      version: 2,
      kdf: 'PBKDF2-HMAC-SHA256',
      iterations,
      salt: _uint8ToHex(salt),
      iv: _uint8ToHex(iv),
      algorithm: 'AES-GCM-256',
      ciphertext: hexCombined,
      createdAt: new Date().toISOString()
    };

    return (options && options.format === 'string') ? JSON.stringify(envelope) : envelope;
  }

  async function importEncryptedBackup(backupData, passphrase) {
    if (!passphrase || (typeof passphrase !== 'string' && !(passphrase instanceof Uint8Array))) {
      throw new Error('passphrase must be a non-empty string or Uint8Array');
    }
    let envelope = backupData;
    if (typeof backupData === 'string') {
      try {
        envelope = JSON.parse(backupData);
      } catch (e) {
        throw new Error('Invalid backup format: payload must be valid JSON');
      }
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      throw new Error('Invalid backup format: root must be an object');
    }

    const version = envelope.version || (envelope.kdf === 'PBKDF2-HMAC-SHA256' ? 2 : 1);
    const iv = _hexToUint8(envelope.iv);
    if (!iv || iv.length !== 12) {
      throw new Error('Invalid backup: missing or invalid 12-byte IV');
    }
    const combinedCipher = _hexToUint8(envelope.ciphertext);
    if (!combinedCipher || combinedCipher.length < 16) {
      throw new Error('Invalid backup: missing or corrupted ciphertext');
    }

    let keyBytes = null;
    if (version === 2 || envelope.kdf === 'PBKDF2-HMAC-SHA256') {
      const salt = _hexToUint8(envelope.salt);
      if (!salt || salt.length < 16) {
        throw new Error('Invalid backup v2: salt must be at least 16 bytes');
      }
      const iterations = envelope.iterations || 600000;
      keyBytes = await _derivePbkdf2Key(passphrase, salt, iterations, 32);
    } else {
      // Legacy v1 (SHA-256)
      const passBytes = typeof passphrase === 'string' ? new TextEncoder().encode(passphrase) : passphrase;
      if (envelope.salt) {
        const saltBytes = _hexToUint8(envelope.salt);
        keyBytes = _sha256(_concatUint8([passBytes, saltBytes]));
      } else {
        keyBytes = _sha256(passBytes);
      }
    }

    let plainBytes = null;
    const nodeCrypto = _getNodeCrypto();
    if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
      try {
        const encData = combinedCipher.subarray(0, combinedCipher.length - 16);
        const authTag = combinedCipher.subarray(combinedCipher.length - 16);
        const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBytes, iv);
        decipher.setAuthTag(authTag);
        plainBytes = _concatUint8([decipher.update(encData), decipher.final()]);
      } catch (err) {
        throw new Error('Backup decryption failed: invalid passphrase or corrupted payload');
      }
    }

    if (!plainBytes) {
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && cryptoObj.subtle) {
        try {
          const importedKey = await cryptoObj.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
          );
          const decAb = await cryptoObj.subtle.decrypt(
            { name: 'AES-GCM', iv },
            importedKey,
            combinedCipher
          );
          plainBytes = new Uint8Array(decAb);
        } catch (_) {
          throw new Error('Backup decryption failed: invalid passphrase or corrupted payload');
        }
      }
    }

    if (!plainBytes) {
      throw new Error('Backup decryption failed: crypto engine unavailable or auth tag mismatch');
    }

    const plainStr = new TextDecoder().decode(plainBytes);
    try {
      return JSON.parse(plainStr);
    } catch (_) {
      return plainStr;
    }
  }

  // =========================================================================
  // SecretVault Class (NIST SP 800-38D, FND-06, AUD-SEC-05)
  // =========================================================================
  class SecretVault {
    constructor(options = {}) {
      this.storage = options.storage || null;
      this._encryptionCount = 0;
      this._maxEncryptionsPerKey = 1000000; // NIST SP 800-38D
      this.initialized = false;
      this._id = options.id || 'default';
    }

    async init(storage) {
      if (storage) this.storage = storage;
      const store = _getStorage(this.storage);

      const nativeKs = _getNativeAndroidKeystore();
      if (nativeKs && typeof nativeKs.isAvailable === 'function') {
        try {
          const res = await nativeKs.isAvailable();
          if (res && res.available && res.hardwareBacked !== false) {
            this.initialized = true;
            this.hardwareBacked = Boolean(res.hardwareBacked !== false);
            this.securityLevel = res.securityLevel || (this.hardwareBacked ? 'tee' : 'software');
            return this;
          }
        } catch (_) {}
      }

      if (_isBrowserEnvironment()) {
        const idb = _getIdbFactory();
        let idbOk = false;
        if (idb && typeof idb.open === 'function' && !_degradedPersistence) {
          try {
            const db = await _openKeystoreDB();
            if (db) {
              let testKey = await _getKeyFromIndexedDB();
              if (!testKey && store) {
                const webKey = await _getOrCreateWebCryptoKey(store);
                if (webKey) {
                  await _saveKeyToIndexedDB(webKey);
                  testKey = await _getKeyFromIndexedDB();
                }
              }
              if (testKey) idbOk = true;
            }
          } catch (_) {
            idbOk = false;
          }
        }
        if (!idbOk) {
          _degradedPersistence = true;
          throw new Error('IndexedDB keystore verification failed: non-extractable WebCrypto key cannot be verified in IndexedDB (fail-closed)');
        }
      }

      this.initialized = true;
      return this;
    }

    getDiagnostics() {
      const health = getSecretVaultHealth();
      return {
        ...health,
        encryptionCount: this._encryptionCount,
        maxEncryptionsPerKey: this._maxEncryptionsPerKey
      };
    }

    async encrypt(plaintext, aad) {
      if (this._encryptionCount >= this._maxEncryptionsPerKey) {
        throw new Error('NIST SP 800-38D encryption limit reached: key must be rotated after 1,000,000 encryptions');
      }
      this._encryptionCount++;
      _moduleEncryptionCount++;

      const store = _getStorage(this.storage);
      const iv = new Uint8Array(12);
      _fillSecureRandomBytes(iv);

      const plainBytes = (typeof plaintext === 'string')
        ? new TextEncoder().encode(plaintext)
        : (plaintext instanceof Uint8Array ? plaintext : new TextEncoder().encode(JSON.stringify(plaintext)));

      const aadStr = aad ? String(aad) : '';
      const aadBytes = _toAadBytes(aadStr);

      const nativeKs = _getNativeAndroidKeystore();
      if (nativeKs && typeof nativeKs.encrypt === 'function') {
        const plainStr = (typeof plaintext === 'string')
          ? plaintext
          : (plaintext instanceof Uint8Array ? new TextDecoder().decode(plaintext) : JSON.stringify(plaintext));
        const res = await nativeKs.encrypt({ data: plainStr, aad: aadStr });
        if (res && res.ciphertext && res.iv) {
          return {
            iv: res.iv,
            ciphertext: res.ciphertext,
            aad: aadStr,
            algorithm: 'AES-GCM-256',
            keySource: 'AndroidKeyStore'
          };
        }
      }

      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.createCipheriv === 'function') {
        const keyRaw = _initMemorySessionKey(store);
        const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyRaw, iv);
        if (aadBytes) cipher.setAAD(aadBytes);
        const enc = _concatUint8([cipher.update(plainBytes), cipher.final()]);
        const tag = cipher.getAuthTag();
        const combined = _concatUint8([enc, tag]);
        return {
          iv: _uint8ToHex(iv),
          ciphertext: _uint8ToHex(combined),
          tag: _uint8ToHex(tag),
          aad: aadStr,
          algorithm: 'AES-GCM-256'
        };
      }

      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && cryptoObj.subtle) {
        const key = await _getOrCreateWebCryptoKey(store);
        if (key) {
          const encParams = { name: 'AES-GCM', iv };
          if (aadBytes) encParams.additionalData = aadBytes;
          const ab = await cryptoObj.subtle.encrypt(encParams, key, plainBytes);
          return {
            iv: _uint8ToHex(iv),
            ciphertext: _uint8ToHex(new Uint8Array(ab)),
            aad: aadStr,
            algorithm: 'AES-GCM-256'
          };
        }
      }

      throw new Error('Encryption failed: crypto engine unavailable');
    }

    async decrypt(ciphertext, ivHex, aad) {
      const store = _getStorage(this.storage);
      const iv = _hexToUint8(ivHex);
      const combined = _hexToUint8(ciphertext);
      const aadBytes = _toAadBytes(aad);

      const nativeKs = _getNativeAndroidKeystore();
      if (nativeKs && typeof nativeKs.decrypt === 'function' && (this.hardwareBacked || !this.initialized)) {
        try {
          const res = await nativeKs.decrypt({ ciphertext, iv: ivHex, aad: aad ? String(aad) : '' });
          if (res && typeof res.data === 'string') {
            return res.data;
          }
          throw new Error('Native Keystore returned invalid data');
        } catch (err) {
          throw new Error('Hardware decryption failed: ' + (err.message || 'authentication failed'));
        }
      }

      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
        const keyRaw = _initMemorySessionKey(store);
        if (combined.length < 16) throw new Error('Invalid ciphertext length');
        const authTag = combined.subarray(combined.length - 16);
        const encData = combined.subarray(0, combined.length - 16);
        const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyRaw, iv);
        if (aadBytes) decipher.setAAD(aadBytes);
        decipher.setAuthTag(authTag);
        const plainBytes = _concatUint8([decipher.update(encData), decipher.final()]);
        return new TextDecoder().decode(plainBytes);
      }

      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && cryptoObj.subtle) {
        const key = await _getOrCreateWebCryptoKey(store);
        if (key) {
          const decParams = { name: 'AES-GCM', iv };
          if (aadBytes) decParams.additionalData = aadBytes;
          const ab = await cryptoObj.subtle.decrypt(decParams, key, combined);
          return new TextDecoder().decode(ab);
        }
      }

      throw new Error('Decryption failed: crypto engine unavailable');
    }

    read(storage) {
      return readSessionSecrets(storage || this.storage);
    }

    async readAsync(storage) {
      return await readSessionSecretsAsync(storage || this.storage);
    }

    write(secrets, storage) {
      if (this._encryptionCount >= this._maxEncryptionsPerKey) {
        throw new Error('NIST SP 800-38D encryption limit reached: key must be rotated after 1,000,000 encryptions');
      }
      this._encryptionCount++;
      return writeSessionSecrets(secrets, storage || this.storage);
    }

    async writeAsync(secrets, storage) {
      if (this._encryptionCount >= this._maxEncryptionsPerKey) {
        throw new Error('NIST SP 800-38D encryption limit reached: key must be rotated after 1,000,000 encryptions');
      }
      this._encryptionCount++;
      return await writeSessionSecretsAsync(secrets, storage || this.storage);
    }

    async exportEncryptedBackup(passphrase, options) {
      const data = this.read();
      return await exportEncryptedBackup(data, passphrase, options);
    }

    async importEncryptedBackup(backupData, passphrase) {
      return await importEncryptedBackup(backupData, passphrase);
    }

    getDiagnostics() {
      return getSecretVaultHealth(this.storage);
    }
  }

  SecretVault.exportEncryptedBackup = exportEncryptedBackup;
  SecretVault.importEncryptedBackup = importEncryptedBackup;
  SecretVault.getDiagnostics = getSecretVaultHealth;

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    SESSION_SECRETS_SCHEMA_VERSION,
    SESSION_SECRETS_KEY,
    LEGACY_SESSION_SECRETS_KEY,
    SESSION_KEY_STORAGE,
    SESSION_KEY_SYM,
    IDB_KEYSTORE_DB,
    IDB_KEYSTORE_STORE,
    IDB_KEYSTORE_KEY,
    API_KEY_NAMES,
    emptyApiKeys,
    isSafeConnectionId,
    readSessionSecrets,
    readSessionSecretsAsync,
    writeSessionSecrets,
    writeSessionSecretsAsync,
    queueSessionSecretsWrite,
    getSessionWriteState,
    getSessionWriteRevision,
    resetSessionWriteQueue,
    getSecretVaultHealth,
    getKeySecurityInfo,
    migrateKeyToStrongBox,
    commitKeyMigration,
    rollbackKeyMigration,
    isHardwareKeystoreAvailable,
    getKeystoreBackend,
    applySessionSecrets,
    applySessionSecretsAsync,
    exportEncryptedBackup,
    importEncryptedBackup,
    SecretVault,
    _derivePbkdf2Key,
    _initMemorySessionKey,
    _zeroizeBuffer,
    _extractSecretsInput,
    _nonCryptoCompatCodec,
    _syncTransform,
    _fillSecureRandomBytes,
    _uint8ToHex,
    _hexToUint8,
    _sha256,
    _sha256Pure,
    _getOrCreateWebCryptoKey,
    _getKeyFromIndexedDB,
    _saveKeyToIndexedDB,
    _clearKeyFromIndexedDB,
    _resetSessionCryptoState,
    _resetSessionMemoryCache: _resetSessionCryptoState,
    _concatUint8,
    _quarantineCorruptedPayload,
    _resolveSecretsStorageKey,
    get _getNodeCrypto() {
      return _hasCustomNodeCrypto ? _customNodeCrypto : _getNodeCrypto;
    },
    set _getNodeCrypto(fn) {
      if (fn === _getNodeCrypto) {
        _hasCustomNodeCrypto = false;
        _customNodeCrypto = null;
      } else {
        _hasCustomNodeCrypto = true;
        _customNodeCrypto = fn;
      }
    },
    _normalizeSecretsPayload
  };
});
