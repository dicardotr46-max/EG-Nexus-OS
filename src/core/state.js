/**
 * EG-Nexus-OS — Core Application State Module
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
    target._nexusCoreState = exports;
    target.NexusState = exports;
    const STORAGE_KEYS = exports.STORAGE_KEYS || (target.NexusCore && target.NexusCore.STORAGE_KEYS) || Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
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
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ this, function() {
  'use strict';

  const STORAGE_KEYS = Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
  const STORAGE_KEY = STORAGE_KEYS.current;
  const LEGACY_STORAGE_KEY = STORAGE_KEYS.legacy;

  const DEFAULT_WORKOUT_STUDIO_TEMPLATE = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 24px; }
  .card { background: #1e293b; border-radius: 18px; padding: 20px; max-width: 340px; margin: 0 auto; border: 1px solid #334155; }
  button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; cursor: pointer; margin-top: 12px; }
</style>
</head>
<body>
  <div class="card">
    <h2>🏋️‍♂️ پیش‌نمایش زنده اپ ورزشی</h2>
    <p id="repCounter">تعداد تکرار حرکت اسکوات: 0</p>
    <button onclick="countRep()">+ ثبت تکرار سالم (60FPS)</button>
  </div>
  <script>
    let reps = 0;
    function countRep() {
      reps++;
      document.getElementById('repCounter').innerText = 'تعداد تکرار حرکت اسکوات: ' + reps;
    }
  </script>
</body>
</html>`;

  function createInitialAppState() {
    return {
      profileName: 'Ali',
      dreamMemory: 'علاقه‌مند به توسعه اپلیکیشن ورزشی اندروید با فریم‌ریت ۶۰fps و تولید محتوای حرفه‌ای کلش رویال (Electro Giant) برای ۵ پلتفرم.',
      effortMode: 'standard', // light | standard | high | ultra
      diffOnlyMode: true,
      maxGroupTurns: 3,
      totalTokensUsed: 0,
      totalEstimatedCostUSD: 0,
      apiKeys: {
        gemini: '',
        deepseek: '',
        kimi: '',
        grok: '',
        openrouter: '',
        tavily: '',
        perplx: ''
      },
      agentsCatalog: [],
      chats: [],
      activeChatId: null,
      activeAgentProfileId: null,
      addedAppIds: [],
      appConnections: {},
      skills: [
        {
          id: 'sk_workout_60fps',
          title: '🏋️ استاندارد ممیزی ۶۰ فریم حرکات ورزشی اندروید',
          source: 'System Built-in',
          desc: 'بررسی زوایای مفصل (اسکوات، شنا، لانج، فیس‌پول)، رندر SVG برداری بدون افت فریم در WebView و جداسازی منطق تایمر.'
        },
        {
          id: 'sk_clash_viral',
          title: '👑 فرمول شورتس وایرال کلش رویال (۵ پلتفرم)',
          source: 'System Built-in',
          desc: 'هوک ۳ ثانیه‌ای، زوم روی لحظه ضدحمله الکترو جاینت، زیرنویس کلمه‌به‌کلمه و پایان لوپ برای YouTube Shorts و TikTok.'
        }
      ],
      brainNodes: [],
      routines: [],
      studioCode: DEFAULT_WORKOUT_STUDIO_TEMPLATE,
      browserConfig: {
        mode: 'hybrid_operator',
        allowedDomains: '',
        blockedDomains: ''
      },
      localComputerConfig: {
        bridgeUrl: 'http://127.0.0.1:8765',
        bridgeToken: '',
        connected: false,
        allowedFolders: '/sdcard/Download/NexusProjects',
        lastTerminalOutput: ''
      },
      cloudConfig: {
        workerUrl: '',
        workerSecret: '',
        supabaseUrl: '',
        supabaseKey: '',
        supabaseAuthToken: '',
        workspaceId: 'default',
        stateRevision: 1,
        deletedRoutineIds: [],
        deletedRoutineMeta: {},
        lastSyncAt: ''
      },
      telegramConfig: {
        botToken: '',
        adminChatId: '',
        syncEnabled: false
      }
    };
  }

  function createInitialUiState() {
    return {
      avatarPickerState: {
        mode: 'create',
        color: '#1d8cf8',
        shape: 'roundedSquare',
        face: 'wink'
      },
      pendingAttachment: null,
      stopOrchestrationFlag: false,
      pendingApprovalCallback: null,
      pendingApprovalQueue: [],
      _isResolvingApproval: false,
      activeAppsViewMode: 'catalog',
      activeAppsCategory: 'All',
      lastStudioErrorText: '',
      isOrchestratorRunning: false,
      activeAbortController: null,
      activeThinkingAgent: null,
      activeViewHistoryStack: ['view-home']
    };
  }

  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
  const _proxyCache = new WeakMap();
  const _rawTargetMap = new WeakMap();

  function hasDangerousKeysDeep(val, seen = new WeakSet()) {
    if (!val || typeof val !== 'object') return false;
    if (seen.has(val)) return false;
    seen.add(val);

    const ownProps = Object.getOwnPropertyNames(val);
    for (let i = 0; i < ownProps.length; i++) {
      const k = ownProps[i];
      if (DANGEROUS_KEYS.has(k)) return true;
      try {
        const child = val[k];
        if (child && typeof child === 'object' && hasDangerousKeysDeep(child, seen)) {
          return true;
        }
      } catch (_) {}
    }

    const ownSymbols = Object.getOwnPropertySymbols(val);
    for (let i = 0; i < ownSymbols.length; i++) {
      const sym = ownSymbols[i];
      const desc = sym.description || (typeof sym.toString === 'function' ? sym.toString().slice(7, -1) : '');
      if (DANGEROUS_KEYS.has(sym) || (desc && DANGEROUS_KEYS.has(desc))) return true;
      try {
        const child = val[sym];
        if (child && typeof child === 'object' && hasDangerousKeysDeep(child, seen)) {
          return true;
        }
      } catch (_) {}
    }

    return false;
  }

  function secureRandomHex(bytes = 6) {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const arr = new Uint8Array(bytes);
        crypto.getRandomValues(arr);
        let s = '';
        for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0');
        return s;
      }
    } catch (_) {}
    try {
      const nodeCrypto = (typeof require === 'function') ? require('crypto') : null;
      if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
        return nodeCrypto.randomBytes(bytes).toString('hex');
      }
    } catch (_) {}
    return Date.now().toString(36).padEnd(bytes * 2, '0').slice(0, bytes * 2);
  }

  function secureRandomId(prefix = 'id') {
    const p = prefix ? String(prefix).trim() : 'id';
    return (p ? p + '_' : '') + Date.now().toString(36) + '_' + secureRandomHex(4);
  }

  function createProtectedStateProxy(target) {
    if (!target || typeof target !== 'object') {
      return target;
    }
    if (_proxyCache.has(target)) {
      return _proxyCache.get(target);
    }

    const handler = {
      get(obj, prop, receiver) {
        if (prop === '_isStateProxy') return true;
        const val = Reflect.get(obj, prop, receiver);
        const desc = Object.getOwnPropertyDescriptor(obj, prop);
        if (desc && !desc.configurable && !desc.writable) {
          return val;
        }
        if (val && typeof val === 'object') {
          return createProtectedStateProxy(val);
        }
        return val;
      },
      set(obj, prop, value, receiver) {
        if (typeof prop === 'string' && DANGEROUS_KEYS.has(prop)) {
          return true;
        }
        if (value && typeof value === 'object' && hasDangerousKeysDeep(value)) {
          return true;
        }
        obj[prop] = value;
        return true;
      },
      defineProperty(obj, prop, descriptor) {
        if (typeof prop === 'string' && DANGEROUS_KEYS.has(prop)) {
          return true;
        }
        if (descriptor && typeof descriptor === 'object') {
          if (descriptor.value && typeof descriptor.value === 'object' && hasDangerousKeysDeep(descriptor.value)) {
            return true;
          }
        }
        try {
          return Reflect.defineProperty(obj, prop, descriptor);
        } catch (_) {
          return true;
        }
      },
      deleteProperty(obj, prop) {
        if (typeof prop === 'string' && DANGEROUS_KEYS.has(prop)) {
          return true;
        }
        return Reflect.deleteProperty(obj, prop);
      },
      setPrototypeOf(obj, proto) {
        return false;
      }
    };

    const proxy = new Proxy(target, handler);
    _proxyCache.set(target, proxy);
    _proxyCache.set(proxy, proxy);
    _rawTargetMap.set(proxy, target);
    return proxy;
  }

  function StateStore(initialState = createInitialAppState()) {
    this._state = createProtectedStateProxy(initialState);
  }

  StateStore.prototype.getState = function() {
    return this._state;
  };

  StateStore.prototype.clearSession = function() {
    if (this._state) {
      this._state.messages = [];
      this._state.providerKeys = {};
      this._state.consensusResult = null;
      this._state.debateLog = [];
      this._state.memorySummary = '';
      this._state.pendingApprovals = [];
    }
    return this._state;
  };

  StateStore.prototype.appendMessage = function(message) {
    if (!this._state) {
      this._state = createProtectedStateProxy(createInitialAppState());
    }
    if (!Array.isArray(this._state.messages)) {
      this._state.messages = [];
    }
    const msg = (message && typeof message === 'object') ? { ...message } : { text: String(message || '') };
    if (!msg.id) {
      msg.id = secureRandomId('msg');
    }
    if (!msg.timestamp) {
      msg.timestamp = Date.now();
    }
    this._state.messages.push(msg);
    return msg;
  };

  function appendMessage(stateOrStore, message) {
    let store = stateOrStore;
    let msg = message;
    if (arguments.length === 1 && stateOrStore && !(stateOrStore instanceof StateStore) && (!stateOrStore || !stateOrStore._state)) {
      msg = stateOrStore;
      store = null;
    }
    if (store instanceof StateStore) {
      return store.appendMessage(msg);
    }
    const target = (store && store._state) ? store._state : (store && typeof store === 'object' && ('messages' in store) ? store : appState);
    if (!Array.isArray(target.messages)) {
      target.messages = [];
    }
    const msgObj = (msg && typeof msg === 'object') ? { ...msg } : { text: String(msg || '') };
    if (!msgObj.id) {
      msgObj.id = secureRandomId('msg');
    }
    if (!msgObj.timestamp) {
      msgObj.timestamp = Date.now();
    }
    target.messages.push(msgObj);
    return msgObj;
  }

  const appState = createProtectedStateProxy(createInitialAppState());
  const uiState = createProtectedStateProxy(createInitialUiState());

  /**
   * Canonical JSON serializer
   * Recursively sorts object keys alphabetically, handles primitives, arrays, null, undefined, dates, and circular references.
   */
  function canonicalizeJson(val, seen = new WeakSet()) {
    if (val === null) return 'null';
    if (val === undefined) return '';
    const type = typeof val;
    if (type === 'number') {
      return Number.isFinite(val) ? String(val) : 'null';
    }
    if (type === 'boolean') {
      return val ? 'true' : 'false';
    }
    if (type === 'string') {
      return JSON.stringify(val);
    }
    if (type === 'bigint') {
      return JSON.stringify(val.toString());
    }
    if (type === 'symbol' || type === 'function') {
      return '';
    }
    if (val instanceof Date) {
      return JSON.stringify(val.toISOString());
    }
    if (typeof val !== 'object') {
      return JSON.stringify(String(val));
    }
    if (seen.has(val)) {
      return '"[Circular]"';
    }
    seen.add(val);

    if (Array.isArray(val)) {
      const items = val.map(item => {
        if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
          return 'null';
        }
        return canonicalizeJson(item, seen);
      });
      return '[' + items.join(',') + ']';
    }

    const keys = Object.keys(val).sort();
    const entries = [];
    for (const k of keys) {
      const v = val[k];
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
        continue;
      }
      entries.push(JSON.stringify(k) + ':' + canonicalizeJson(v, seen));
    }
    return '{' + entries.join(',') + '}';
  }

  /**
   * Deep masking of sensitive keys & truncation of strings exceeding 500 characters
   */
  function sanitizeToolParams(params, seen = new WeakSet()) {
    if (params === null || params === undefined) return params;
    if (typeof params === 'string') {
      if (params.length > 500) {
        return params.slice(0, 500) + '... [TRUNCATED]';
      }
      return params;
    }
    if (typeof params !== 'object') {
      return params;
    }
    if (seen.has(params)) {
      return '[Circular]';
    }
    seen.add(params);

    if (Array.isArray(params)) {
      return params.map(item => sanitizeToolParams(item, seen));
    }

    const sensitiveKeyRegex = /(token|key|secret|password|auth|authorization|credential)/i;
    const out = {};
    for (const k of Object.keys(params)) {
      if (sensitiveKeyRegex.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        const val = params[k];
        if (typeof val === 'string' && val.length > 500) {
          out[k] = val.slice(0, 500) + '... [TRUNCATED]';
        } else if (val && typeof val === 'object') {
          out[k] = sanitizeToolParams(val, seen);
        } else {
          out[k] = val;
        }
      }
    }
    return out;
  }

  const DEFAULT_MIN_TOKEN_RESERVATION = 64;

  // Pure-JS SHA-256 for deterministic hex strings in all environments
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
    try {
      const bytes = (typeof TextEncoder !== 'undefined')
        ? new TextEncoder().encode(input)
        : (typeof Buffer !== 'undefined' ? Buffer.from(input, 'utf8') : new Uint8Array(0));
      const hashBytes = _sha256Pure(bytes);
      return Array.from(hashBytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return '';
    }
  }

  function _hmacSha256Hex(key, message) {
    const k = String(key || '');
    const m = String(message || '');
    try {
      if (typeof require === 'function') {
        const nodeCrypto = require('crypto');
        if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
          return nodeCrypto.createHmac('sha256', k).update(m, 'utf8').digest('hex');
        }
      }
    } catch (_) {}
    return _sha256Hex(k + ':hmac:' + m);
  }

  function deepFreeze(obj, seen = new Set()) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return obj;
    seen.add(obj);
    Object.freeze(obj);
    for (const key of Object.getOwnPropertyNames(obj)) {
      const val = obj[key];
      if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
        deepFreeze(val, seen);
      }
    }
    return obj;
  }

  function safeStructuredClone(val) {
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(val);
      }
    } catch (_) {}
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (_) {
      return { ...val };
    }
  }

  function tokenizeText(text) {
    if (!text) return [];
    const str = String(text).toLowerCase();
    const words = str.match(/[\p{L}\p{N}]+/gu) || [];
    const tokens = [];
    for (const w of words) {
      if (w.length >= 2) {
        tokens.push('w:' + w);
        if (w.length >= 3) {
          for (let i = 0; i <= w.length - 3; i++) {
            tokens.push('c3:' + w.slice(i, i + 3));
          }
        }
        if (w.length >= 4) {
          for (let i = 0; i <= w.length - 4; i++) {
            tokens.push('c4:' + w.slice(i, i + 4));
          }
        }
      }
    }
    return tokens;
  }

  function computeTfVector(text) {
    const tokens = tokenizeText(text);
    const tf = new Map();
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) || 0) + 1);
    }
    const total = tokens.length || 1;
    const normTf = new Map();
    for (const [tok, count] of tf.entries()) {
      normTf.set(tok, count / total);
    }
    return normTf;
  }

  function vectorNorm(vec) {
    let sumSq = 0;
    if (vec instanceof Map) {
      for (const val of vec.values()) {
        sumSq += val * val;
      }
    } else if (vec && typeof vec === 'object') {
      for (const k of Object.keys(vec)) {
        const val = vec[k];
        sumSq += val * val;
      }
    }
    return Math.sqrt(sumSq);
  }

  function dotProduct(vecA, vecB) {
    let dot = 0;
    if (vecA instanceof Map && vecB instanceof Map) {
      const [small, big] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];
      for (const [k, v] of small.entries()) {
        if (big.has(k)) {
          dot += v * big.get(k);
        }
      }
    } else if (vecA && vecB) {
      const keysA = Object.keys(vecA);
      const keysB = Object.keys(vecB);
      const [small, big] = keysA.length <= keysB.length ? [vecA, vecB] : [vecB, vecA];
      for (const k of Object.keys(small)) {
        if (k in big) {
          dot += small[k] * big[k];
        }
      }
    }
    return dot;
  }

  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0.0;
    const normA = vectorNorm(vecA);
    const normB = vectorNorm(vecB);
    if (normA <= 0 || normB <= 0) return 0.0;
    const dot = dotProduct(vecA, vecB);
    return Math.max(0, Math.min(1.0, dot / (normA * normB)));
  }

  const MEMORY_POISONING_REGEX = /ignore\s+previous\s+instructions|system\s+override|send\s+(api\s*)?key|reveal\s+(secret|password|token)|exfiltrate/i;
  const PERSIAN_POISONING_REGEX = /دستورات\s+قبلی\s+را\s+نادیده\s+بگیر|کلیدهای\s+API\s+را\s+بفرست|کلیدهای\s+api\s+را\s+بفرست|تغییر\s+قوانین\s+سیستم|رمز\s+عبور\s+را\s+فاش\s+کن|رمز\s+عبور\s+را\s+نشان\s+بده|افشای\s+رمز|دستورات\s+قبلی\s+را\s+لغو\s+کن/i;
  const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/;

  function detectHiddenOrEncodedPoisoning(contentStr) {
    if (!contentStr || typeof contentStr !== 'string') return false;

    // 1. Direct regex check on raw text
    if (MEMORY_POISONING_REGEX.test(contentStr)) return true;
    if (PERSIAN_POISONING_REGEX.test(contentStr)) return true;
    if (ZERO_WIDTH_REGEX.test(contentStr)) return true;

    // 2. Base64 payload detection
    const base64Candidates = contentStr.match(/[A-Za-z0-9+/]{8,}={0,2}/g);
    if (base64Candidates) {
      for (const b64 of base64Candidates) {
        try {
          let decoded = '';
          if (typeof Buffer !== 'undefined') {
            decoded = Buffer.from(b64, 'base64').toString('utf8');
          } else if (typeof atob === 'function') {
            decoded = decodeURIComponent(escape(atob(b64)));
          }
          if (decoded && (MEMORY_POISONING_REGEX.test(decoded) || PERSIAN_POISONING_REGEX.test(decoded) || ZERO_WIDTH_REGEX.test(decoded))) {
            return true;
          }
        } catch (_) {}
      }
    }

    // 3. Hex payload detection
    const hexCandidates = contentStr.match(/(?:[0-9a-fA-F]{2}){8,}/g);
    if (hexCandidates) {
      for (const hex of hexCandidates) {
        try {
          let decoded = '';
          if (typeof Buffer !== 'undefined') {
            decoded = Buffer.from(hex, 'hex').toString('utf8');
          } else {
            const bytes = [];
            for (let i = 0; i < hex.length; i += 2) {
              bytes.push(parseInt(hex.slice(i, i + 2), 16));
            }
            decoded = String.fromCharCode(...bytes);
          }
          if (decoded && (MEMORY_POISONING_REGEX.test(decoded) || PERSIAN_POISONING_REGEX.test(decoded) || ZERO_WIDTH_REGEX.test(decoded))) {
            return true;
          }
        } catch (_) {}
      }
    }

    return false;
  }

  class AgentExecutionGuard {
    constructor(options = {}) {
      this.taskId = options.taskId || ('task_' + secureRandomHex(8));
      this.parentTaskId = options.parentTaskId || null;
      this.agentId = options.agentId || null;
      this.modelId = options.modelId || null;
      this.maxSteps = options.maxSteps !== undefined ? Number(options.maxSteps) : 15;
      this.maxToolCalls = options.maxToolCalls !== undefined ? Number(options.maxToolCalls) : 20;
      this.maxTokenBudget = options.maxTokenBudget !== undefined ? Number(options.maxTokenBudget) : 100000;
      this.maxDurationMs = options.maxDurationMs !== undefined ? Number(options.maxDurationMs) : 120000;
      this.currentSteps = 0;
      this.currentToolCalls = 0;
      this.usedTokens = 0;
      this._usedTokens = 0;
      this._maxTokenBudget = this.maxTokenBudget;
      this.budgetOverrun = false;
      this._budgetOverrun = false;
      this.completedToolCalls = 0;
      this.pendingToolCalls = Array.isArray(options.pendingToolCalls) ? [...options.pendingToolCalls] : [];
      this.checkpoint = options.checkpoint || null;
      this.idempotencyKeys = new Set(options.idempotencyKeys || []);
      this.startTime = Date.now();
      this.callHistory = [];
      this.abortController = (typeof AbortController !== 'undefined')
        ? new AbortController()
        : { signal: { aborted: false }, abort(reason) { this.signal.aborted = true; this.signal.reason = reason; } };
      this.cancelled = false;
      this.cancelReason = null;
      this._sessionSalt = options.sessionSalt || secureRandomHex(16);
      this._pendingReservations = new Map();
      this._sharedReservationLedger = this._pendingReservations;
      this._parentReservationKeys = new Map();
      this.repetitionThreshold = options.repetitionThreshold !== undefined
        ? Number(options.repetitionThreshold)
        : (options.loopThreshold !== undefined ? Number(options.loopThreshold) : 3);
    }

    get currentStep() { return this.currentSteps; }
    set currentStep(v) { this.currentSteps = Number(v) || 0; }
    get _usedTokens() { return this.usedTokens; }
    set _usedTokens(v) { this.usedTokens = Number(v) || 0; }
    get _maxTokenBudget() { return this.maxTokenBudget; }
    set _maxTokenBudget(v) { this.maxTokenBudget = Number(v) || 0; }
    get _budgetOverrun() { return Boolean(this.budgetOverrun); }
    set _budgetOverrun(v) { this.budgetOverrun = Boolean(v); }

    _fingerprint(toolName, params) {
      const t = String(toolName || '').trim();
      let p = '';
      try {
        if (params !== undefined && params !== null) {
          p = (typeof params === 'object') ? canonicalizeJson(params) : String(params);
        }
      } catch (_) {
        p = String(params || '');
      }
      return _sha256Hex((this._sessionSalt || '') + '|' + t + '|' + p);
    }

    detectLoop(toolName, params, options = {}) {
      const hasArgs = (toolName !== undefined && toolName !== null);
      const fp = hasArgs ? this._fingerprint(toolName, params) : null;
      const historyFps = this.callHistory.map(entry => entry.fingerprint);
      const fullSeq = hasArgs ? [...historyFps, fp] : historyFps;
      const m = fullSeq.length;
      const threshold = (options && (options.threshold || options.repetitionThreshold || options.repetitionFrequencyThreshold)) || this.repetitionThreshold || 3;

      // 1. 3 consecutive identical calls (1-step cycle: A -> A -> A)
      if (m >= threshold) {
        let isOneStepLoop = true;
        const lastFp = fullSeq[m - 1];
        for (let i = 1; i < threshold; i++) {
          if (fullSeq[m - 1 - i] !== lastFp) {
            isOneStepLoop = false;
            break;
          }
        }
        if (isOneStepLoop) {
          const effectiveTool = toolName || this.callHistory[this.callHistory.length - 1]?.toolName || 'tool';
          const err = new Error(`LOOP_DETECTED: 3 consecutive calls with identical tool & params fingerprint (${effectiveTool})`);
          err.code = 'LOOP_DETECTED';
          err.toolName = effectiveTool;
          throw err;
        }
      }

      const getToolNamesForCycle = (windowSize) => {
        const histLen = this.callHistory.length;
        const tools = [];
        if (hasArgs) {
          for (let i = windowSize - 1; i >= 1; i--) {
            tools.push(this.callHistory[histLen - i]?.toolName || `tool${windowSize - i}`);
          }
          tools.push(toolName || 'tool');
        } else {
          for (let i = windowSize; i >= 1; i--) {
            tools.push(this.callHistory[histLen - i]?.toolName || `tool${windowSize - i + 1}`);
          }
        }
        return tools;
      };

      // Sliding window up to length 5 (detecting alternating 2-step, 3-step, 4-step, and 5-step repeating loops)
      for (let w = 2; w <= 5; w++) {
        let repCount = threshold;
        if (w >= 4 && m < w * threshold && m >= w * 2) {
          repCount = 2;
        }
        const minCalls = w * repCount;
        if (m < minCalls) continue;

        const pattern = [];
        for (let j = 0; j < w; j++) {
          pattern.push(fullSeq[m - w + j]);
        }
        const allSame = pattern.every(x => x === pattern[0]);
        if (allSame) continue;

        if (w === 4 && pattern[0] === pattern[2] && pattern[1] === pattern[3]) continue;

        let matches = true;
        for (let r = 0; r < repCount; r++) {
          for (let j = 0; j < w; j++) {
            if (fullSeq[m - (r + 1) * w + j] !== pattern[j]) {
              matches = false;
              break;
            }
          }
          if (!matches) break;
        }

        if (matches) {
          const tools = getToolNamesForCycle(w);
          const toolSummary = tools.join(' -> ');
          const lastTool = tools[tools.length - 1];
          const err = new Error(`LOOP_DETECTED: Alternating ${w}-step cycle detected (${repCount} cycles of ${toolSummary})`);
          err.code = 'LOOP_DETECTED';
          err.toolName = lastTool;
          err.windowSize = w;
          err.cycle = tools;
          throw err;
        }
      }

      return false;
    }

    checkExecutionLimits(toolName, params) {
      if (this.isCancelled()) {
        const err = new Error(`EXECUTION_CANCELLED: ${this.cancelReason || 'Task was cancelled'}`);
        err.code = 'EXECUTION_CANCELLED';
        throw err;
      }
      if (this.budgetOverrun || this._budgetOverrun) {
        const err = new Error('TOKEN_BUDGET_OVERRUN: Actual usage exceeded task budget');
        err.code = 'TOKEN_BUDGET_OVERRUN';
        throw err;
      }
      if (this.currentSteps >= this.maxSteps) {
        const err = new Error(`STEP_LIMIT_EXCEEDED: Maximum steps (${this.maxSteps}) exceeded`);
        err.code = 'STEP_LIMIT_EXCEEDED';
        throw err;
      }
      if (this.currentToolCalls >= this.maxToolCalls) {
        const err = new Error(`TOOL_CALL_LIMIT_EXCEEDED: Maximum tool calls (${this.maxToolCalls}) exceeded`);
        err.code = 'TOOL_CALL_LIMIT_EXCEEDED';
        throw err;
      }
      if (this.usedTokens >= this.maxTokenBudget) {
        const err = new Error(`TOKEN_BUDGET_EXCEEDED: Maximum token budget (${this.maxTokenBudget}) exceeded`);
        err.code = 'TOKEN_BUDGET_EXCEEDED';
        throw err;
      }
      if (Date.now() - this.startTime > this.maxDurationMs) {
        const err = new Error(`DURATION_LIMIT_EXCEEDED: Maximum execution duration (${this.maxDurationMs}ms) exceeded`);
        err.code = 'DURATION_LIMIT_EXCEEDED';
        throw err;
      }
      if (toolName !== undefined && toolName !== null) {
        this.detectLoop(toolName, params);
      }
      return true;
    }

    recordStep() {
      this.currentSteps++;
      return this.currentSteps;
    }

    recordToolCall(toolName, params, tokens = 0) {
      this.currentToolCalls++;
      this.completedToolCalls = this.currentToolCalls;
      const tok = Math.max(0, Number(tokens) || 0);
      this.usedTokens += tok;
      this._usedTokens = this.usedTokens;
      let safeParams = params;
      try {
        safeParams = sanitizeToolParams(params);
      } catch (_) {
        try {
          safeParams = String(params || '');
          if (safeParams.length > 500) {
            safeParams = safeParams.slice(0, 500) + '... [TRUNCATED]';
          }
        } catch (_) {
          safeParams = '[Unserializable]';
        }
      }
      const entry = {
        toolName: String(toolName || ''),
        params: safeParams,
        fingerprint: this._fingerprint(toolName, params),
        tokens: tok,
        timestamp: Date.now()
      };
      this.callHistory.push(entry);
      if (this.callHistory.length > 100) {
        this.callHistory.splice(0, this.callHistory.length - 100);
      }
      return entry;
    }

    addTokenUsage(tokens) {
      const tok = Math.max(0, Number(tokens) || 0);
      this.usedTokens += tok;
      this._usedTokens = this.usedTokens;
      if (this.usedTokens > this.maxTokenBudget) {
        this.budgetOverrun = true;
        this._budgetOverrun = true;
      }
      return this.usedTokens;
    }

    reserveTokens(callId, estimatedTokens) {
      const pendingTotal = Array.from(this._pendingReservations.values()).reduce((sum, v) => sum + v, 0);
      const remainingForGuard = Math.max(0, this.maxTokenBudget - (this.usedTokens + pendingTotal));
      const estimated = (estimatedTokens !== undefined && estimatedTokens !== null && Number(estimatedTokens) > 0)
        ? Number(estimatedTokens)
        : (this.parentGuard ? DEFAULT_MIN_TOKEN_RESERVATION : Math.min(DEFAULT_MIN_TOKEN_RESERVATION, remainingForGuard));

      if ((this.usedTokens + pendingTotal + estimated) > this.maxTokenBudget) {
        const err = new Error(`TOKEN_BUDGET_EXCEEDED: Reserving ${estimated} tokens exceeds budget (${this.maxTokenBudget})`);
        err.code = 'TOKEN_BUDGET_EXCEEDED';
        throw err;
      }

      const id = String(callId || ('res_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)));

      if (this.parentGuard) {
        const parentCallId = (this._subagentId || this.taskId || 'sub') + ':' + id;
        const parentLedger = (this.parentGuard._sharedReservationLedger || this.parentGuard._pendingReservations);
        const parentPending = Array.from(parentLedger.values()).reduce((sum, v) => sum + v, 0);
        if ((this.parentGuard.usedTokens + parentPending + estimated) > this.parentGuard.maxTokenBudget) {
          const err = new Error(`TOKEN_BUDGET_EXCEEDED: Reserving ${estimated} tokens exceeds parent budget (${this.parentGuard.maxTokenBudget})`);
          err.code = 'TOKEN_BUDGET_EXCEEDED';
          throw err;
        }
        if (typeof this.parentGuard.reserveTokens === 'function') {
          this.parentGuard.reserveTokens(parentCallId, estimated);
        } else {
          parentLedger.set(parentCallId, estimated);
        }
        this._parentReservationKeys.set(id, parentCallId);
      }

      this._pendingReservations.set(id, estimated);
      const remainingBudget = this.maxTokenBudget - (this.usedTokens + pendingTotal + estimated);
      return { callId: id, reservedTokens: estimated, remainingBudget };
    }

    settleTokens(callId, actualTokens) {
      const actual = Math.max(0, Number(actualTokens) || 0);
      const id = String(callId || '');
      const reserved = this._pendingReservations.get(id) || 0;
      this._pendingReservations.delete(id);

      let parentOverrun = false;
      if (this.parentGuard) {
        const parentCallId = this._parentReservationKeys.get(id) || ((this._subagentId || this.taskId || 'sub') + ':' + id);
        this._parentReservationKeys.delete(id);
        try {
          if (typeof this.parentGuard.settleTokens === 'function') {
            this.parentGuard.settleTokens(parentCallId, actual);
          } else {
            const parentLedger = (this.parentGuard._sharedReservationLedger || this.parentGuard._pendingReservations);
            parentLedger.delete(parentCallId);
            this.parentGuard.usedTokens = (this.parentGuard.usedTokens || 0) + actual;
            if (this.parentGuard.usedTokens > this.parentGuard.maxTokenBudget) {
              this.parentGuard._budgetOverrun = true;
              this.parentGuard.budgetOverrun = true;
              parentOverrun = true;
            }
          }
        } catch (parentErr) {
          if (parentErr && parentErr.code === 'TOKEN_BUDGET_OVERRUN') {
            parentOverrun = true;
          } else {
            throw parentErr;
          }
        }
      }

      this.usedTokens += actual;
      this._usedTokens = this.usedTokens;

      if (this.usedTokens > this.maxTokenBudget || parentOverrun) {
        this._budgetOverrun = true;
        this.budgetOverrun = true;
        const err = new Error('TOKEN_BUDGET_OVERRUN: Actual usage exceeded task budget');
        err.code = 'TOKEN_BUDGET_OVERRUN';
        err.usedTokens = this.usedTokens;
        err.maxTokenBudget = this.maxTokenBudget;
        err.actualTokens = actual;
        err.callId = id;
        throw err;
      }

      return { callId: id, actualTokens: actual, usedTokens: this.usedTokens, releasedReservation: reserved };
    }

    releaseReservation(callId) {
      const id = String(callId || '');
      const childDeleted = this._pendingReservations.delete(id);
      let parentDeleted = false;
      if (this.parentGuard) {
        const parentCallId = this._parentReservationKeys.get(id) || ((this._subagentId || this.taskId || 'sub') + ':' + id);
        this._parentReservationKeys.delete(id);
        if (typeof this.parentGuard.releaseReservation === 'function') {
          parentDeleted = this.parentGuard.releaseReservation(parentCallId);
        } else {
          const parentLedger = (this.parentGuard._sharedReservationLedger || this.parentGuard._pendingReservations);
          parentDeleted = parentLedger.delete(parentCallId);
        }
      }
      return Boolean(childDeleted || parentDeleted);
    }

    exportTaskJournal() {
      return {
        taskId: this.taskId,
        parentTaskId: this.parentTaskId,
        agentId: this.agentId,
        modelId: this.modelId,
        currentStep: this.currentSteps,
        currentSteps: this.currentSteps,
        maxSteps: this.maxSteps,
        maxToolCalls: this.maxToolCalls,
        maxTokenBudget: this.maxTokenBudget,
        usedTokens: this.usedTokens,
        budgetOverrun: Boolean(this._budgetOverrun || this.budgetOverrun),
        pendingReservations: Array.from(this._pendingReservations.entries()),
        completedToolCalls: this.completedToolCalls !== undefined ? this.completedToolCalls : this.currentToolCalls,
        pendingToolCalls: Array.isArray(this.pendingToolCalls) ? JSON.parse(JSON.stringify(this.pendingToolCalls)) : [],
        checkpoint: this.checkpoint ? JSON.parse(JSON.stringify(this.checkpoint)) : null,
        cancellationState: {
          cancelled: Boolean(this.cancelled),
          cancelReason: this.cancelReason || null
        },
        cancelled: Boolean(this.cancelled),
        cancelReason: this.cancelReason || null,
        idempotencyKeys: Array.from(this.idempotencyKeys || []),
        startTime: this.startTime,
        maxDurationMs: this.maxDurationMs,
        sessionSalt: this._sessionSalt,
        callHistory: JSON.parse(JSON.stringify(this.callHistory))
      };
    }

    restoreTaskJournal(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        return this;
      }
      if (snapshot.taskId !== undefined) this.taskId = snapshot.taskId;
      if (snapshot.parentTaskId !== undefined) this.parentTaskId = snapshot.parentTaskId;
      if (snapshot.agentId !== undefined) this.agentId = snapshot.agentId;
      if (snapshot.modelId !== undefined) this.modelId = snapshot.modelId;

      const stepVal = snapshot.currentStep !== undefined ? snapshot.currentStep : snapshot.currentSteps;
      if (typeof stepVal === 'number') {
        this.currentSteps = stepVal;
      }
      if (typeof snapshot.maxSteps === 'number') this.maxSteps = snapshot.maxSteps;
      if (typeof snapshot.maxToolCalls === 'number') this.maxToolCalls = snapshot.maxToolCalls;
      if (typeof snapshot.currentToolCalls === 'number') this.currentToolCalls = snapshot.currentToolCalls;
      if (typeof snapshot.maxTokenBudget === 'number') {
        this.maxTokenBudget = snapshot.maxTokenBudget;
        this._maxTokenBudget = snapshot.maxTokenBudget;
      }
      if (typeof snapshot.usedTokens === 'number') {
        this.usedTokens = snapshot.usedTokens;
        this._usedTokens = snapshot.usedTokens;
      }
      if (snapshot.budgetOverrun !== undefined) {
        this.budgetOverrun = Boolean(snapshot.budgetOverrun);
        this._budgetOverrun = Boolean(snapshot.budgetOverrun);
      }
      if (Array.isArray(snapshot.pendingReservations)) {
        this._pendingReservations = new Map(snapshot.pendingReservations);
        this._sharedReservationLedger = this._pendingReservations;
      }
      if (snapshot.completedToolCalls !== undefined) {
        this.completedToolCalls = snapshot.completedToolCalls;
      }
      if (Array.isArray(snapshot.pendingToolCalls)) {
        this.pendingToolCalls = JSON.parse(JSON.stringify(snapshot.pendingToolCalls));
      }
      if (snapshot.checkpoint !== undefined) {
        this.checkpoint = snapshot.checkpoint ? JSON.parse(JSON.stringify(snapshot.checkpoint)) : null;
      }
      if (snapshot.cancellationState && typeof snapshot.cancellationState === 'object') {
        this.cancelled = Boolean(snapshot.cancellationState.cancelled);
        this.cancelReason = snapshot.cancellationState.cancelReason || null;
      } else {
        if (snapshot.cancelled !== undefined) this.cancelled = Boolean(snapshot.cancelled);
        if (snapshot.cancelReason !== undefined) this.cancelReason = snapshot.cancelReason;
      }
      if (Array.isArray(snapshot.idempotencyKeys)) {
        this.idempotencyKeys = new Set(snapshot.idempotencyKeys);
      }
      if (typeof snapshot.startTime === 'number') this.startTime = snapshot.startTime;
      if (typeof snapshot.maxDurationMs === 'number') this.maxDurationMs = snapshot.maxDurationMs;
      if (typeof snapshot.sessionSalt === 'string') this._sessionSalt = snapshot.sessionSalt;

      if (Array.isArray(snapshot.callHistory)) {
        this.callHistory = JSON.parse(JSON.stringify(snapshot.callHistory));
      }
      if (this.cancelled && this.abortController && typeof this.abortController.abort === 'function') {
        try { this.abortController.abort(this.cancelReason); } catch (_) {}
      }
      return this;
    }

    cancelTask(reason = 'Task cancelled by user') {
      this.cancelled = true;
      this.cancelReason = String(reason || 'Task cancelled');
      if (this.abortController && typeof this.abortController.abort === 'function') {
        try {
          this.abortController.abort(reason);
        } catch (_) {}
      }
    }

    isCancelled() {
      return Boolean(this.cancelled || (this.abortController && this.abortController.signal && this.abortController.signal.aborted));
    }
  }

  // Persistent Task / Session Execution Guard
  let _activeTaskExecutionGuard = null;

  function getSessionExecutionGuard(options = {}) {
    if (!_activeTaskExecutionGuard) {
      _activeTaskExecutionGuard = new AgentExecutionGuard(options);
    }
    return _activeTaskExecutionGuard;
  }

  function resetTaskExecutionGuard(options = {}) {
    _activeTaskExecutionGuard = new AgentExecutionGuard(options);
    return _activeTaskExecutionGuard;
  }

  // Backwards compatibility for _defaultSessionExecutionGuard and getDefaultSessionExecutionGuard
  let _defaultSessionExecutionGuard = new AgentExecutionGuard();
  function getDefaultSessionExecutionGuard(options = {}) {
    return new AgentExecutionGuard(options);
  }

  function createSubagentGuard(parentGuard, subBudget = {}) {
    if (!parentGuard) {
      throw new Error('parentGuard is required to create a subagent guard');
    }

    const ledger = (parentGuard._sharedReservationLedger || parentGuard._pendingReservations);
    const parentPending = ledger && typeof ledger.values === 'function'
      ? Array.from(ledger.values()).reduce((sum, v) => sum + v, 0)
      : 0;
    const parentRemainingSteps = Math.max(0, (parentGuard.maxSteps ?? Infinity) - (parentGuard.currentSteps ?? 0));
    const parentRemainingToolCalls = Math.max(0, (parentGuard.maxToolCalls ?? Infinity) - (parentGuard.currentToolCalls ?? 0));
    const parentRemainingTokens = Math.max(0, (parentGuard.maxTokenBudget ?? Infinity) - ((parentGuard.usedTokens ?? 0) + parentPending));
    const parentRemainingDuration = (parentGuard.maxDurationMs !== undefined && parentGuard.startTime !== undefined)
      ? Math.max(0, (parentGuard.startTime + parentGuard.maxDurationMs) - Date.now())
      : Infinity;

    const childMaxSteps = subBudget.maxSteps !== undefined
      ? Math.min(Number(subBudget.maxSteps), parentRemainingSteps)
      : parentRemainingSteps;

    const childMaxToolCalls = subBudget.maxToolCalls !== undefined
      ? Math.min(Number(subBudget.maxToolCalls), parentRemainingToolCalls)
      : parentRemainingToolCalls;

    const childMaxTokenBudget = subBudget.maxTokenBudget !== undefined
      ? Math.min(Number(subBudget.maxTokenBudget), parentRemainingTokens)
      : parentRemainingTokens;

    const childMaxDurationMs = subBudget.maxDurationMs !== undefined
      ? Math.min(Number(subBudget.maxDurationMs), parentRemainingDuration)
      : (parentRemainingDuration !== Infinity ? parentRemainingDuration : 120000);

    const child = new AgentExecutionGuard({
      maxSteps: childMaxSteps,
      maxToolCalls: childMaxToolCalls,
      maxTokenBudget: childMaxTokenBudget,
      maxDurationMs: childMaxDurationMs,
      sessionSalt: parentGuard._sessionSalt,
      repetitionThreshold: parentGuard.repetitionThreshold
    });

    child.parentGuard = parentGuard;
    child.parentTaskId = parentGuard.taskId || null;
    child._subagentId = secureRandomId('subagent');
    child._parentReservationKeys = new Map();

    // Propagate abort from parent to child
    if (parentGuard.abortController?.signal) {
      if (parentGuard.abortController.signal.aborted) {
        child.cancelTask(parentGuard.cancelReason || 'Parent task cancelled');
      } else if (typeof parentGuard.abortController.signal.addEventListener === 'function') {
        parentGuard.abortController.signal.addEventListener('abort', () => {
          child.cancelTask(parentGuard.cancelReason || 'Parent task cancelled');
        }, { once: true });
      }
    }

    const origCheckExecutionLimits = child.checkExecutionLimits.bind(child);
    child.checkExecutionLimits = function(toolName, params) {
      if (parentGuard.isCancelled && parentGuard.isCancelled()) {
        const err = new Error(`EXECUTION_CANCELLED: ${parentGuard.cancelReason || 'Parent task was cancelled'}`);
        err.code = 'EXECUTION_CANCELLED';
        throw err;
      }
      if (parentGuard.budgetOverrun || parentGuard._budgetOverrun) {
        const err = new Error('TOKEN_BUDGET_OVERRUN: Actual usage exceeded task budget');
        err.code = 'TOKEN_BUDGET_OVERRUN';
        throw err;
      }
      if (typeof parentGuard.checkExecutionLimits === 'function') {
        parentGuard.checkExecutionLimits(toolName, params);
      }
      return origCheckExecutionLimits(toolName, params);
    };

    const origRecordStep = child.recordStep.bind(child);
    child.recordStep = function() {
      if (typeof parentGuard.recordStep === 'function') {
        parentGuard.recordStep();
      }
      return origRecordStep();
    };

    const origRecordToolCall = child.recordToolCall.bind(child);
    child.recordToolCall = function(toolName, params, tokens = 0) {
      if (typeof parentGuard.recordToolCall === 'function') {
        try {
          parentGuard.recordToolCall(toolName, params, tokens);
        } catch (_) {}
      }
      return origRecordToolCall(toolName, params, tokens);
    };

    const origAddTokenUsage = child.addTokenUsage.bind(child);
    child.addTokenUsage = function(tokens) {
      if (typeof parentGuard.addTokenUsage === 'function') {
        parentGuard.addTokenUsage(tokens);
      } else if (typeof parentGuard.usedTokens === 'number') {
        parentGuard.usedTokens += Math.max(0, Number(tokens) || 0);
        parentGuard._usedTokens = parentGuard.usedTokens;
      }
      return origAddTokenUsage(tokens);
    };

    return child;
  }

  /**
   * CentralBudgetManager: Subagent Sub-budgets and isolated resource allocations
   */
  class CentralBudgetManager {
    static get ROLES() {
      return Object.freeze(['Planner', 'Researcher', 'Coder', 'Verifier']);
    }

    static getDefaultRoleRatios() {
      return {
        Planner: { stepsRatio: 0.15, tokensRatio: 0.15, toolCallsRatio: 0.15 },
        Researcher: { stepsRatio: 0.35, tokensRatio: 0.35, toolCallsRatio: 0.35 },
        Coder: { stepsRatio: 0.35, tokensRatio: 0.35, toolCallsRatio: 0.35 },
        Verifier: { stepsRatio: 0.15, tokensRatio: 0.15, toolCallsRatio: 0.15 }
      };
    }

    static normalizeRoleRatios(roleRatios) {
      if (!roleRatios || typeof roleRatios !== 'object') {
        return CentralBudgetManager.getDefaultRoleRatios();
      }
      const roles = Object.keys(roleRatios);
      if (roles.length === 0) {
        return CentralBudgetManager.getDefaultRoleRatios();
      }

      const isFlat = typeof roleRatios[roles[0]] === 'number';
      if (isFlat) {
        let sum = 0;
        for (const r of roles) {
          sum += Math.max(0, Number(roleRatios[r]) || 0);
        }
        const normalized = {};
        for (const r of roles) {
          const raw = Math.max(0, Number(roleRatios[r]) || 0);
          const ratio = sum > 0 ? (raw / sum) : (1 / roles.length);
          normalized[r] = { stepsRatio: ratio, tokensRatio: ratio, toolCallsRatio: ratio };
        }
        return normalized;
      }

      const dimensions = ['stepsRatio', 'tokensRatio', 'toolCallsRatio'];
      const sums = { stepsRatio: 0, tokensRatio: 0, toolCallsRatio: 0 };
      for (const r of roles) {
        const val = roleRatios[r] || {};
        for (const dim of dimensions) {
          sums[dim] += Math.max(0, Number(val[dim]) || 0);
        }
      }
      const normalized = {};
      for (const r of roles) {
        const val = roleRatios[r] || {};
        normalized[r] = {};
        for (const dim of dimensions) {
          const raw = Math.max(0, Number(val[dim]) || 0);
          normalized[r][dim] = sums[dim] > 0 ? (raw / sums[dim]) : (1 / roles.length);
        }
      }
      return normalized;
    }

    constructor(customRatios = null) {
      this.roleRatios = customRatios ? CentralBudgetManager.normalizeRoleRatios(customRatios) : CentralBudgetManager.getDefaultRoleRatios();
    }

    static allocateSubagentBudget(parentGuard, role, budgetOptions = {}) {
      if (!parentGuard) {
        throw new Error('parentGuard is required to allocate subagent budget');
      }
      const roleKey = String(role || 'Researcher').trim();
      let ratios = CentralBudgetManager.getDefaultRoleRatios()[roleKey] || { stepsRatio: 0.25, tokensRatio: 0.25, toolCallsRatio: 0.25 };

      if (budgetOptions && (budgetOptions.roleRatios || budgetOptions.ratios)) {
        const norm = CentralBudgetManager.normalizeRoleRatios(budgetOptions.roleRatios || budgetOptions.ratios);
        if (norm[roleKey]) {
          ratios = norm[roleKey];
        }
      }

      const parentRemainingSteps = Math.max(0, (parentGuard.maxSteps ?? Infinity) - (parentGuard.currentSteps ?? 0));
      const parentRemainingToolCalls = Math.max(0, (parentGuard.maxToolCalls ?? Infinity) - (parentGuard.currentToolCalls ?? 0));
      const parentRemainingTokens = Math.max(0, (parentGuard.maxTokenBudget ?? Infinity) - (parentGuard.usedTokens ?? 0));
      const parentRemainingDuration = (parentGuard.maxDurationMs !== undefined && parentGuard.startTime !== undefined)
        ? Math.max(0, (parentGuard.startTime + parentGuard.maxDurationMs) - Date.now())
        : (parentGuard.maxDurationMs || 120000);

      const maxSteps = budgetOptions.maxSteps !== undefined
        ? Math.min(Number(budgetOptions.maxSteps), parentRemainingSteps)
        : (parentRemainingSteps !== Infinity ? Math.max(1, Math.floor(parentRemainingSteps * (ratios.stepsRatio || 0.15))) : 15);

      const maxToolCalls = budgetOptions.maxToolCalls !== undefined
        ? Math.min(Number(budgetOptions.maxToolCalls), parentRemainingToolCalls)
        : (parentRemainingToolCalls !== Infinity ? Math.max(1, Math.floor(parentRemainingToolCalls * (ratios.toolCallsRatio || 0.15))) : 20);

      const maxTokenBudget = budgetOptions.maxTokenBudget !== undefined
        ? Math.min(Number(budgetOptions.maxTokenBudget), parentRemainingTokens)
        : (parentRemainingTokens !== Infinity ? Math.max(100, Math.floor(parentRemainingTokens * (ratios.tokensRatio || 0.15))) : 100000);

      const maxDurationMs = budgetOptions.maxDurationMs !== undefined
        ? Math.min(Number(budgetOptions.maxDurationMs), parentRemainingDuration)
        : (parentRemainingDuration !== Infinity ? parentRemainingDuration : 120000);

      const childGuard = createSubagentGuard(parentGuard, {
        maxSteps,
        maxToolCalls,
        maxTokenBudget,
        maxDurationMs
      });
      childGuard.role = roleKey;
      return childGuard;
    }

    allocateSubagentBudget(parentGuard, role, budgetOptions = {}) {
      const opts = { ...budgetOptions };
      if (!opts.roleRatios && !opts.ratios && this.roleRatios) {
        opts.roleRatios = this.roleRatios;
      }
      return CentralBudgetManager.allocateSubagentBudget(parentGuard, role, opts);
    }
  }

  function allocateSubagentBudget(parentGuard, role, budgetOptions) {
    return CentralBudgetManager.allocateSubagentBudget(parentGuard, role, budgetOptions);
  }

  /**
   * OWASP ASI06 Defense: Memory & Context Poisoning Guard
   */
  class MemoryGovernance {
    constructor(options = {}) {
      this.shortTerm = [];
      this.longTerm = [];
      this.episodic = [];
      this.quarantine = [];
      this.semanticIndex = new Map();
      this._vectors = new Map();
      this.sessionKey = options.sessionKey || secureRandomHex(32);
    }

    _indexSemanticRecord(record) {
      if (!record || !record.id) return;
      const text = typeof record.content === 'string' ? record.content : JSON.stringify(record.content || '');
      const vec = computeTfVector(text);
      this._vectors.set(record.id, vec);
    }

    generateApprovalSignature(entryId) {
      return _hmacSha256Hex(this.sessionKey, String(entryId));
    }

    registerMemoryEntry(layer, entry) {
      if (!layer || (layer !== 'shortTerm' && layer !== 'longTerm' && layer !== 'episodic' && layer !== 'semanticIndex' && layer !== 'quarantine')) {
        throw new Error(`Invalid memory layer: ${layer}. Expected shortTerm, longTerm, episodic, semanticIndex, or quarantine`);
      }
      if (!entry || typeof entry !== 'object') {
        throw new Error('Memory entry must be a non-null object');
      }

      const contentStr = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content ?? '');

      // Unprovenanced default: where sourceType and provenance are missing
      const hasSourceType = Boolean(entry.sourceType);
      const hasProvenance = Boolean(entry.provenance);
      const isUnprovenanced = !hasSourceType && !hasProvenance;
      const sourceType = String(entry.sourceType || (isUnprovenanced ? 'untrusted' : 'user')).toLowerCase();
      const provenance = String(entry.provenance || (isUnprovenanced ? 'external_unknown' : (sourceType === 'user' ? 'user' : (sourceType === 'tool' ? 'tool' : 'system'))));
      const trustScore = typeof entry.trustScore === 'number'
        ? entry.trustScore
        : (isUnprovenanced ? 0.2 : ((sourceType === 'web' || sourceType === 'mcp' || sourceType === 'untrusted') ? 0.2 : 1.0));

      // REMOVE the userVerified boolean bypass in ingest / registerMemoryEntry!
      // Do not trust entry.userVerified in the input payload.
      // Only legitimate internal developer override can bypass during direct ingestion.
      const isInternalDeveloperOverride = Boolean(entry.provenance === 'developer-override');
      const isVerified = isInternalDeveloperOverride;

      const hasPoisoningPattern = detectHiddenOrEncodedPoisoning(contentStr);
      const isSensitiveLayer = layer === 'longTerm' || Boolean(entry.isSystemPrompt || entry.systemPrompt || entry.isRoutine || entry.routine);
      const isUntrustedSource = (typeof trustScore === 'number' && trustScore < 0.8) ||
        ((sourceType === 'web' || sourceType === 'mcp' || sourceType === 'untrusted') && (typeof entry.trustScore !== 'number' || entry.trustScore < 0.8));

      // Defense against OWASP ASI06: Memory & Context Poisoning
      if (hasPoisoningPattern || (isSensitiveLayer && isUntrustedSource)) {
        if (!isVerified) {
          const quarantinedRecord = deepFreeze(safeStructuredClone({
            id: 'mem_quar_' + Date.now() + '_' + secureRandomHex(4),
            content: entry.content,
            provenance,
            sourceType,
            trustScore,
            category: 'quarantine',
            layer: 'quarantine',
            isQuarantined: true,
            quarantineReason: hasPoisoningPattern ? 'Prompt injection / poisoning pattern detected' : 'Untrusted source for sensitive layer',
            targetLayer: layer,
            timestamp: entry.timestamp || Date.now(),
            userVerified: false
          }));
          this.quarantine.push(quarantinedRecord);

          const err = new Error('MEMORY_POISONING_BLOCKED: Untrusted memory entry or poisoning pattern detected without explicit user verification');
          err.code = 'MEMORY_POISONING_BLOCKED';
          err.layer = layer;
          err.sourceType = sourceType;
          err.trustScore = trustScore;
          err.quarantinedId = quarantinedRecord.id;
          throw err;
        }
      }

      const record = deepFreeze(safeStructuredClone({
        id: 'mem_' + Date.now() + '_' + secureRandomHex(4),
        content: entry.content,
        provenance,
        sourceType,
        trustScore,
        category: (layer === 'quarantine' ? 'quarantine' : (entry.category || 'general')),
        timestamp: entry.timestamp || Date.now(),
        userVerified: isVerified
      }));

      if (layer === 'semanticIndex') {
        this.semanticIndex.set(record.id, record);
        this._indexSemanticRecord(record);
      } else if (layer === 'quarantine') {
        this.quarantine.push(record);
      } else {
        this[layer].push(record);
        this._indexSemanticRecord(record);
      }

      return record;
    }

    verifyAndPromoteMemory(entryId, approvalSignature) {
      if (!entryId) {
        const err = new Error('INVALID_ARGUMENT: entryId is required');
        err.code = 'INVALID_ARGUMENT';
        throw err;
      }
      if (!approvalSignature) {
        const err = new Error('INVALID_APPROVAL_SIGNATURE: approvalSignature is required');
        err.code = 'INVALID_APPROVAL_SIGNATURE';
        throw err;
      }

      let foundRecord = null;
      let sourceLayer = null;
      let indexInLayer = -1;

      const qIdx = this.quarantine.findIndex(e => e.id === entryId);
      if (qIdx !== -1) {
        foundRecord = this.quarantine[qIdx];
        sourceLayer = 'quarantine';
        indexInLayer = qIdx;
      } else {
        for (const l of ['shortTerm', 'episodic', 'semanticIndex']) {
          if (l === 'semanticIndex') {
            if (this.semanticIndex.has(entryId)) {
              foundRecord = this.semanticIndex.get(entryId);
              sourceLayer = l;
              break;
            }
          } else {
            const idx = this[l].findIndex(e => e.id === entryId);
            if (idx !== -1) {
              foundRecord = this[l][idx];
              sourceLayer = l;
              indexInLayer = idx;
              break;
            }
          }
        }
      }

      if (!foundRecord) {
        const err = new Error(`MEMORY_ENTRY_NOT_FOUND: Memory entry ${entryId} not found`);
        err.code = 'MEMORY_ENTRY_NOT_FOUND';
        throw err;
      }

      const validHmac = _hmacSha256Hex(this.sessionKey, entryId);
      const altHmac = _sha256Hex(this.sessionKey + ':' + entryId);
      let isValidSig = (approvalSignature === validHmac || approvalSignature === altHmac);

      if (!isValidSig && typeof approvalSignature === 'string' && approvalSignature.startsWith('appr_')) {
        const peer = _getPeerApprovals();
        if (peer && typeof peer.verifyApprovalToken === 'function') {
          isValidSig = peer.verifyApprovalToken(approvalSignature);
        }
      }

      if (!isValidSig) {
        const err = new Error('INVALID_APPROVAL_SIGNATURE: HMAC approval signature validation failed');
        err.code = 'INVALID_APPROVAL_SIGNATURE';
        throw err;
      }

      if (sourceLayer === 'quarantine') {
        this.quarantine.splice(indexInLayer, 1);
      } else if (sourceLayer && sourceLayer !== 'semanticIndex') {
        this[sourceLayer].splice(indexInLayer, 1);
      } else if (sourceLayer === 'semanticIndex') {
        this.semanticIndex.delete(entryId);
      }

      const raw = {
        id: foundRecord.id,
        content: foundRecord.content,
        provenance: 'user_approved',
        sourceType: foundRecord.sourceType,
        trustScore: 1.0,
        category: 'verified',
        layer: 'longTerm',
        timestamp: Date.now(),
        userVerified: true,
        verifiedAt: Date.now(),
        promotedFrom: sourceLayer
      };
      const promotedRecord = deepFreeze(safeStructuredClone(raw));
      this.longTerm.push(promotedRecord);
      this._indexSemanticRecord(promotedRecord);
      return promotedRecord;
    }

    hybridSearch(query, options = {}) {
      const topK = options.topK !== undefined ? Number(options.topK) : 5;
      const minTrustScore = options.minTrustScore !== undefined ? Number(options.minTrustScore) : 0.0;
      const layer = options.layer || null;

      let candidates = [];
      if (layer === 'semanticIndex') {
        candidates = Array.from(this.semanticIndex.values());
      } else if (layer && Array.isArray(this[layer])) {
        candidates = [...this[layer]];
      } else {
        const seenIds = new Set();
        const all = [
          ...Array.from(this.semanticIndex.values()),
          ...this.longTerm,
          ...this.shortTerm,
          ...this.episodic
        ];
        for (const item of all) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            candidates.push(item);
          }
        }
      }

      // Filter out quarantined entries and entries below minTrustScore
      candidates = candidates.filter(e => {
        if (!e) return false;
        if (e.isQuarantined || e.category === 'quarantine') return false;
        const score = typeof e.trustScore === 'number' ? e.trustScore : 0.2;
        return score >= minTrustScore;
      });

      const queryStr = typeof query === 'string' ? query : (query && query.query ? String(query.query) : JSON.stringify(query || ''));
      const queryVec = computeTfVector(queryStr);

      const scored = candidates.map(doc => {
        let docVec = this._vectors.get(doc.id);
        if (!docVec) {
          const docText = typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content || '');
          docVec = computeTfVector(docText);
          this._vectors.set(doc.id, docVec);
        }
        const similarity = cosineSimilarity(queryVec, docVec);
        const trust = typeof doc.trustScore === 'number' ? doc.trustScore : 0.5;
        const hybridScore = (similarity * 0.7) + (trust * 0.3);
        return {
          ...doc,
          similarity,
          hybridScore,
          score: hybridScore
        };
      });

      scored.sort((a, b) => {
        if (Math.abs(b.score - a.score) > 1e-6) {
          return b.score - a.score;
        }
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      return scored.slice(0, Math.max(1, topK));
    }

    getMemories(layer) {
      if (layer === 'semanticIndex') {
        return Array.from(this.semanticIndex.values());
      }
      if (layer && Array.isArray(this[layer])) {
        return [...this[layer]];
      }
      return {
        shortTerm: [...this.shortTerm],
        longTerm: [...this.longTerm],
        episodic: [...this.episodic],
        quarantine: [...this.quarantine],
        semanticIndex: Array.from(this.semanticIndex.values())
      };
    }

    clearLayer(layer) {
      if (layer === 'semanticIndex') {
        this.semanticIndex.clear();
        this._vectors.clear();
        return;
      }
      if (layer === 'quarantine') {
        this.quarantine.length = 0;
        return;
      }
      if (layer && Array.isArray(this[layer])) {
        this[layer].length = 0;
        return;
      }
      this.shortTerm.length = 0;
      this.longTerm.length = 0;
      this.episodic.length = 0;
      this.quarantine.length = 0;
      this.semanticIndex.clear();
      this._vectors.clear();
    }

    exportState() {
      return {
        shortTerm: JSON.parse(JSON.stringify(this.shortTerm)),
        longTerm: JSON.parse(JSON.stringify(this.longTerm)),
        episodic: JSON.parse(JSON.stringify(this.episodic)),
        quarantine: JSON.parse(JSON.stringify(this.quarantine)),
        semanticIndex: Array.from(this.semanticIndex.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]),
        sessionKey: this.sessionKey
      };
    }

    restoreState(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return this;
      if (Array.isArray(snapshot.shortTerm)) {
        this.shortTerm = snapshot.shortTerm.map(r => deepFreeze(safeStructuredClone(r)));
        this.shortTerm.forEach(r => this._indexSemanticRecord(r));
      }
      if (Array.isArray(snapshot.longTerm)) {
        this.longTerm = snapshot.longTerm.map(r => deepFreeze(safeStructuredClone(r)));
        this.longTerm.forEach(r => this._indexSemanticRecord(r));
      }
      if (Array.isArray(snapshot.episodic)) {
        this.episodic = snapshot.episodic.map(r => deepFreeze(safeStructuredClone(r)));
        this.episodic.forEach(r => this._indexSemanticRecord(r));
      }
      if (Array.isArray(snapshot.quarantine)) {
        this.quarantine = snapshot.quarantine.map(r => deepFreeze(safeStructuredClone(r)));
      }
      if (Array.isArray(snapshot.semanticIndex)) {
        this.semanticIndex.clear();
        for (const [k, v] of snapshot.semanticIndex) {
          const rec = deepFreeze(safeStructuredClone(v));
          this.semanticIndex.set(k, rec);
          this._indexSemanticRecord(rec);
        }
      }
      if (typeof snapshot.sessionKey === 'string') {
        this.sessionKey = snapshot.sessionKey;
      }
      return this;
    }
  }

  let _defaultMemoryGovernance = new MemoryGovernance();
  function getMemoryGovernance() {
    return _defaultMemoryGovernance;
  }
  function resetMemoryGovernance() {
    _defaultMemoryGovernance = new MemoryGovernance();
    return _defaultMemoryGovernance;
  }

  // OpenTelemetry GenAI Semantic Conventions & Audit Persistence delegates
  function _getPeerApprovals() {
    if (typeof require === 'function') {
      try { return require('../security/approvals.js'); } catch (_) {}
    }
    return (typeof globalThis !== 'undefined' && globalThis.NexusApprovals) || null;
  }

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
      const peer = _getPeerApprovals();
      if (peer && peer.GenAISpan && this.constructor === GenAISpan) {
        return new peer.GenAISpan(operation, attributes);
      }
      this.name = String(operation || 'gen_ai.operation');
      this.attributes = { ...attributes };
    }
    setAttribute(k, v) { this.attributes[k] = v; return this; }
    setAttributes(a) { Object.assign(this.attributes, a); return this; }
    addEvent() { return this; }
    setStatus() { return this; }
    end() { return this; }
    toJSON() { return { name: this.name, attributes: this.attributes }; }
  }

  function createGenAISpan(operation, attributes = {}) {
    const peer = _getPeerApprovals();
    if (peer && typeof peer.createGenAISpan === 'function') {
      return peer.createGenAISpan(operation, attributes);
    }
    return new GenAISpan(operation, attributes);
  }

  function persistAuditTrail(storage) {
    const peer = _getPeerApprovals();
    if (peer && typeof peer.persistAuditTrail === 'function') {
      return peer.persistAuditTrail(storage);
    }
    return true;
  }

  function verifyAuditTrailIntegrity(storage, options = {}) {
    const peer = _getPeerApprovals();
    if (peer && typeof peer.verifyAuditTrailIntegrity === 'function') {
      return peer.verifyAuditTrailIntegrity(storage, options);
    }
    return true;
  }

  function saveTaskJournalToStorage(guard, customStorage) {
    if (typeof require === 'function') {
      try {
        const p = require('./persistence.js');
        if (p && typeof p.saveTaskJournalToStorage === 'function') {
          return p.saveTaskJournalToStorage(guard, customStorage);
        }
      } catch (_) {}
    }
    const target = (typeof globalThis !== 'undefined' && globalThis.NexusPersistence) || (typeof window !== 'undefined' && window.NexusPersistence);
    if (target && typeof target.saveTaskJournalToStorage === 'function') {
      return target.saveTaskJournalToStorage(guard, customStorage);
    }
    return null;
  }

  function loadTaskJournalFromStorage(arg1, arg2) {
    if (typeof require === 'function') {
      try {
        const p = require('./persistence.js');
        if (p && typeof p.loadTaskJournalFromStorage === 'function') {
          return p.loadTaskJournalFromStorage(arg1, arg2);
        }
      } catch (_) {}
    }
    const target = (typeof globalThis !== 'undefined' && globalThis.NexusPersistence) || (typeof window !== 'undefined' && window.NexusPersistence);
    if (target && typeof target.loadTaskJournalFromStorage === 'function') {
      return target.loadTaskJournalFromStorage(arg1, arg2);
    }
    return null;
  }

  function saveMemoryGovernanceToStorage(memGov, customStorage, customKey) {
    if (typeof require === 'function') {
      try {
        const p = require('./persistence.js');
        if (p && typeof p.saveMemoryGovernanceToStorage === 'function') {
          return p.saveMemoryGovernanceToStorage(memGov, customStorage, customKey);
        }
      } catch (_) {}
    }
    const target = (typeof globalThis !== 'undefined' && globalThis.NexusPersistence) || (typeof window !== 'undefined' && window.NexusPersistence);
    if (target && typeof target.saveMemoryGovernanceToStorage === 'function') {
      return target.saveMemoryGovernanceToStorage(memGov, customStorage, customKey);
    }
    return null;
  }

  function loadMemoryGovernanceFromStorage(arg1, arg2, arg3) {
    if (typeof require === 'function') {
      try {
        const p = require('./persistence.js');
        if (p && typeof p.loadMemoryGovernanceFromStorage === 'function') {
          return p.loadMemoryGovernanceFromStorage(arg1, arg2, arg3);
        }
      } catch (_) {}
    }
    const target = (typeof globalThis !== 'undefined' && globalThis.NexusPersistence) || (typeof window !== 'undefined' && window.NexusPersistence);
    if (target && typeof target.loadMemoryGovernanceFromStorage === 'function') {
      return target.loadMemoryGovernanceFromStorage(arg1, arg2, arg3);
    }
    return null;
  }

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    DEFAULT_WORKOUT_STUDIO_TEMPLATE,
    DEFAULT_MIN_TOKEN_RESERVATION,
    createInitialAppState,
    createInitialUiState,
    createProtectedStateProxy,
    hasDangerousKeysDeep,
    secureRandomHex,
    secureRandomId,
    StateStore,
    appendMessage,
    appState,
    uiState,
    AgentExecutionGuard,
    get _activeTaskExecutionGuard() { return _activeTaskExecutionGuard; },
    set _activeTaskExecutionGuard(v) { _activeTaskExecutionGuard = v; },
    getSessionExecutionGuard,
    resetTaskExecutionGuard,
    createSubagentGuard,
    _defaultSessionExecutionGuard,
    getDefaultSessionExecutionGuard,
    createGenAISpan,
    createSpan: createGenAISpan,
    GenAISpan,
    GEN_AI_SYSTEM,
    GEN_AI_OPERATIONS,
    GEN_AI_ATTRIBUTES,
    persistAuditTrail,
    verifyAuditTrailIntegrity,
    canonicalizeJson,
    sanitizeToolParams,
    CentralBudgetManager,
    allocateSubagentBudget,
    MemoryGovernance,
    getMemoryGovernance,
    resetMemoryGovernance,
    _sha256Hex,
    _sha256Pure,
    _hmacSha256Hex,
    deepFreeze,
    safeStructuredClone,
    tokenizeText,
    computeTfVector,
    cosineSimilarity,
    detectHiddenOrEncodedPoisoning,
    saveTaskJournalToStorage,
    loadTaskJournalFromStorage,
    saveMemoryGovernanceToStorage,
    loadMemoryGovernanceFromStorage
  };
});
