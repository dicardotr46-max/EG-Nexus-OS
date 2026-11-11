/**
 * EG-Nexus-OS — Core Sanitization Module
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
    target._nexusCoreSanitization = exports;
    target.NexusSanitization = exports;
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

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeSafeUrl(url, fallback = '#') {
    if (!url || typeof url !== 'string') return fallback;
    const cleaned = url.replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]+/g, '').trim();
    if (!cleaned || /^(?:javascript|data|vbscript|file|blob):/i.test(cleaned)) {
      return fallback;
    }
    return cleaned;
  }

  function escapeJsAttr(str) {
    return escapeHtml(
      String(str ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
    );
  }

  function normalizePersianText(rawStr) {
    return String(rawStr ?? '')
      .replace(/[\u064a\u0649\u06cc]/g, 'ی')
      .replace(/[\u0643\u06a9]/g, 'ک')
      .replace(/\u0640/g, '') // Remove Arabic Tatweel/Kashida
      .replace(/[\u200b\u200d\ufeff]/g, '')
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
  }

  function sanitizeHttpUrl(rawUrl) {
    const u = String(rawUrl || '').trim();
    if (!u || /[\s"'<>\\\r\n\t]/.test(u)) return '#';
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#';
      if (parsed.username || parsed.password) return '#';
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        if (parsed.hostname !== 'localhost') return '#';
      }
      return parsed.href;
    } catch (e) {
      return '#';
    }
  }

  function sanitizeUntrustedWebSnippet(rawSnippet) {
    let text = String(rawSnippet || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');

    let prev;
    do {
      prev = text;
      text = text.replace(/<\/?untrusted_web_data[^<>]*>/gi, '');
    } while (text !== prev);

    do {
      prev = text;
      text = text.replace(/<\/?untrusted_web_data[^>]*>/gi, '');
    } while (text !== prev);

    return text
      .replace(/\[\s*AUTO_(?:BRAIN|SKILL)\b/gi, '[BLOCKED_WEB_TAG')
      .replace(/\[\s*OPTIONS\s*:/gi, '[BLOCKED_WEB_OPTIONS:')
      .trim();
  }

  function splitStringByCodePoints(str, maxCodePoints = 3800) {
    const chars = Array.from(String(str ?? ''));
    if (chars.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < chars.length; i += maxCodePoints) {
      chunks.push(chars.slice(i, i + maxCodePoints).join(''));
    }
    return chunks;
  }

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    escapeHtml,
    sanitizeSafeUrl,
    escapeJsAttr,
    normalizePersianText,
    sanitizeHttpUrl,
    sanitizeUntrustedWebSnippet,
    splitStringByCodePoints
  };
});
