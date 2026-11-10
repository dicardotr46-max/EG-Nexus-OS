/**
 * EG-Nexus-OS — Core Sanitization Module
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
    const trimmed = url.trim();
    if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
      return fallback;
    }
    return trimmed;
  }

  function escapeJsAttr(str) {
    return escapeHtml(
      String(str ?? '')
        .replace(/\\/g, '\\\\')
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
    return String(rawSnippet || '')
      .replace(/\[\s*AUTO_(?:BRAIN|SKILL)\b/gi, '[BLOCKED_WEB_TAG')
      .replace(/\[\s*OPTIONS\s*:/gi, '[BLOCKED_WEB_OPTIONS:')
      .replace(/<\/?untrusted_web_data[^>]*>/gi, '')
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
    escapeHtml,
    sanitizeSafeUrl,
    escapeJsAttr,
    normalizePersianText,
    sanitizeHttpUrl,
    sanitizeUntrustedWebSnippet,
    splitStringByCodePoints
  };
});
