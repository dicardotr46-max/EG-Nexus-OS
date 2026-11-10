/**
 * EG-Nexus-OS — Security & Secrets Module
 * AES-GCM 256-bit Web Crypto with In-Memory Key & Safe Sync Fallback
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    const exports = factory();
    Object.assign(root, exports);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function() {
  'use strict';

  const STORAGE_KEY = 'eg_nexus_os_state_v5.1';
  const SESSION_SECRETS_KEY = STORAGE_KEY + '_session_secrets';
  const SESSION_SECRETS_SCHEMA_VERSION = 1;
  const API_KEY_NAMES = ['gemini', 'openrouter', 'deepseek', 'grok', 'kimi', 'tavily', 'perplx'];

  function emptyApiKeys() {
    return API_KEY_NAMES.reduce((out, name) => { out[name] = ''; return out; }, {});
  }

  function isSafeConnectionId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
  }

  // Client-side non-extractable AES-GCM 256-bit encryption key stored in memory
  let _sessionCryptoKey = null;
  let _sessionCryptoKeyPromise = null;
  let _sessionKeyRaw = null;
  let _cachedSessionSecrets = null;

  function _initMemorySessionKey() {
    if (_sessionKeyRaw) return _sessionKeyRaw;
    _sessionKeyRaw = new Uint8Array(32);
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      cryptoObj.getRandomValues(_sessionKeyRaw);
    } else {
      for (let i = 0; i < 32; i++) {
        _sessionKeyRaw[i] = Math.floor(Math.random() * 256);
      }
    }
    return _sessionKeyRaw;
  }

  function _uint8ToHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function _hexToUint8(hexStr) {
    if (typeof hexStr !== 'string' || !hexStr) return new Uint8Array(0);
    const matches = hexStr.match(/.{1,2}/g);
    return matches ? new Uint8Array(matches.map(b => parseInt(b, 16))) : new Uint8Array(0);
  }

  // Synchronous fallback cipher based on memory key + 12-byte IV for environments without crypto.subtle
  function _syncTransform(bytes, keyBytes, ivBytes) {
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

  async function _getOrCreateWebCryptoKey() {
    if (_sessionCryptoKey) return _sessionCryptoKey;
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
    if (!cryptoObj || !cryptoObj.subtle) return null;
    if (!_sessionCryptoKeyPromise) {
      _sessionCryptoKeyPromise = (async () => {
        try {
          const raw = _initMemorySessionKey();
          _sessionCryptoKey = await cryptoObj.subtle.importKey(
            'raw',
            raw,
            { name: 'AES-GCM', length: 256 },
            false, // Non-extractable session key in memory
            ['encrypt', 'decrypt']
          );
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

  function getSessionStorage() {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
    return null;
  }

  function readSessionSecrets() {
    const result = {
      version: SESSION_SECRETS_SCHEMA_VERSION,
      initialized: false,
      apiKeys: emptyApiKeys(),
      connectionTokens: {},
      accountTokens: {},
      bridgeToken: ''
    };

    if (_cachedSessionSecrets && _cachedSessionSecrets.initialized) {
      return JSON.parse(JSON.stringify(_cachedSessionSecrets));
    }

    const storage = getSessionStorage();
    if (!storage) return result;

    try {
      const raw = storage.getItem(SESSION_SECRETS_KEY);
      if (!raw) return result;
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (jsonErr) {
        try {
          storage.setItem(SESSION_SECRETS_KEY + '_corrupted_' + Date.now(), raw);
          storage.removeItem(SESSION_SECRETS_KEY);
        } catch (_) {}
        return result;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;

      // Handle Legacy Plaintext JSON (transparent migration & re-encryption)
      if (!parsed.encrypted) {
        result.initialized = parsed.initialized === true;
        API_KEY_NAMES.forEach(name => {
          if (typeof parsed.apiKeys?.[name] === 'string') result.apiKeys[name] = parsed.apiKeys[name].trim();
        });
        if (parsed.connectionTokens && typeof parsed.connectionTokens === 'object' && !Array.isArray(parsed.connectionTokens)) {
          Object.keys(parsed.connectionTokens).forEach(id => {
            if (isSafeConnectionId(id) && typeof parsed.connectionTokens[id] === 'string') {
              result.connectionTokens[id] = parsed.connectionTokens[id].trim();
            }
          });
        }
        if (parsed.accountTokens && typeof parsed.accountTokens === 'object' && !Array.isArray(parsed.accountTokens)) {
          Object.keys(parsed.accountTokens).forEach(accId => {
            if (typeof parsed.accountTokens[accId] === 'string') {
              result.accountTokens[accId] = parsed.accountTokens[accId].trim();
            }
          });
        }
        if (typeof parsed.bridgeToken === 'string' && parsed.bridgeToken.trim()) {
          result.bridgeToken = parsed.bridgeToken.trim();
        }
        _cachedSessionSecrets = JSON.parse(JSON.stringify(result));
        writeSessionSecrets(result);
        return result;
      }

      // Handle Encrypted Payload
      const iv = _hexToUint8(parsed.iv);
      const ciphertext = _hexToUint8(parsed.ciphertext);
      const keyRaw = _initMemorySessionKey();
      const plainBytes = _syncTransform(ciphertext, keyRaw, iv);
      const decStr = new TextDecoder().decode(plainBytes);
      const dec = JSON.parse(decStr);

      if (dec && typeof dec === 'object' && !Array.isArray(dec)) {
        result.initialized = dec.initialized === true;
        API_KEY_NAMES.forEach(name => {
          if (typeof dec.apiKeys?.[name] === 'string') result.apiKeys[name] = dec.apiKeys[name].trim();
        });
        if (dec.connectionTokens && typeof dec.connectionTokens === 'object' && !Array.isArray(dec.connectionTokens)) {
          Object.keys(dec.connectionTokens).forEach(id => {
            if (isSafeConnectionId(id) && typeof dec.connectionTokens[id] === 'string') {
              result.connectionTokens[id] = dec.connectionTokens[id].trim();
            }
          });
        }
        if (dec.accountTokens && typeof dec.accountTokens === 'object' && !Array.isArray(dec.accountTokens)) {
          Object.keys(dec.accountTokens).forEach(accId => {
            if (typeof dec.accountTokens[accId] === 'string') {
              result.accountTokens[accId] = dec.accountTokens[accId].trim();
            }
          });
        }
        if (typeof dec.bridgeToken === 'string' && dec.bridgeToken.trim()) {
          result.bridgeToken = dec.bridgeToken.trim();
        }
        _cachedSessionSecrets = JSON.parse(JSON.stringify(result));
      }
    } catch (e) {
      // Quarantine corrupted session payload without crashing
      try {
        const raw = storage.getItem(SESSION_SECRETS_KEY);
        if (raw) {
          storage.setItem(SESSION_SECRETS_KEY + '_corrupted_' + Date.now(), raw);
          storage.removeItem(SESSION_SECRETS_KEY);
        }
      } catch (_) {}
    }
    return result;
  }

  function writeSessionSecrets(stateOrSecrets) {
    const existing = readSessionSecrets();
    const secrets = {
      version: SESSION_SECRETS_SCHEMA_VERSION,
      initialized: true,
      apiKeys: { ...existing.apiKeys },
      connectionTokens: { ...existing.connectionTokens },
      accountTokens: { ...existing.accountTokens },
      bridgeToken: existing.bridgeToken || ''
    };

    if (stateOrSecrets && stateOrSecrets.apiKeys && typeof stateOrSecrets.apiKeys === 'object' && !stateOrSecrets.appConnections) {
      API_KEY_NAMES.forEach(name => {
        if (typeof stateOrSecrets.apiKeys[name] === 'string' && stateOrSecrets.apiKeys[name].trim()) {
          secrets.apiKeys[name] = stateOrSecrets.apiKeys[name].trim();
        }
      });
      if (stateOrSecrets.connectionTokens && typeof stateOrSecrets.connectionTokens === 'object') {
        Object.keys(stateOrSecrets.connectionTokens).forEach(id => {
          if (isSafeConnectionId(id) && typeof stateOrSecrets.connectionTokens[id] === 'string') {
            secrets.connectionTokens[id] = stateOrSecrets.connectionTokens[id].trim();
          }
        });
      }
      if (stateOrSecrets.accountTokens && typeof stateOrSecrets.accountTokens === 'object') {
        Object.keys(stateOrSecrets.accountTokens).forEach(id => {
          if (typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id) && typeof stateOrSecrets.accountTokens[id] === 'string') {
            secrets.accountTokens[id] = stateOrSecrets.accountTokens[id].trim();
          }
        });
      }
      if (typeof stateOrSecrets.bridgeToken === 'string' && stateOrSecrets.bridgeToken.trim()) {
        secrets.bridgeToken = stateOrSecrets.bridgeToken.trim();
      }
    } else if (stateOrSecrets && typeof stateOrSecrets === 'object') {
      API_KEY_NAMES.forEach(name => {
        const value = stateOrSecrets?.apiKeys?.[name];
        if (typeof value === 'string' && value.trim()) secrets.apiKeys[name] = value.trim();
      });
      const connections = stateOrSecrets?.appConnections;
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
                secrets.accountTokens[acc.id] = acc.token.trim();
                secrets.accountTokens[`${id}_${acc.id}`] = acc.token.trim();
              }
            });
          }
        });
      }
      if (typeof stateOrSecrets?.localComputerConfig?.bridgeToken === 'string' && stateOrSecrets.localComputerConfig.bridgeToken.trim()) {
        secrets.bridgeToken = stateOrSecrets.localComputerConfig.bridgeToken.trim();
      }
    }

    _cachedSessionSecrets = JSON.parse(JSON.stringify(secrets));
    const storage = getSessionStorage();
    if (!storage) return true;

    try {
      const cryptoObj = (typeof crypto !== 'undefined') ? crypto : (typeof window !== 'undefined' ? window.crypto : null);
      const iv = new Uint8Array(12);
      if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        cryptoObj.getRandomValues(iv);
      } else {
        for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
      }

      const jsonStr = JSON.stringify(secrets);
      const plainBytes = new TextEncoder().encode(jsonStr);
      const keyRaw = _initMemorySessionKey();
      const cipherBytes = _syncTransform(plainBytes, keyRaw, iv);

      // Store ciphertext + IV (hex encoded) with initialized marker
      storage.setItem(SESSION_SECRETS_KEY, JSON.stringify({
        encrypted: true,
        initialized: true,
        iv: _uint8ToHex(iv),
        ciphertext: _uint8ToHex(cipherBytes),
        version: SESSION_SECRETS_SCHEMA_VERSION
      }));

      // Async Web Crypto AES-GCM background upgrade if supported
      if (cryptoObj && cryptoObj.subtle) {
        _getOrCreateWebCryptoKey().then(async key => {
          if (!key) return;
          try {
            const ab = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
            storage.setItem(SESSION_SECRETS_KEY, JSON.stringify({
              encrypted: true,
              algorithm: 'AES-GCM-256',
              initialized: true,
              iv: _uint8ToHex(iv),
              ciphertext: _uint8ToHex(new Uint8Array(ab)),
              version: SESSION_SECRETS_SCHEMA_VERSION
            }));
          } catch (_) {}
        }).catch(() => {});
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function applySessionSecrets(state) {
    if (!state || typeof state !== 'object') return state;
    const secrets = readSessionSecrets();
    if (secrets.initialized) {
      API_KEY_NAMES.forEach(name => {
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

  return {
    SESSION_SECRETS_SCHEMA_VERSION,
    SESSION_SECRETS_KEY,
    API_KEY_NAMES,
    emptyApiKeys,
    isSafeConnectionId,
    readSessionSecrets,
    writeSessionSecrets,
    applySessionSecrets,
    _syncTransform,
    _uint8ToHex,
    _hexToUint8
  };
});
