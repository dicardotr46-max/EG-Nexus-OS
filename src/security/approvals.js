/**
 * EG-Nexus-OS — Security Approvals & Confirmation Gates Module
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

  function getUiState() {
    if (typeof window !== 'undefined' && window.uiState) return window.uiState;
    if (typeof globalThis !== 'undefined' && globalThis.uiState) return globalThis.uiState;
    return { pendingApprovalQueue: [], _isResolvingApproval: false };
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
    triggerApprovalGate,
    resolveApprovalGate
  };
});
