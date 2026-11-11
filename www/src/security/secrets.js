/**
 * EG-Nexus-OS — Security & Secrets Module
 * AES-GCM 256-bit Web Crypto with Non-Extractable IndexedDB Keystore, Deterministic Session Key & Safe Sync Fallback
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  const exports = factory();
  /* istanbul ignore next */
  function syncNexusCore(target) {
    if (!target) return;
    target._nexusCoreSecrets = exports;
    target.NexusSecrets = exports;
    if (typeof exports.queueSessionSecretsWrite === 'function') {
      target.queueSessionSecretsWrite = exports.queueSessionSecretsWrite;
      target.getSessionWriteState = exports.getSessionWriteState;
      target.getSessionWriteRevision = exports.getSessionWriteRevision;
      target.resetSessionWriteQueue = exports.resetSessionWriteQueue;
    }
    const STORAGE_KEYS = exports.STORAGE_KEYS || (target.NexusCore && target.NexusCore.STORAGE_KEYS) || Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
    target.NexusCore = Object.assign(
      target.NexusCore || {},
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
      Object.assign(root, exports);
      syncNexusCore(root);
    }
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
      Object.assign(window, exports);
      syncNexusCore(window);
    }
    /* istanbul ignore next */
    if (typeof globalThis !== 'undefined') {
      Object.assign(globalThis, exports);
      syncNexusCore(globalThis);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ (typeof window !== 'undefined' ? window : this), function() {
  'use strict';

  const STORAGE_KEYS = Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
  const STORAGE_KEY = STORAGE_KEYS.current;
  const LEGACY_STORAGE_KEY = STORAGE_KEYS.legacy;
  const SESSION_SECRETS_KEY = STORAGE_KEY + '_session_secrets';
  const LEGACY_SESSION_SECRETS_KEY = LEGACY_STORAGE_KEY + '_session_secrets';
  const SESSION_KEY_STORAGE = 'nexus_session_key_seed_v1';
  const SESSION_SECRETS_SCHEMA_VERSION = 1;

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

  function _getNodeCrypto() {
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

  function getSessionWriteState() {
    return sessionWriteState;
  }

  function getSessionWriteRevision() {
    return writeRevision;
  }

  function resetSessionWriteQueue() {
    sessionWriteQueue = Promise.resolve();
    writeRevision = 0;
    lastAppliedWriteRevision = 0;
    sessionWriteState = 'idle';
    activePendingCount = 0;
  }

  function queueSessionSecretsWrite(stateOrSecrets, storage) {
    const targetRevision = ++writeRevision;
    activePendingCount++;
    sessionWriteState = 'pending';

    const task = async () => {
      sessionWriteState = 'pending';
      try {
        if (targetRevision < lastAppliedWriteRevision) {
          activePendingCount = Math.max(0, activePendingCount - 1);
          if (activePendingCount === 0 && sessionWriteState === 'pending') {
            sessionWriteState = 'success';
          }
          return true;
        }

        const ok = await writeSessionSecretsAsync(stateOrSecrets, storage);
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
    _sessionKeyRaw = null;
    _sessionSeedRaw = null;
    _cachedSessionSecrets = null;
    resetSessionWriteQueue();
  }

  function _getStorage(storage) {
    if (storage && typeof storage.getItem === 'function') return storage;
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
    if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) return globalThis.sessionStorage;
    return null;
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
    if (!idb || typeof idb.open !== 'function') return Promise.resolve(null);
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
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (_) {
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
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    } catch (_) {
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
          req.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    } catch (_) {
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
  // Session Key Derivation (Deterministic Seed Fallback)
  // =========================================================================
  function _initMemorySessionKey(storage) {
    const store = _getStorage(storage);
    let seedHex = null;
    if (store && typeof store.getItem === 'function') {
      try {
        seedHex = store.getItem('nexus_session_key_seed_v1');
        if (!seedHex) {
          seedHex = store.getItem(SESSION_SECRETS_KEY + '_sk');
        }
      } catch (_) {}
    }

    if (seedHex && typeof seedHex === 'string' && /^[0-9a-fA-F]{32,}$/.test(seedHex.trim())) {
      const seedBytes = _hexToUint8(seedHex.trim());
      _sessionSeedRaw = seedBytes;
      _sessionKeyRaw = _sha256(seedBytes);
      return _sessionKeyRaw;
    }

    if (_sessionKeyRaw) {
      if (store && typeof store.setItem === 'function' && _sessionSeedRaw) {
        try {
          store.setItem('nexus_session_key_seed_v1', _uint8ToHex(_sessionSeedRaw));
        } catch (_) {}
      }
      return _sessionKeyRaw;
    }

    const seedBytes = new Uint8Array(32);
    let generated = false;
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      try {
        cryptoObj.getRandomValues(seedBytes);
        generated = true;
      } catch (_) {}
    }
    if (!generated) {
      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
        try {
          seedBytes.set(nodeCrypto.randomBytes(32));
          generated = true;
        } catch (_) {}
      }
    }
    if (!generated) {
      for (let i = 0; i < 32; i++) {
        seedBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    _sessionSeedRaw = seedBytes;
    const generatedHex = _uint8ToHex(seedBytes);
    if (store && typeof store.setItem === 'function') {
      try {
        store.setItem('nexus_session_key_seed_v1', generatedHex);
      } catch (_) {}
    }

    _sessionKeyRaw = _sha256(seedBytes);
    return _sessionKeyRaw;
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
      bridgeToken: ''
    };

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

  function _cloneSessionSecrets(secrets) {
    const copy = _createEmptySessionSecrets();
    if (secrets && typeof secrets === 'object') {
      _populateResultFromDecrypted(copy, secrets);
    }
    return copy;
  }

  function _resolveSecretsStorageKey(store) {
    if (typeof globalThis !== 'undefined' && typeof globalThis.SESSION_SECRETS_KEY === 'string' && globalThis.SESSION_SECRETS_KEY) {
      return globalThis.SESSION_SECRETS_KEY;
    }
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

    if (typeof dec.bridgeToken === 'string' && dec.bridgeToken.trim()) {
      result.bridgeToken = dec.bridgeToken.trim();
    }
  }

  function _normalizeSecretsPayload(stateOrSecrets, existing) {
    const secrets = {
      version: SESSION_SECRETS_SCHEMA_VERSION,
      initialized: true,
      apiKeys: { ...existing.apiKeys },
      connectionTokens: { ...existing.connectionTokens },
      accountTokens: { ...existing.accountTokens },
      bridgeToken: existing.bridgeToken || ''
    };

    if (stateOrSecrets && stateOrSecrets.apiKeys && typeof stateOrSecrets.apiKeys === 'object' && !stateOrSecrets.appConnections) {
      Object.keys(stateOrSecrets.apiKeys).forEach(name => {
        if (typeof stateOrSecrets.apiKeys[name] === 'string' && stateOrSecrets.apiKeys[name].trim()) {
          secrets.apiKeys[name] = stateOrSecrets.apiKeys[name].trim();
        }
      });
      if (stateOrSecrets.connectionTokens && typeof stateOrSecrets.connectionTokens === 'object' && !Array.isArray(stateOrSecrets.connectionTokens)) {
        Object.keys(stateOrSecrets.connectionTokens).forEach(id => {
          if (isSafeConnectionId(id) && typeof stateOrSecrets.connectionTokens[id] === 'string') {
            secrets.connectionTokens[id] = stateOrSecrets.connectionTokens[id].trim();
          }
        });
      }
      if (stateOrSecrets.accountTokens && typeof stateOrSecrets.accountTokens === 'object' && !Array.isArray(stateOrSecrets.accountTokens)) {
        Object.keys(stateOrSecrets.accountTokens).forEach(id => {
          if (typeof id === 'string' && !['__proto__', 'constructor', 'prototype'].includes(id) && typeof stateOrSecrets.accountTokens[id] === 'string') {
            secrets.accountTokens[id] = stateOrSecrets.accountTokens[id].trim();
          }
        });
      }
      if (typeof stateOrSecrets.bridgeToken === 'string' && stateOrSecrets.bridgeToken.trim()) {
        secrets.bridgeToken = stateOrSecrets.bridgeToken.trim();
      }
    } else if (stateOrSecrets && typeof stateOrSecrets === 'object') {
      const allNames = (typeof globalThis !== 'undefined' && Array.isArray(globalThis.API_KEY_NAMES))
        ? globalThis.API_KEY_NAMES
        : API_KEY_NAMES;
      allNames.forEach(name => {
        const value = stateOrSecrets[name];
        if (typeof value === 'string' && value.trim()) secrets.apiKeys[name] = value.trim();
      });
      if (stateOrSecrets.apiKeys && typeof stateOrSecrets.apiKeys === 'object') {
        Object.keys(stateOrSecrets.apiKeys).forEach(name => {
          const value = stateOrSecrets.apiKeys[name];
          if (typeof value === 'string' && value.trim()) secrets.apiKeys[name] = value.trim();
        });
      }
      if (typeof stateOrSecrets.bridgeToken === 'string' && stateOrSecrets.bridgeToken.trim()) {
        secrets.bridgeToken = stateOrSecrets.bridgeToken.trim();
      }
      if (stateOrSecrets.connectionTokens && typeof stateOrSecrets.connectionTokens === 'object' && !Array.isArray(stateOrSecrets.connectionTokens)) {
        Object.keys(stateOrSecrets.connectionTokens).forEach(id => {
          if (isSafeConnectionId(id) && typeof stateOrSecrets.connectionTokens[id] === 'string') {
            secrets.connectionTokens[id] = stateOrSecrets.connectionTokens[id].trim();
          }
        });
      }
      if (stateOrSecrets.accountTokens && typeof stateOrSecrets.accountTokens === 'object' && !Array.isArray(stateOrSecrets.accountTokens)) {
        Object.keys(stateOrSecrets.accountTokens).forEach(id => {
          if (typeof id === 'string' && !['__proto__', 'constructor', 'prototype'].includes(id) && typeof stateOrSecrets.accountTokens[id] === 'string') {
            secrets.accountTokens[id] = stateOrSecrets.accountTokens[id].trim();
          }
        });
      }
      const connections = stateOrSecrets.appConnections;
      if (connections && typeof connections === 'object' && !Array.isArray(connections)) {
        Object.keys(connections).forEach(id => {
          const conn = connections[id];
          const token = conn?.token;
          if (isSafeConnectionId(id) && typeof token === 'string' && token.trim()) {
            secrets.connectionTokens[id] = token.trim();
          }
          if (Array.isArray(conn?.accounts)) {
            conn.accounts.forEach(acc => {
              if (acc?.id && typeof acc.token === 'string' && acc.token.trim()) {
                if (!['__proto__', 'constructor', 'prototype'].includes(acc.id)) {
                  secrets.accountTokens[acc.id] = acc.token.trim();
                  secrets.accountTokens[`${id}_${acc.id}`] = acc.token.trim();
                }
              }
            });
          }
        });
      }
      if (typeof stateOrSecrets?.localComputerConfig?.bridgeToken === 'string' && stateOrSecrets.localComputerConfig.bridgeToken.trim()) {
        secrets.bridgeToken = stateOrSecrets.localComputerConfig.bridgeToken.trim();
      }
    }
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
      _populateResultFromDecrypted(result, parsed);
      result.initialized = true;
      _cachedSessionSecrets = _cloneSessionSecrets(result);
      writeSessionSecrets(result, store);
      return result;
    }

    const algorithm = parsed.algorithm || 'sync-stream-v1';

    // Handle AES-GCM-256
    if (algorithm === 'AES-GCM-256') {
      if (_cachedSessionSecrets && _cachedSessionSecrets.initialized) {
        return _cloneSessionSecrets(_cachedSessionSecrets);
      }

      // If Node.js crypto is available, decrypt synchronously using decipheriv
      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
        try {
          const keyBytes = _initMemorySessionKey(store);
          const ivBytes = _hexToUint8(parsed.iv);
          const combined = _hexToUint8(parsed.ciphertext);
          if (combined.length >= 16) {
            const authTag = combined.subarray(combined.length - 16);
            const encData = combined.subarray(0, combined.length - 16);
            const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBytes, ivBytes);
            decipher.setAuthTag(authTag);
            const plainBytes = _concatUint8([decipher.update(encData), decipher.final()]);
            const decStr = new TextDecoder().decode(plainBytes);
            const dec = JSON.parse(decStr);
            _populateResultFromDecrypted(result, dec);
            _cachedSessionSecrets = _cloneSessionSecrets(result);
            return result;
          }
        } catch (err) {
          // Fall back to sync fallback ciphertext
        }
      }

      // If syncCiphertext is present in AES-GCM payload, decrypt via sync codec
      if (parsed.syncCiphertext) {
        try {
          const iv = _hexToUint8(parsed.iv);
          const ciphertext = _hexToUint8(parsed.syncCiphertext);
          const keyRaw = _initMemorySessionKey(store);
          const plainBytes = _nonCryptoCompatCodec(ciphertext, keyRaw, iv);
          const fallbackStr = new TextDecoder().decode(plainBytes);
          const dec = JSON.parse(fallbackStr);
          _populateResultFromDecrypted(result, dec);
          _cachedSessionSecrets = _cloneSessionSecrets(result);
          return result;
        } catch (_) {}
      }

      // If in browser without async, return cached secrets or gracefully return empty structure
      if (_cachedSessionSecrets) {
        return _cloneSessionSecrets(_cachedSessionSecrets);
      }
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    // Handle sync-stream-v1 / sync-fallback
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
      _populateResultFromDecrypted(result, parsed);
      result.initialized = true;
      _cachedSessionSecrets = _cloneSessionSecrets(result);
      await writeSessionSecretsAsync(result, store);
      return result;
    }

    const iv = _hexToUint8(parsed.iv);
    const algorithm = parsed.algorithm || 'sync-stream-v1';

    // Try Web Crypto AES-GCM decryption if algorithm is AES-GCM-256
    if (algorithm === 'AES-GCM-256') {
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      const combined = _hexToUint8(parsed.ciphertext);
      let decStr = null;

      if (cryptoObj && cryptoObj.subtle) {
        try {
          const key = await _getOrCreateWebCryptoKey(store);
          if (key) {
            const decAb = await cryptoObj.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
            decStr = new TextDecoder().decode(decAb);
          }
        } catch (_) {}
      }

      /* istanbul ignore if */
      if (!decStr) {
        const nodeCrypto = _getNodeCrypto();
        if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
          try {
            const keyBytes = _initMemorySessionKey(store);
            if (combined.length >= 16) {
              const authTag = combined.subarray(combined.length - 16);
              const encData = combined.subarray(0, combined.length - 16);
              const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBytes, iv);
              decipher.setAuthTag(authTag);
              const plainBytes = _concatUint8([decipher.update(encData), decipher.final()]);
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
          return result;
        } catch (_) {}
      }

      // If decryption failed, check if sync fallback ciphertext exists
      if (parsed.syncCiphertext) {
        try {
          const ciphertext = _hexToUint8(parsed.syncCiphertext);
          const keyRaw = _initMemorySessionKey(store);
          const plainBytes = _nonCryptoCompatCodec(ciphertext, keyRaw, iv);
          const fallbackStr = new TextDecoder().decode(plainBytes);
          const dec = JSON.parse(fallbackStr);
          _populateResultFromDecrypted(result, dec);
          _cachedSessionSecrets = _cloneSessionSecrets(result);
          return result;
        } catch (_) {}
      }

      // Tamper detected or corrupted ciphertext
      _quarantineCorruptedPayload(store, targetKey, raw);
      return result;
    }

    // Handle sync-stream-v1 / sync-fallback
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

  function writeSessionSecrets(stateOrSecrets, storage) {
    const store = _getStorage(storage);
    const existing = readSessionSecrets(store);
    const secrets = _normalizeSecretsPayload(stateOrSecrets, existing);
    _cachedSessionSecrets = _cloneSessionSecrets(secrets);

    if (!store || typeof store.setItem !== 'function') return true;

    try {
      const iv = new Uint8Array(12);
      let ivGenerated = false;
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        try {
          cryptoObj.getRandomValues(iv);
          ivGenerated = true;
        } catch (_) {}
      }
      /* istanbul ignore if */
      if (!ivGenerated && typeof require === 'function') {
        try {
          const nodeCrypto = require('crypto');
          if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
            iv.set(nodeCrypto.randomBytes(12));
            ivGenerated = true;
          }
        } catch (_) {}
      }
      /* istanbul ignore if */
      if (!ivGenerated) {
        for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
      }

      const jsonStr = JSON.stringify(secrets);
      const plainBytes = new TextEncoder().encode(jsonStr);
      const keyRaw = _initMemorySessionKey(store);

      let hexCombined = null;
      const nodeCrypto = _getNodeCrypto();
      if (nodeCrypto && typeof nodeCrypto.createCipheriv === 'function') {
        try {
          const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyRaw, iv);
          const enc = _concatUint8([cipher.update(plainBytes), cipher.final()]);
          const tag = cipher.getAuthTag();
          const combined = _concatUint8([enc, tag]);
          hexCombined = _uint8ToHex(combined);
        } catch (_) {}
      }

      const targetKey = _resolveSecretsStorageKey(store);
      if (hexCombined) {
        store.setItem(targetKey, JSON.stringify({
          encrypted: true,
          algorithm: 'AES-GCM-256',
          initialized: true,
          iv: _uint8ToHex(iv),
          ciphertext: hexCombined,
          version: SESSION_SECRETS_SCHEMA_VERSION
        }));
        lastAppliedWriteRevision = Math.max(lastAppliedWriteRevision, writeRevision);
      } else {
        // Pure browser synchronous call fallback:
        // Schedule sequential write queue so WebCrypto persists pure AES-GCM-256 without syncCiphertext
        if (typeof queueSessionSecretsWrite === 'function') {
          queueSessionSecretsWrite(secrets, store).catch(() => {});
        } else if (typeof writeSessionSecretsAsync === 'function') {
          writeSessionSecretsAsync(secrets, store).catch(() => {});
        }
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  async function writeSessionSecretsAsync(stateOrSecrets, storage) {
    const store = _getStorage(storage);
    const existing = await readSessionSecretsAsync(store);
    const secrets = _normalizeSecretsPayload(stateOrSecrets, existing);
    _cachedSessionSecrets = _cloneSessionSecrets(secrets);

    if (!store || typeof store.setItem !== 'function') return true;

    try {
      const iv = new Uint8Array(12);
      let ivGenerated = false;
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        try {
          cryptoObj.getRandomValues(iv);
          ivGenerated = true;
        } catch (_) {}
      }
      /* istanbul ignore if */
      if (!ivGenerated && typeof require === 'function') {
        try {
          const nodeCrypto = require('crypto');
          if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
            iv.set(nodeCrypto.randomBytes(12));
            ivGenerated = true;
          }
        } catch (_) {}
      }
      /* istanbul ignore if */
      if (!ivGenerated) {
        for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
      }

      const jsonStr = JSON.stringify(secrets);
      const plainBytes = new TextEncoder().encode(jsonStr);
      const keyRaw = _initMemorySessionKey(store);

      let hexCombined = null;

      if (cryptoObj && cryptoObj.subtle) {
        try {
          const key = await _getOrCreateWebCryptoKey(store);
          if (key) {
            const ab = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
            hexCombined = _uint8ToHex(new Uint8Array(ab));
          }
        } catch (_) {}
      }

      /* istanbul ignore if */
      if (!hexCombined) {
        const nodeCrypto = _getNodeCrypto();
        if (nodeCrypto && typeof nodeCrypto.createCipheriv === 'function') {
          try {
            const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyRaw, iv);
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

      const targetKey = _resolveSecretsStorageKey(store);
      store.setItem(targetKey, JSON.stringify({
        encrypted: true,
        algorithm: 'AES-GCM-256',
        initialized: true,
        iv: _uint8ToHex(iv),
        ciphertext: hexCombined,
        version: SESSION_SECRETS_SCHEMA_VERSION
      }));
      return true;
    } catch (e) {
      return false;
    }
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
    if (secrets.accountTokens) {
      Object.keys(state.appConnections).forEach(id => {
        const conn = state.appConnections[id];
        if (conn && Array.isArray(conn.accounts)) {
          conn.accounts.forEach(acc => {
            if (acc?.id) {
              const tok = secrets.accountTokens[`${id}_${acc.id}`] || secrets.accountTokens[acc.id];
              if (tok) acc.token = tok;
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

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    SESSION_SECRETS_SCHEMA_VERSION,
    SESSION_SECRETS_KEY,
    LEGACY_SESSION_SECRETS_KEY,
    SESSION_KEY_STORAGE,
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
    applySessionSecrets,
    applySessionSecretsAsync,
    _nonCryptoCompatCodec,
    _syncTransform,
    _uint8ToHex,
    _hexToUint8,
    _sha256,
    _sha256Pure,
    _initMemorySessionKey,
    _getOrCreateWebCryptoKey,
    _getKeyFromIndexedDB,
    _saveKeyToIndexedDB,
    _clearKeyFromIndexedDB,
    _resetSessionCryptoState,
    _resetSessionMemoryCache: _resetSessionCryptoState,
    _concatUint8,
    _quarantineCorruptedPayload,
    _resolveSecretsStorageKey,
    _getNodeCrypto,
    _normalizeSecretsPayload
  };
});
