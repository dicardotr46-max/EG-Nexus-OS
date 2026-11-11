/**
 * EG-Nexus-OS — Security Approvals & Confirmation Gates Module
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  const exports = factory();
  /* istanbul ignore else */
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = exports;
  }
  /* istanbul ignore next */
  function syncNexusCore(target) {
    if (!target) return;
    Object.assign(target, exports);
    target._nexusCoreApprovals = exports;
    target.NexusApprovals = exports;
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
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ this, function() {
  'use strict';

  const STORAGE_KEYS = Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
  const STORAGE_KEY = STORAGE_KEYS.current;

  const _fallbackUiState = { pendingApprovalQueue: [], _isResolvingApproval: false };

  function getUiState() {
    if (typeof window !== 'undefined' && window.uiState) return window.uiState;
    if (typeof globalThis !== 'undefined' && globalThis.uiState) return globalThis.uiState;
    return _fallbackUiState;
  }

  function triggerApprovalGate(reason, onApprove) {
    const ui = getUiState();
    if (!Array.isArray(ui.pendingApprovalQueue)) ui.pendingApprovalQueue = [];
    ui.pendingApprovalQueue.push({ reason, onApprove });
    const current = ui.pendingApprovalQueue[0];
    if (typeof document !== 'undefined') {
      const txtEl = document.getElementById('approvalGateText');
      if (txtEl && current) txtEl.innerText = current.reason;
      document.getElementById('approvalGateBanner')?.classList.remove('hidden');
    }
  }

  function resolveApprovalGate(approved) {
    const ui = getUiState();
    if (ui._isResolvingApproval) return;
    ui._isResolvingApproval = true;
    setTimeout(() => { ui._isResolvingApproval = false; }, 320);

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
      item.onApprove();
    } else if (!approved) {
      if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast('عملیات حساس توسط شما لغو شد 🛡️');
      }
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
