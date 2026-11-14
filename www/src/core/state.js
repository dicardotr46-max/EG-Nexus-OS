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
    }

    _fingerprint(toolName, params) {
      const t = String(toolName || '').trim();
      let p = '';
      try {
        if (params !== undefined && params !== null) {
          p = (typeof params === 'object') ? JSON.stringify(params) : String(params);
        }
      } catch (_) {
        p = String(params || '');
      }
      return `${t}::${p}`;
    }

    detectLoop(toolName, params) {
      const fp = this._fingerprint(toolName, params);
      const n = this.callHistory.length;
      if (n >= 2) {
        const prev1 = this.callHistory[n - 1];
        const prev2 = this.callHistory[n - 2];
        if (prev1 && prev2 && prev1.fingerprint === fp && prev2.fingerprint === fp) {
          const err = new Error(`LOOP_DETECTED: 3 consecutive calls with identical tool & params fingerprint (${toolName})`);
          err.code = 'LOOP_DETECTED';
          err.toolName = toolName;
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
        if (params && typeof params === 'object') {
          safeParams = JSON.parse(JSON.stringify(params));
        }
      } catch (_) {
        safeParams = String(params || '');
      }
      const entry = {
        toolName: String(toolName || ''),
        params: safeParams,
        fingerprint: this._fingerprint(toolName, params),
        tokens: tok,
        timestamp: Date.now()
      };
      this.callHistory.push(entry);
      return entry;
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

  // Default Session Execution Guard
  let _defaultSessionExecutionGuard = new AgentExecutionGuard();
  function getDefaultSessionExecutionGuard(options = {}) {
    return new AgentExecutionGuard(options);
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

  const GenAISpan = (function() {
    const peer = _getPeerApprovals();
    return (peer && peer.GenAISpan) || class GenAISpan {
      constructor(operation, attributes = {}) {
        this.name = String(operation || 'gen_ai.operation');
        this.attributes = { ...attributes };
      }
      setAttribute(k, v) { this.attributes[k] = v; return this; }
      setAttributes(a) { Object.assign(this.attributes, a); return this; }
      addEvent() { return this; }
      setStatus() { return this; }
      end() { return this; }
      toJSON() { return { name: this.name, attributes: this.attributes }; }
    };
  })();

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
    _defaultSessionExecutionGuard,
    getDefaultSessionExecutionGuard,
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
