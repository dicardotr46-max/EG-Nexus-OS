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

  function _generateTokenNonce() {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function _hashParams(params) {
    if (!params) return '';
    try {
      const str = typeof params === 'string' ? params : JSON.stringify(params);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return 'h_' + (hash >>> 0).toString(16);
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
    clearApprovalTokens
  };
});
