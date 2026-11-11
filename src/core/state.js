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
        if (prop === '_rawTarget') return obj;
        const val = Reflect.get(obj, prop, receiver);
        if (val && typeof val === 'object') {
          return createProtectedStateProxy(val);
        }
        return val;
      },
      set(obj, prop, value, receiver) {
        if (typeof prop === 'string' && DANGEROUS_KEYS.has(prop)) {
          return false;
        }
        if (value && typeof value === 'object') {
          for (const k of DANGEROUS_KEYS) {
            if (Object.prototype.hasOwnProperty.call(value, k)) {
              return false;
            }
          }
        }
        obj[prop] = value;
        return true;
      },
      defineProperty(obj, prop, descriptor) {
        if (typeof prop === 'string' && DANGEROUS_KEYS.has(prop)) {
          return false;
        }
        return Reflect.defineProperty(obj, prop, descriptor);
      },
      deleteProperty(obj, prop) {
        if (typeof prop === 'string' && DANGEROUS_KEYS.has(prop)) {
          return false;
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
    return proxy;
  }

  const appState = createProtectedStateProxy(createInitialAppState());
  const uiState = createProtectedStateProxy(createInitialUiState());

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    DEFAULT_WORKOUT_STUDIO_TEMPLATE,
    createInitialAppState,
    createInitialUiState,
    createProtectedStateProxy,
    appState,
    uiState
  };
});
