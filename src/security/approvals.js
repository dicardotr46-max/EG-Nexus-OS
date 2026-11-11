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

  function triggerApprovalGate(reason, onApprove, onReject) {
    const ui = getUiState();
    if (!Array.isArray(ui.pendingApprovalQueue)) ui.pendingApprovalQueue = [];
    let item;
    if (typeof reason === 'object' && reason !== null && typeof reason.reason === 'string') {
      item = {
        reason: reason.reason,
        onApprove: reason.onApprove,
        onReject: reason.onReject
      };
    } else {
      item = { reason, onApprove, onReject };
    }
    ui.pendingApprovalQueue.push(item);
    const current = ui.pendingApprovalQueue[0];
    if (typeof document !== 'undefined') {
      const txtEl = document.getElementById('approvalGateText');
      if (txtEl && current) txtEl.innerText = current.reason;
      document.getElementById('approvalGateBanner')?.classList.remove('hidden');
    }
  }

  async function resolveApprovalGate(approved) {
    const ui = getUiState();
    if (ui._isResolvingApproval) return;
    ui._isResolvingApproval = true;

    try {
      if (!Array.isArray(ui.pendingApprovalQueue)) ui.pendingApprovalQueue = [];
      const item = ui.pendingApprovalQueue.shift();

      if (typeof document !== 'undefined') {
        if (ui.pendingApprovalQueue.length === 0) {
          document.getElementById('approvalGateBanner')?.classList.add('hidden');
        } else {
          const next = ui.pendingApprovalQueue[0];
          const txtEl = document.getElementById('approvalGateText');
          if (txtEl && next) txtEl.innerText = next.reason;
        }
      }

      if (approved && item && typeof item.onApprove === 'function') {
        const res = item.onApprove();
        if (res && typeof res.then === 'function') {
          await Promise.resolve(res);
        }
      } else if (!approved) {
        if (item && typeof item.onReject === 'function') {
          const res = item.onReject();
          if (res && typeof res.then === 'function') {
            await Promise.resolve(res);
          }
        }
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
          window.showToast('عملیات حساس توسط شما لغو شد 🛡️');
        }
      }
    } catch (err) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('Error in resolveApprovalGate:', err);
      }
    } finally {
      setTimeout(() => {
        ui._isResolvingApproval = false;
      }, 320);
    }
  }

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    getUiState,
    triggerApprovalGate,
    resolveApprovalGate
  };
});
