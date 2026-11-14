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

  class AgentExecutionGuard {
    constructor(options = {}) {
      this.maxSteps = options.maxSteps !== undefined ? Number(options.maxSteps) : 15;
      this.maxToolCalls = options.maxToolCalls !== undefined ? Number(options.maxToolCalls) : 20;
      this.maxTokenBudget = options.maxTokenBudget !== undefined ? Number(options.maxTokenBudget) : 100000;
      this.maxDurationMs = options.maxDurationMs !== undefined ? Number(options.maxDurationMs) : 120000;
      this.currentSteps = 0;
      this.currentToolCalls = 0;
      this.usedTokens = 0;
      this.startTime = Date.now();
      this.callHistory = [];
      this.abortController = (typeof AbortController !== 'undefined')
        ? new AbortController()
        : { signal: { aborted: false }, abort(reason) { this.signal.aborted = true; this.signal.reason = reason; } };
      this.cancelled = false;
      this.cancelReason = null;
      this._pendingReservations = new Map();
    }

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
      return `${t}::${p}`;
    }

    detectLoop(toolName, params) {
      const hasArgs = (toolName !== undefined && toolName !== null);
      const fp = hasArgs ? this._fingerprint(toolName, params) : null;
      const historyFps = this.callHistory.map(entry => entry.fingerprint);
      const fullSeq = hasArgs ? [...historyFps, fp] : historyFps;
      const m = fullSeq.length;

      // 1. 3 consecutive identical calls (1-step cycle: A -> A -> A)
      if (m >= 3) {
        if (fullSeq[m - 1] === fullSeq[m - 2] && fullSeq[m - 2] === fullSeq[m - 3]) {
          const effectiveTool = toolName || this.callHistory[this.callHistory.length - 1]?.toolName || 'tool';
          const err = new Error(`LOOP_DETECTED: 3 consecutive calls with identical tool & params fingerprint (${effectiveTool})`);
          err.code = 'LOOP_DETECTED';
          err.toolName = effectiveTool;
          throw err;
        }
      }

      // 2. Alternating 2-step cycle (A -> B -> A -> B -> A -> B, 3 cycles of 2-step pattern)
      if (m >= 6) {
        const c1 = fullSeq[m - 1]; // B
        const c2 = fullSeq[m - 2]; // A
        if (
          c1 !== c2 &&
          fullSeq[m - 3] === c1 &&
          fullSeq[m - 4] === c2 &&
          fullSeq[m - 5] === c1 &&
          fullSeq[m - 6] === c2
        ) {
          const histLen = this.callHistory.length;
          const toolA = (hasArgs ? this.callHistory[histLen - 1]?.toolName : this.callHistory[histLen - 2]?.toolName) || 'toolA';
          const toolB = (hasArgs ? toolName : this.callHistory[histLen - 1]?.toolName) || 'toolB';
          const err = new Error(`LOOP_DETECTED: Alternating 2-step cycle detected (3 cycles of ${toolA} -> ${toolB})`);
          err.code = 'LOOP_DETECTED';
          err.toolName = toolB;
          throw err;
        }
      }

      // 3. Alternating 3-step cycle (A -> B -> C -> A -> B -> C -> A -> B -> C, 3 cycles of 3-step pattern)
      if (m >= 9) {
        const c1 = fullSeq[m - 1]; // C
        const c2 = fullSeq[m - 2]; // B
        const c3 = fullSeq[m - 3]; // A
        if (
          (c1 !== c2 || c2 !== c3) &&
          fullSeq[m - 4] === c1 &&
          fullSeq[m - 5] === c2 &&
          fullSeq[m - 6] === c3 &&
          fullSeq[m - 7] === c1 &&
          fullSeq[m - 8] === c2 &&
          fullSeq[m - 9] === c3
        ) {
          const histLen = this.callHistory.length;
          const toolA = (hasArgs ? this.callHistory[histLen - 2]?.toolName : this.callHistory[histLen - 3]?.toolName) || 'toolA';
          const toolB = (hasArgs ? this.callHistory[histLen - 1]?.toolName : this.callHistory[histLen - 2]?.toolName) || 'toolB';
          const toolC = (hasArgs ? toolName : this.callHistory[histLen - 1]?.toolName) || 'toolC';
          const err = new Error(`LOOP_DETECTED: Alternating 3-step cycle detected (3 cycles of ${toolA} -> ${toolB} -> ${toolC})`);
          err.code = 'LOOP_DETECTED';
          err.toolName = toolC;
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
      const tok = Math.max(0, Number(tokens) || 0);
      this.usedTokens += tok;
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
      return this.usedTokens;
    }

    reserveTokens(callId, estimatedTokens) {
      const estimated = Math.max(0, Number(estimatedTokens) || 0);
      const pendingTotal = Array.from(this._pendingReservations.values()).reduce((sum, v) => sum + v, 0);
      if ((this.usedTokens + pendingTotal + estimated) > this.maxTokenBudget) {
        const err = new Error(`TOKEN_BUDGET_EXCEEDED: Reserving ${estimated} tokens exceeds budget (${this.maxTokenBudget})`);
        err.code = 'TOKEN_BUDGET_EXCEEDED';
        throw err;
      }
      const id = String(callId || ('res_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)));
      this._pendingReservations.set(id, estimated);
      const remainingBudget = this.maxTokenBudget - (this.usedTokens + pendingTotal + estimated);
      return { callId: id, reservedTokens: estimated, remainingBudget };
    }

    settleTokens(callId, actualTokens) {
      const actual = Math.max(0, Number(actualTokens) || 0);
      const id = String(callId || '');
      const reserved = this._pendingReservations.get(id) || 0;
      this._pendingReservations.delete(id);
      this.usedTokens += actual;
      return { callId: id, actualTokens: actual, usedTokens: this.usedTokens, releasedReservation: reserved };
    }

    releaseReservation(callId) {
      return this._pendingReservations.delete(String(callId || ''));
    }

    exportTaskJournal() {
      return {
        currentSteps: this.currentSteps,
        currentToolCalls: this.currentToolCalls,
        usedTokens: this.usedTokens,
        startTime: this.startTime,
        callHistory: JSON.parse(JSON.stringify(this.callHistory)),
        cancelled: Boolean(this.cancelled),
        cancelReason: this.cancelReason || null,
        maxSteps: this.maxSteps,
        maxToolCalls: this.maxToolCalls,
        maxTokenBudget: this.maxTokenBudget,
        maxDurationMs: this.maxDurationMs
      };
    }

    restoreTaskJournal(journal) {
      if (!journal || typeof journal !== 'object') {
        return this;
      }
      if (typeof journal.currentSteps === 'number') this.currentSteps = journal.currentSteps;
      if (typeof journal.currentToolCalls === 'number') this.currentToolCalls = journal.currentToolCalls;
      if (typeof journal.usedTokens === 'number') this.usedTokens = journal.usedTokens;
      if (typeof journal.startTime === 'number') this.startTime = journal.startTime;
      if (Array.isArray(journal.callHistory)) {
        this.callHistory = JSON.parse(JSON.stringify(journal.callHistory));
      }
      if (journal.cancelled !== undefined) this.cancelled = Boolean(journal.cancelled);
      if (journal.cancelReason !== undefined) this.cancelReason = journal.cancelReason;
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

    const parentRemainingSteps = Math.max(0, (parentGuard.maxSteps ?? Infinity) - (parentGuard.currentSteps ?? 0));
    const parentRemainingToolCalls = Math.max(0, (parentGuard.maxToolCalls ?? Infinity) - (parentGuard.currentToolCalls ?? 0));
    const parentRemainingTokens = Math.max(0, (parentGuard.maxTokenBudget ?? Infinity) - (parentGuard.usedTokens ?? 0));
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
      maxDurationMs: childMaxDurationMs
    });

    child.parentGuard = parentGuard;

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
        Planner: { stepsRatio: 0.25, tokensRatio: 0.25, toolCallsRatio: 0.2 },
        Researcher: { stepsRatio: 0.35, tokensRatio: 0.35, toolCallsRatio: 0.4 },
        Coder: { stepsRatio: 0.35, tokensRatio: 0.35, toolCallsRatio: 0.35 },
        Verifier: { stepsRatio: 0.15, tokensRatio: 0.15, toolCallsRatio: 0.15 }
      };
    }

    static allocateSubagentBudget(parentGuard, role, budgetOptions = {}) {
      if (!parentGuard) {
        throw new Error('parentGuard is required to allocate subagent budget');
      }
      const roleKey = String(role || 'Researcher').trim();
      const ratios = CentralBudgetManager.getDefaultRoleRatios()[roleKey] || { stepsRatio: 0.25, tokensRatio: 0.25, toolCallsRatio: 0.25 };

      const parentRemainingSteps = Math.max(0, (parentGuard.maxSteps ?? Infinity) - (parentGuard.currentSteps ?? 0));
      const parentRemainingToolCalls = Math.max(0, (parentGuard.maxToolCalls ?? Infinity) - (parentGuard.currentToolCalls ?? 0));
      const parentRemainingTokens = Math.max(0, (parentGuard.maxTokenBudget ?? Infinity) - (parentGuard.usedTokens ?? 0));
      const parentRemainingDuration = (parentGuard.maxDurationMs !== undefined && parentGuard.startTime !== undefined)
        ? Math.max(0, (parentGuard.startTime + parentGuard.maxDurationMs) - Date.now())
        : (parentGuard.maxDurationMs || 120000);

      const maxSteps = budgetOptions.maxSteps !== undefined
        ? Math.min(Number(budgetOptions.maxSteps), parentRemainingSteps)
        : (parentRemainingSteps !== Infinity ? Math.max(1, Math.floor(parentRemainingSteps * (ratios.stepsRatio || 0.25))) : 15);

      const maxToolCalls = budgetOptions.maxToolCalls !== undefined
        ? Math.min(Number(budgetOptions.maxToolCalls), parentRemainingToolCalls)
        : (parentRemainingToolCalls !== Infinity ? Math.max(1, Math.floor(parentRemainingToolCalls * (ratios.toolCallsRatio || 0.25))) : 20);

      const maxTokenBudget = budgetOptions.maxTokenBudget !== undefined
        ? Math.min(Number(budgetOptions.maxTokenBudget), parentRemainingTokens)
        : (parentRemainingTokens !== Infinity ? Math.max(100, Math.floor(parentRemainingTokens * (ratios.tokensRatio || 0.25))) : 100000);

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

    allocateSubagentBudget(parentGuard, role, budgetOptions) {
      return CentralBudgetManager.allocateSubagentBudget(parentGuard, role, budgetOptions);
    }
  }

  function allocateSubagentBudget(parentGuard, role, budgetOptions) {
    return CentralBudgetManager.allocateSubagentBudget(parentGuard, role, budgetOptions);
  }

  /**
   * OWASP ASI06 Defense: Memory & Context Poisoning Guard
   */
  const MEMORY_POISONING_REGEX = /ignore\s+previous\s+instructions|system\s+override|send\s+(api\s*)?key|reveal\s+(secret|password|token)|exfiltrate/i;

  class MemoryGovernance {
    constructor() {
      this.shortTerm = [];
      this.longTerm = [];
      this.episodic = [];
      this.semanticIndex = new Map();
    }

    registerMemoryEntry(layer, entry) {
      if (!layer || (layer !== 'shortTerm' && layer !== 'longTerm' && layer !== 'episodic' && layer !== 'semanticIndex')) {
        throw new Error(`Invalid memory layer: ${layer}. Expected shortTerm, longTerm, episodic, or semanticIndex`);
      }
      if (!entry || typeof entry !== 'object') {
        throw new Error('Memory entry must be a non-null object');
      }

      const contentStr = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content ?? '');
      const provenance = String(entry.provenance || 'system');
      const sourceType = String(entry.sourceType || 'user').toLowerCase();
      const trustScore = typeof entry.trustScore === 'number' ? entry.trustScore : Number(entry.trustScore ?? 1.0);
      const userVerified = Boolean(entry.userVerified);

      const hasPoisoningPattern = MEMORY_POISONING_REGEX.test(contentStr);
      const isSensitiveLayer = layer === 'longTerm' || Boolean(entry.isSystemPrompt || entry.systemPrompt || entry.isRoutine || entry.routine);
      const isUntrustedSource = sourceType === 'web' || sourceType === 'mcp' || sourceType === 'untrusted' || (typeof trustScore === 'number' && trustScore < 0.8);

      // Defense against OWASP ASI06: Memory & Context Poisoning
      if (hasPoisoningPattern || (isSensitiveLayer && isUntrustedSource)) {
        if (!userVerified) {
          const err = new Error('MEMORY_POISONING_BLOCKED: Untrusted memory entry or poisoning pattern detected without explicit user verification');
          err.code = 'MEMORY_POISONING_BLOCKED';
          err.layer = layer;
          err.sourceType = sourceType;
          err.trustScore = trustScore;
          throw err;
        }
      }

      const record = Object.freeze({
        id: 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        content: entry.content,
        provenance,
        sourceType,
        trustScore,
        timestamp: entry.timestamp || Date.now(),
        userVerified
      });

      if (layer === 'semanticIndex') {
        this.semanticIndex.set(record.id, record);
      } else {
        this[layer].push(record);
      }

      return record;
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
        semanticIndex: Array.from(this.semanticIndex.values())
      };
    }

    clearLayer(layer) {
      if (layer === 'semanticIndex') {
        this.semanticIndex.clear();
        return;
      }
      if (layer && Array.isArray(this[layer])) {
        this[layer].length = 0;
        return;
      }
      this.shortTerm.length = 0;
      this.longTerm.length = 0;
      this.episodic.length = 0;
      this.semanticIndex.clear();
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

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    DEFAULT_WORKOUT_STUDIO_TEMPLATE,
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
    resetMemoryGovernance
  };
});
