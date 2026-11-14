/**
 * EG-Nexus-OS — Security Approvals & Confirmation Gates Module
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  const exports = factory(root);
  /* istanbul ignore else */
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = exports;
  }
  /* istanbul ignore next */
  function syncNexusCore(target) {
    if (!target) return;
    target.NexusCore = target.NexusCore || {};
    Object.assign(target.NexusCore, exports);
    target._nexusCoreApprovals = exports;
    target.NexusApprovals = exports;
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
  /* istanbul ignore next */
  if (root) {
    syncNexusCore(root);
  }
  /* istanbul ignore next */
  if (typeof globalThis !== 'undefined') {
    syncNexusCore(globalThis);
  }
  /* istanbul ignore next */
  if (typeof window !== 'undefined') {
    syncNexusCore(window);
  }
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ this, function(target) {
  'use strict';

  const STORAGE_KEYS = (target && target.NexusCore && target.NexusCore.STORAGE_KEYS) ||
    (typeof window !== 'undefined' && window.NexusCore && window.NexusCore.STORAGE_KEYS) ||
    (typeof global !== 'undefined' && global.NexusCore && global.NexusCore.STORAGE_KEYS) ||
    (typeof globalThis !== 'undefined' && globalThis.NexusCore && globalThis.NexusCore.STORAGE_KEYS) ||
    Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
  const STORAGE_KEY = STORAGE_KEYS.current;

  const _fallbackUiState = { pendingApprovalQueue: [], _isResolvingApproval: false };

  function getUiState() {
    if (typeof window !== 'undefined' && window.uiState) return window.uiState;
    if (typeof globalThis !== 'undefined' && globalThis.uiState) return globalThis.uiState;
    return _fallbackUiState;
  }

  // Authoritative internal storage: private closure Map
  const _internalTokenStore = new Map();
  const _lifecycleAuditTrail = new Map();

  // Pure-JS SHA-256 for deterministic params hash in all environments
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

  function _generateTokenNonce() {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    try {
      if (typeof require === 'function') {
        const nodeCrypto = require('crypto');
        if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
          return nodeCrypto.randomBytes(16).toString('hex');
        }
      }
    } catch (_) {}
    throw new Error('CSPRNG_UNAVAILABLE');
  }

  function canonicalizeJson(val) {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return '[' + val.map(item => canonicalizeJson(item) || 'null').join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    const entries = [];
    for (const k of keys) {
      const v = val[k];
      if (v !== undefined && typeof v !== 'function' && typeof v !== 'symbol') {
        entries.push(JSON.stringify(k) + ':' + canonicalizeJson(v));
      }
    }
    return '{' + entries.join(',') + '}';
  }

  function _hashParams(params) {
    if (!params) return '';
    try {
      const canonical = typeof params === 'string' ? params : canonicalizeJson(params);
      try {
        if (typeof require === 'function') {
          const nodeCrypto = require('crypto');
          if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
            return nodeCrypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
          }
        }
      } catch (_) {}
      const bytes = (typeof TextEncoder !== 'undefined')
        ? new TextEncoder().encode(canonical)
        : Buffer.from(canonical, 'utf8');
      const hashBytes = _sha256Pure(bytes);
      return Array.from(hashBytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return '';
    }
  }

  function secureRandomHex(bytes = 6) {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(bytes);
        crypto.getRandomValues(arr);
        let s = '';
        for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0');
        return s;
      }
    } catch (_) {}
    /* istanbul ignore next */
    try {
      if (typeof require === 'function') {
        const nodeCrypto = require('crypto');
        if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
          return nodeCrypto.randomBytes(bytes).toString('hex');
        }
      }
    } catch (_) {}
    /* istanbul ignore next */
    return Date.now().toString(36).padEnd(bytes * 2, '0').slice(0, bytes * 2);
  }

  function secureRandomId(prefix = 'id') {
    const p = prefix ? String(prefix).trim() : 'id';
    return (p ? p + '_' : '') + Date.now().toString(36) + '_' + secureRandomHex(4);
  }

  function _getApprovalTokenStoreInternal() {
    return _internalTokenStore;
  }

  function issueApprovalTokenInternal(spec = {}) {
    const { providerId, action, params, paramsHash, nonce, requestId } = spec;
    const token = 'appr_' + _generateTokenNonce() + '_' + Date.now().toString(36);
    const computedParamsHash = paramsHash || (params ? _hashParams(params) : '');
    const entry = {
      token,
      requestId: requestId || null,
      providerId: String(providerId || '').toLowerCase(),
      action: String(action || '').toLowerCase(),
      paramsHash: computedParamsHash,
      nonce: nonce || _generateTokenNonce(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (typeof spec.ttlMs === 'number' ? spec.ttlMs : 60000)
    };
    _internalTokenStore.set(token, entry);
    return token;
  }

  function consumeApprovalTokenInternal(token, context = {}) {
    if (!token || typeof token !== 'string') return false;
    const entry = _internalTokenStore.get(token);
    if (!entry) return false;

    // Atomic consumption: delete immediately upon first use to prevent Replay and Prompt Injection
    _internalTokenStore.delete(token);

    if (Date.now() > entry.expiresAt) {
      return false; // Expired
    }

    if (context.providerId && entry.providerId && entry.providerId !== String(context.providerId).toLowerCase()) {
      return false;
    }
    if (context.action && entry.action && entry.action !== String(context.action).toLowerCase()) {
      return false;
    }
    if (context.paramsHash && entry.paramsHash && entry.paramsHash !== context.paramsHash) {
      return false;
    }
    if (context.params && entry.paramsHash) {
      const pHash = _hashParams(context.params);
      if (pHash && entry.paramsHash !== pHash) {
        return false;
      }
    }
    return true;
  }

  function verifyApprovalTokenInternal(token) {
    if (!token || typeof token !== 'string') return false;
    const entry = _internalTokenStore.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      _internalTokenStore.delete(token);
      return false;
    }
    return true;
  }

  function clearApprovalTokensInternal() {
    _internalTokenStore.clear();
  }

  function issueApprovalToken(spec = {}) {
    return issueApprovalTokenInternal(spec);
  }

  function consumeApprovalToken(token, context = {}) {
    return consumeApprovalTokenInternal(token, context);
  }

  function verifyApprovalToken(token) {
    return verifyApprovalTokenInternal(token);
  }

  function clearApprovalTokens() {
    clearApprovalTokensInternal();
  }

  // Pure-JS SHA-256 for deterministic hex strings in all environments
  function _sha256Hex(str) {
    if (str === null || str === undefined) return '';
    const input = String(str);
    try {
      if (typeof require === 'function') {
        const nodeCrypto = require('crypto');
        if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
          return nodeCrypto.createHash('sha256').update(input, 'utf8').digest('hex');
        }
      }
    } catch (_) {}
    /* istanbul ignore next */
    try {
      const bytes = (typeof TextEncoder !== 'undefined')
        ? new TextEncoder().encode(input)
        : Buffer.from(input, 'utf8');
      const hashBytes = _sha256Pure(bytes);
      return Array.from(hashBytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return '';
    }
  }

  // Deep-freeze helper to prevent audit trail mutation
  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const key of Object.getOwnPropertyNames(obj)) {
      const val = obj[key];
      if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
        deepFreeze(val);
      }
    }
    return obj;
  }

  // OWASP Agent Control Standard (ACS 2026) Request Lifecycle Tracking with Cryptographic Hash Chain
  const MAX_LIFECYCLE_ENTRIES = 500;

  function recordLifecycleEvent(requestId, state, data = {}) {
    if (!requestId || typeof requestId !== 'string') {
      requestId = String(requestId || secureRandomId('req'));
    }
    const normState = String(state || '').trim().toLowerCase();

    // Redact raw approvalToken and store short token fingerprint (first 16 hex chars)
    const sanitizedData = (data && typeof data === 'object') ? { ...data } : {};
    if ('approvalToken' in sanitizedData) {
      if (sanitizedData.approvalToken) {
        sanitizedData.tokenFingerprint = _sha256Hex(String(sanitizedData.approvalToken)).slice(0, 16);
      }
      delete sanitizedData.approvalToken;
    }

    let record = _lifecycleAuditTrail.get(requestId);
    if (!record) {
      if (_lifecycleAuditTrail.size >= MAX_LIFECYCLE_ENTRIES) {
        const oldestKey = _lifecycleAuditTrail.keys().next().value;
        _lifecycleAuditTrail.delete(oldestKey);
      }
      record = {
        requestId,
        state: normState,
        currentState: normState,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: []
      };
      _lifecycleAuditTrail.set(requestId, record);
    }

    // Cryptographic Hash Chain: prevHash -> entryHash
    const lastEntry = record.history.length > 0 ? record.history[record.history.length - 1] : null;
    const prevHash = lastEntry ? lastEntry.entryHash : 'GENESIS';
    const entryHash = _sha256Hex(prevHash + '|' + JSON.stringify(sanitizedData));

    const event = {
      state: normState,
      timestamp: Date.now(),
      metadata: sanitizedData,
      prevHash,
      entryHash
    };

    record.state = normState;
    record.currentState = normState;
    record.updatedAt = Date.now();
    record.history.push(event);

    return record;
  }

  function getRequestLifecycle(requestId) {
    if (!requestId || typeof requestId !== 'string') return null;
    const record = _lifecycleAuditTrail.get(requestId);
    if (!record) return null;
    const clone = JSON.parse(JSON.stringify(record));
    return deepFreeze(clone);
  }

  // Private One-Time Boot Link Between Approvals and Registry (Closure-Locked)
  const _BOOT_HOOK = typeof Symbol === 'function' && Symbol.for
    ? Symbol.for('__nexus_boot_verifier_hook__')
    : '__nexus_boot_verifier_hook__';

  function _linkWithRegistry() {
    const handler = function(token, context) {
      return consumeApprovalTokenInternal(token, context);
    };
    handler.consume = consumeApprovalTokenInternal;
    handler.verify = verifyApprovalTokenInternal;
    handler.clear = clearApprovalTokensInternal;
    handler.issue = issueApprovalTokenInternal;

    if (typeof globalThis !== 'undefined') {
      if (typeof globalThis[_BOOT_HOOK] === 'function') {
        try {
          globalThis[_BOOT_HOOK](handler);
        } catch (_) {}
      } else {
        try {
          Object.defineProperty(globalThis, _BOOT_HOOK, {
            value: handler,
            configurable: true,
            writable: true,
            enumerable: false
          });
        } catch (_) {
          globalThis[_BOOT_HOOK] = handler;
        }
      }
    }

    if (typeof require === 'function') {
      try {
        const reg = require('../providers/registry.js');
        if (reg && typeof reg._registerTokenVerifier === 'function') {
          reg._registerTokenVerifier(handler);
        }
      } catch (_) {}
    }
  }
  _linkWithRegistry();

  function triggerApprovalGate(reason, onApprove, onReject) {
    const ui = getUiState();
    if (!Array.isArray(ui.pendingApprovalQueue)) ui.pendingApprovalQueue = [];
    let item;
    const approvalId = secureRandomId('appr');

    if (typeof reason === 'object' && reason !== null) {
      const reasonText = String(reason.reason || reason.text || reason.message || '');
      const actionName = String(reason.action || reason.target || reason.targetAction || '');
      const id = String(reason.id || reason.requestId || approvalId);
      item = Object.freeze({
        ...reason,
        id,
        requestId: id,
        reason: reasonText,
        text: reasonText,
        action: actionName,
        target: actionName,
        targetAction: actionName,
        onApprove: reason.onApprove || onApprove,
        onReject: reason.onReject || onReject
      });
    } else {
      const reasonText = String(reason || '');
      item = Object.freeze({
        id: approvalId,
        requestId: approvalId,
        reason: reasonText,
        text: reasonText,
        action: '',
        target: '',
        targetAction: '',
        onApprove,
        onReject
      });
    }

    // OWASP ACS 2026: Request lifecycle transitions: 'queued' -> 'awaiting_approval'
    recordLifecycleEvent(item.id, 'queued', {
      action: item.action,
      providerId: item.providerId || item.id,
      reason: item.reason
    });
    recordLifecycleEvent(item.id, 'awaiting_approval', {
      action: item.action,
      providerId: item.providerId || item.id
    });

    ui.pendingApprovalQueue.push(item);
    const current = ui.pendingApprovalQueue[0];
    if (typeof document !== 'undefined') {
      const txtEl = document.getElementById('approvalGateText');
      if (txtEl && current) {
        let display = current.reason || current.text || '';
        if (current.action) {
          display += ` [${current.action}]`;
        }
        if (current.id && current.action) {
          display += ` (${current.id})`;
        }
        txtEl.innerText = display;
      }
      document.getElementById('approvalGateBanner')?.classList.remove('hidden');
    }
    return item;
  }

  async function resolveApprovalGate(approved, timeoutMs = 30000) {
    const ui = getUiState();
    if (ui._isResolvingApproval) return;
    ui._isResolvingApproval = true;

    if (!Array.isArray(ui.pendingApprovalQueue)) ui.pendingApprovalQueue = [];
    if (ui.pendingApprovalQueue.length === 0) {
      ui._isResolvingApproval = false;
      return;
    }

    const isOrchestratorBusy = () => Boolean(
      ui.isOrchestratorRunning ||
      (typeof window !== 'undefined' && window.uiState && window.uiState.isOrchestratorRunning)
    );

    // If approving and orchestrator is currently busy, do not drop the item; leave it at queue head
    if (approved && isOrchestratorBusy()) {
      ui._isResolvingApproval = false;
      return;
    }

    let item = null;
    try {
      item = ui.pendingApprovalQueue.shift();

      if (typeof document !== 'undefined') {
        if (ui.pendingApprovalQueue.length === 0) {
          document.getElementById('approvalGateBanner')?.classList.add('hidden');
        } else {
          const next = ui.pendingApprovalQueue[0];
          const txtEl = document.getElementById('approvalGateText');
          if (txtEl && next) {
            let display = next.reason || next.text || '';
            if (next.action) display += ` [${next.action}]`;
            if (next.id && next.action) display += ` (${next.id})`;
            txtEl.innerText = display;
          }
        }
      }

      let executionPromise = null;
      let approvalToken = null;
      if (approved && item) {
        // If orchestrator became busy just now, return item to queue head
        if (isOrchestratorBusy()) {
          ui.pendingApprovalQueue.unshift(item);
          if (typeof document !== 'undefined') {
            const txtEl = document.getElementById('approvalGateText');
            if (txtEl) {
              let display = item.reason || item.text || '';
              if (item.action) display += ` [${item.action}]`;
              if (item.id && item.action) display += ` (${item.id})`;
              txtEl.innerText = display;
            }
            document.getElementById('approvalGateBanner')?.classList.remove('hidden');
          }
          return;
        }

        // Issue One-Time Capability Approval Token (TTL: 60,000ms)
        approvalToken = issueApprovalTokenInternal({
          requestId: item.id || item.requestId,
          providerId: item.providerId || item.id,
          action: item.action,
          params: item.params,
          paramsHash: item.paramsHash,
          nonce: item.nonce,
          ttlMs: item.ttlMs
        });
        try {
          if (item && !Object.isFrozen(item)) {
            item.approvalToken = approvalToken;
          }
        } catch (_) {}

        // OWASP ACS 2026: State transition to 'approved'
        recordLifecycleEvent(item.id || item.requestId, 'approved', {
          approvalToken,
          action: item.action,
          providerId: item.providerId || item.id
        });

        if (typeof item.onApprove === 'function') {
          const res = item.onApprove(approvalToken);
          if (res && typeof res.then === 'function') {
            executionPromise = res;
          }
        }
      } else if (!approved) {
        // OWASP ACS 2026: State transition to 'rejected'
        recordLifecycleEvent(item ? (item.id || item.requestId) : 'unknown', 'rejected', {
          reason: 'User rejected approval gate',
          action: item ? item.action : '',
          providerId: item ? (item.providerId || item.id) : ''
        });

        if (item && typeof item.onReject === 'function') {
          const res = item.onReject();
          if (res && typeof res.then === 'function') {
            executionPromise = res;
          }
        }
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
          window.showToast('عملیات حساس توسط شما لغو شد 🛡️');
        }
      }

      if (executionPromise) {
        let timer = null;
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Approval gate execution timed out after ${timeoutMs}ms`));
          }, Math.max(100, Number(timeoutMs) || 30000));
          if (timer && typeof timer.unref === 'function') timer.unref();
        });
        try {
          await Promise.race([executionPromise, timeoutPromise]);
          if (approved && item) {
            // OWASP ACS 2026: State transition to 'executed'
            recordLifecycleEvent(item.id || item.requestId, 'executed', {
              action: item.action,
              providerId: item.providerId || item.id
            });
          }
        } catch (execErr) {
          if (item) {
            recordLifecycleEvent(item.id || item.requestId, 'rejected', {
              action: item.action,
              providerId: item.providerId || item.id,
              error: execErr?.message || String(execErr)
            });
          }
          throw execErr;
        } finally {
          if (timer) clearTimeout(timer);
        }
      } else if (approved && item) {
        // Synchronous onApprove completed
        recordLifecycleEvent(item.id || item.requestId, 'executed', {
          action: item.action,
          providerId: item.providerId || item.id
        });
      }

      if (approved && item) {
        return approvalToken;
      }
      return null;
    } catch (err) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('Error in resolveApprovalGate:', err);
      }
    } finally {
      if (ui.pendingApprovalQueue && ui.pendingApprovalQueue.length > 0) {
        ui._isResolvingApproval = false;
      } else {
        const cooldownTimer = setTimeout(() => {
          ui._isResolvingApproval = false;
        }, 320);
        if (cooldownTimer && typeof cooldownTimer.unref === 'function') {
          cooldownTimer.unref();
        }
      }
    }
  }

  // OpenTelemetry GenAI Semantic Conventions (v1.29.0-dev)
  const GEN_AI_SYSTEM = 'EG-Nexus-OS';
  const GEN_AI_OPERATIONS = Object.freeze({
    INVOKE_AGENT: 'invoke_agent',
    PLAN: 'plan',
    EXECUTE_TOOL: 'execute_tool'
  });
  const GEN_AI_ATTRIBUTES = Object.freeze({
    SYSTEM: 'gen_ai.system',
    REQUEST_MODEL: 'gen_ai.request.model',
    TOOL_NAME: 'gen_ai.tool.name',
    USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
    USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens'
  });

  class GenAISpan {
    constructor(operation, attributes = {}) {
      this.name = String(operation || 'gen_ai.operation');
      this.spanId = secureRandomHex(8);
      this.traceId = attributes.traceId || secureRandomHex(16);
      this.startTime = Date.now();
      this.endTime = null;
      this.durationMs = 0;
      this.status = { code: 'UNSET' };
      this.events = [];
      this.attributes = {
        'gen_ai.system': attributes['gen_ai.system'] || GEN_AI_SYSTEM,
        ...attributes
      };

      if (attributes['gen_ai.request.model'] !== undefined || attributes.model !== undefined) {
        this.attributes['gen_ai.request.model'] = String(attributes['gen_ai.request.model'] ?? attributes.model);
      }
      if (attributes['gen_ai.tool.name'] !== undefined || attributes.toolName !== undefined || attributes.tool !== undefined) {
        this.attributes['gen_ai.tool.name'] = String(attributes['gen_ai.tool.name'] ?? (attributes.toolName || attributes.tool));
      }
      if (attributes['gen_ai.usage.input_tokens'] !== undefined || attributes.inputTokens !== undefined) {
        this.attributes['gen_ai.usage.input_tokens'] = Number(attributes['gen_ai.usage.input_tokens'] ?? attributes.inputTokens) || 0;
      }
      if (attributes['gen_ai.usage.output_tokens'] !== undefined || attributes.outputTokens !== undefined) {
        this.attributes['gen_ai.usage.output_tokens'] = Number(attributes['gen_ai.usage.output_tokens'] ?? attributes.outputTokens) || 0;
      }
    }

    setAttribute(key, value) {
      this.attributes[key] = value;
      return this;
    }

    setAttributes(attrs) {
      if (attrs && typeof attrs === 'object') {
        for (const [k, v] of Object.entries(attrs)) {
          this.attributes[k] = v;
        }
      }
      return this;
    }

    addEvent(name, attributes = {}) {
      this.events.push({
        name: String(name),
        timestamp: Date.now(),
        attributes: { ...attributes }
      });
      return this;
    }

    setStatus(status, message) {
      if (typeof status === 'string') {
        this.status = { code: status.toUpperCase(), message };
      } else if (status && typeof status === 'object') {
        this.status = { code: String(status.code || 'UNSET').toUpperCase(), message: status.message || message };
      }
      return this;
    }

    end(endTime = Date.now()) {
      this.endTime = endTime;
      this.durationMs = Math.max(0, this.endTime - this.startTime);
      return this;
    }

    toJSON() {
      return {
        name: this.name,
        spanId: this.spanId,
        traceId: this.traceId,
        startTime: this.startTime,
        endTime: this.endTime,
        durationMs: this.durationMs,
        status: this.status,
        attributes: this.attributes,
        events: this.events
      };
    }
  }

  function createGenAISpan(operation, attributes = {}) {
    return new GenAISpan(operation, attributes);
  }

  const AUDIT_STORAGE_KEY = 'eg_nexus_os_lifecycle_audit_trail';

  function persistAuditTrail(storage) {
    const store = storage ||
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null) ||
      (typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null);
    const serialized = JSON.stringify(Array.from(_lifecycleAuditTrail.entries()));
    if (store) {
      try {
        if (typeof store.setItem === 'function') {
          store.setItem(AUDIT_STORAGE_KEY, serialized);
        } else if (store instanceof Map) {
          store.set(AUDIT_STORAGE_KEY, serialized);
        } else if (typeof store === 'object') {
          store[AUDIT_STORAGE_KEY] = serialized;
        }
      } catch (_) {}
    }
    return true;
  }

  function verifyAuditTrailIntegrity(storage, options = {}) {
    let raw = null;
    let entries = null;
    const store = storage ||
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null) ||
      (typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null);

    if (store) {
      try {
        if (typeof store.getItem === 'function') {
          raw = store.getItem(AUDIT_STORAGE_KEY);
        } else if (store instanceof Map) {
          raw = store.get(AUDIT_STORAGE_KEY);
        } else if (typeof store === 'object' && AUDIT_STORAGE_KEY in store) {
          raw = store[AUDIT_STORAGE_KEY];
        } else if (typeof store === 'string') {
          raw = store;
        } else if (Array.isArray(store)) {
          entries = store;
        }
      } catch (_) {}
    }

    if (raw && typeof raw === 'string') {
      try {
        entries = JSON.parse(raw);
      } catch (_) {
        return options.detailed ? { valid: false, error: 'MALFORMED_JSON' } : false;
      }
    }

    if (!entries) {
      entries = Array.from(_lifecycleAuditTrail.entries());
    }

    if (!Array.isArray(entries)) {
      return options.detailed ? { valid: false, error: 'INVALID_TRAIL_STRUCTURE' } : false;
    }

    let verifiedEntries = 0;
    for (const item of entries) {
      const record = Array.isArray(item) ? item[1] : item;
      if (!record || typeof record !== 'object') {
        return options.detailed ? { valid: false, error: 'INVALID_RECORD' } : false;
      }
      const history = record.history;
      if (!Array.isArray(history)) {
        return options.detailed ? { valid: false, error: 'INVALID_HISTORY' } : false;
      }

      let expectedPrevHash = 'GENESIS';
      for (let i = 0; i < history.length; i++) {
        const event = history[i];
        if (!event || typeof event !== 'object') {
          return options.detailed ? { valid: false, error: 'INVALID_EVENT' } : false;
        }

        // 1. Verify prevHash link
        if (event.prevHash !== expectedPrevHash) {
          return options.detailed ? {
            valid: false,
            error: 'HASH_CHAIN_BROKEN',
            requestId: record.requestId,
            index: i,
            expected: expectedPrevHash,
            actual: event.prevHash
          } : false;
        }

        // 2. Verify SHA-256 entryHash computation
        const metadata = (event.metadata && typeof event.metadata === 'object') ? event.metadata : {};
        const expectedEntryHash = _sha256Hex(event.prevHash + '|' + JSON.stringify(metadata));
        if (event.entryHash !== expectedEntryHash) {
          return options.detailed ? {
            valid: false,
            error: 'ENTRY_HASH_TAMPERED',
            requestId: record.requestId,
            index: i,
            expected: expectedEntryHash,
            actual: event.entryHash
          } : false;
        }

        expectedPrevHash = event.entryHash;
        verifiedEntries++;
      }
    }

    if (options.detailed) {
      return {
        valid: true,
        recordsCount: entries.length,
        verifiedEntries
      };
    }
    return true;
  }

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    getUiState,
    triggerApprovalGate,
    resolveApprovalGate,
    consumeApprovalToken,
    verifyApprovalToken,
    clearApprovalTokens,
    recordLifecycleEvent,
    getRequestLifecycle,
    canonicalizeJson,
    _hashParams,
    _generateTokenNonce,
    _sha256Pure,
    _sha256Hex,
    deepFreeze,
    secureRandomHex,
    secureRandomId,
    createGenAISpan,
    createSpan: createGenAISpan,
    GenAISpan,
    GEN_AI_SYSTEM,
    GEN_AI_OPERATIONS,
    GEN_AI_ATTRIBUTES,
    persistAuditTrail,
    verifyAuditTrailIntegrity
  };
});
