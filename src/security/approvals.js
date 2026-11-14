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

  const _approvalTokenMap = (typeof globalThis !== 'undefined' && globalThis.__nexusApprovalTokens)
    ? globalThis.__nexusApprovalTokens
    : new Map();
  if (typeof globalThis !== 'undefined') {
    globalThis.__nexusApprovalTokens = _approvalTokenMap;
  }

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

  function issueApprovalToken(spec = {}) {
    const { providerId, action, params, paramsHash, nonce } = spec;
    const token = 'appr_' + _generateTokenNonce() + '_' + Date.now().toString(36);
    const computedParamsHash = paramsHash || (params ? _hashParams(params) : '');
    const entry = {
      token,
      providerId: String(providerId || '').toLowerCase(),
      action: String(action || '').toLowerCase(),
      paramsHash: computedParamsHash,
      nonce: nonce || _generateTokenNonce(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000 // 60,000ms TTL
    };
    _approvalTokenMap.set(token, entry);
    return token;
  }

  function consumeApprovalToken(token, context = {}) {
    if (!token || typeof token !== 'string') return false;
    const entry = _approvalTokenMap.get(token);
    if (!entry) return false;

    // Atomic consumption: delete immediately upon first use to prevent Replay and Prompt Injection
    _approvalTokenMap.delete(token);

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

  function verifyApprovalToken(token) {
    if (!token || typeof token !== 'string') return false;
    const entry = _approvalTokenMap.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      _approvalTokenMap.delete(token);
      return false;
    }
    return true;
  }

  function clearApprovalTokens() {
    _approvalTokenMap.clear();
  }

  function triggerApprovalGate(reason, onApprove, onReject) {
    const ui = getUiState();
    if (!Array.isArray(ui.pendingApprovalQueue)) ui.pendingApprovalQueue = [];
    let item;
    const approvalId = (typeof secureRandomId === 'function'
      ? secureRandomId('appr')
      : ('appr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)));

    if (typeof reason === 'object' && reason !== null) {
      const reasonText = String(reason.reason || reason.text || reason.message || '');
      const actionName = String(reason.action || reason.target || reason.targetAction || '');
      const id = String(reason.id || approvalId);
      item = Object.freeze({
        ...reason,
        id,
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
        reason: reasonText,
        text: reasonText,
        action: '',
        target: '',
        targetAction: '',
        onApprove,
        onReject
      });
    }
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
        approvalToken = issueApprovalToken({
          providerId: item.providerId || item.id,
          action: item.action,
          params: item.params,
          paramsHash: item.paramsHash,
          nonce: item.nonce
        });
        try {
          if (item && !Object.isFrozen(item)) {
            item.approvalToken = approvalToken;
          }
        } catch (_) {}

        if (typeof item.onApprove === 'function') {
          const res = item.onApprove(approvalToken);
          if (res && typeof res.then === 'function') {
            executionPromise = res;
          }
        }
      } else if (!approved) {
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
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
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

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    getUiState,
    triggerApprovalGate,
    resolveApprovalGate,
    issueApprovalToken,
    consumeApprovalToken,
    verifyApprovalToken,
    clearApprovalTokens,
    canonicalizeJson,
    _hashParams,
    _generateTokenNonce,
    _sha256Pure
  };
});
