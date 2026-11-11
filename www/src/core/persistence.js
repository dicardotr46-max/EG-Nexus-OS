/**
 * EG-Nexus-OS — Core Persistence Module
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
    target._nexusCorePersistence = exports;
    target.NexusPersistence = exports;
    if (typeof exports.queueSessionSecretsWrite === 'function') {
      target.queueSessionSecretsWrite = target.queueSessionSecretsWrite || exports.queueSessionSecretsWrite;
      target.getSessionWriteState = target.getSessionWriteState || exports.getSessionWriteState;
      target.getSessionWriteRevision = target.getSessionWriteRevision || exports.getSessionWriteRevision;
      target.resetSessionWriteQueue = target.resetSessionWriteQueue || exports.resetSessionWriteQueue;
    }
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
  const LEGACY_STORAGE_KEY = STORAGE_KEYS.legacy;
  const SESSION_SECRETS_KEY = STORAGE_KEY + '_session_secrets';

  function getLocalStorage() {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  }

  function nexusStorageGet(key) {
    try {
      const storage = getLocalStorage();
      if (storage) {
        return storage.getItem(String(key)) || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function nexusStorageSet(key, value) {
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(String(key), String(value));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function nexusStorageRemove(key) {
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.removeItem(String(key));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function migrateLegacyStorage(storage = getLocalStorage()) {
    try {
      if (!storage) return false;
      const current = typeof storage.getItem === 'function' ? storage.getItem(STORAGE_KEY) : null;
      if (!current) {
        const legacy = typeof storage.getItem === 'function' ? storage.getItem(LEGACY_STORAGE_KEY) : null;
        if (legacy) {
          if (typeof storage.setItem === 'function') storage.setItem(STORAGE_KEY, legacy);
          if (typeof storage.removeItem === 'function') storage.removeItem(LEGACY_STORAGE_KEY);
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const API_KEY_NAMES = [
    'gemini', 'openrouter', 'deepseek', 'grok', 'kimi', 'tavily', 'perplx',
    'openai', 'anthropic', 'google', 'groq', 'mistral', 'perplexica', 'cohere'
  ];

  function emptyApiKeys() {
    const names = (typeof globalThis !== 'undefined' && Array.isArray(globalThis.API_KEY_NAMES))
      ? globalThis.API_KEY_NAMES
      : (typeof window !== 'undefined' && Array.isArray(window.API_KEY_NAMES)
        ? window.API_KEY_NAMES
        : API_KEY_NAMES);
    return names.reduce((out, name) => { out[name] = ''; return out; }, {});
  }

  function getStorageSizeEstimate(key = STORAGE_KEY) {
    try {
      const raw = nexusStorageGet(key) || '';
      /* istanbul ignore else */
      if (typeof Blob !== 'undefined') {
        return new Blob([raw]).size;
      } else /* istanbul ignore next */ if (typeof Buffer !== 'undefined') {
        return Buffer.byteLength(raw, 'utf8');
      }
      /* istanbul ignore next */
      return raw.length;
    } catch (e) {
      return 0;
    }
  }

  function buildPersistedState(state) {
    if (!state || typeof state !== 'object') return {};
    const persisted = JSON.parse(JSON.stringify(state));
    if (state.apiKeys !== undefined) {
      const emptyKeys = emptyApiKeys();
      if (persisted.apiKeys && typeof persisted.apiKeys === 'object' && !Array.isArray(persisted.apiKeys)) {
        Object.keys(persisted.apiKeys).forEach(k => {
          emptyKeys[k] = '';
        });
      }
      persisted.apiKeys = emptyKeys;
    } else {
      delete persisted.apiKeys;
    }
    if (persisted.appConnections && typeof persisted.appConnections === 'object' && !Array.isArray(persisted.appConnections)) {
      Object.keys(persisted.appConnections).forEach(id => {
        if (persisted.appConnections[id] && typeof persisted.appConnections[id] === 'object') {
          persisted.appConnections[id].token = '';
          if (Array.isArray(persisted.appConnections[id].accounts)) {
            persisted.appConnections[id].accounts.forEach(acc => {
              if (acc && typeof acc === 'object') {
                acc.token = '';
                acc.refreshToken = '';
              }
            });
          }
        }
      });
    }
    if (persisted.localComputerConfig && typeof persisted.localComputerConfig === 'object') {
      persisted.localComputerConfig.bridgeToken = '';
    }
    if (persisted.cloudConfig && typeof persisted.cloudConfig === 'object') {
      persisted.cloudConfig.workerSecret = '';
      persisted.cloudConfig.supabaseKey = '';
      persisted.cloudConfig.supabaseAuthToken = '';
    }
    if (persisted.telegramConfig && typeof persisted.telegramConfig === 'object') {
      persisted.telegramConfig.botToken = '';
    }

    const MAX_PERSISTED_MSGS_PER_CHAT = 300;
    if (Array.isArray(persisted.chats)) {
      persisted.chats.forEach(c => {
        if (c && Array.isArray(c.messages) && c.messages.length > MAX_PERSISTED_MSGS_PER_CHAT) {
          c.messages = c.messages.slice(-MAX_PERSISTED_MSGS_PER_CHAT);
        }
      });
    }
    return persisted;
  }

  function sanitizeLoadedState(s, fallbackState = (typeof globalThis !== 'undefined' && globalThis.appState ? globalThis.appState : {})) {
    const base = (fallbackState && typeof fallbackState === 'object') ? fallbackState : {};
    const src = (s && typeof s === 'object' && !Array.isArray(s)) ? { ...base, ...s } : { ...base };
    const validObjs = (arr, def = []) => Array.isArray(arr) ? arr.filter(x => x && typeof x === 'object' && !Array.isArray(x)) : def;

    src.profileName = (typeof src.profileName === 'string' && src.profileName.trim()) ? src.profileName.trim() : 'Ali';
    src.dreamMemory = typeof src.dreamMemory === 'string' ? src.dreamMemory : (base.dreamMemory || '');
    src.effortMode = ['light', 'standard', 'high', 'ultra'].includes(src.effortMode) ? src.effortMode : 'standard';
    src.diffOnlyMode = typeof src.diffOnlyMode === 'boolean' ? src.diffOnlyMode : true;

    const turnsNum = Number(src.maxGroupTurns);
    src.maxGroupTurns = Number.isFinite(turnsNum) ? Math.min(6, Math.max(1, Math.round(turnsNum))) : 3;

    const tokNum = Number(src.totalTokensUsed);
    src.totalTokensUsed = (Number.isFinite(tokNum) && tokNum >= 0) ? Math.round(tokNum) : 0;

    const costNum = Number(src.totalEstimatedCostUSD);
    src.totalEstimatedCostUSD = (Number.isFinite(costNum) && costNum >= 0) ? costNum : 0;

    const rawKeys = (src.apiKeys && typeof src.apiKeys === 'object' && !Array.isArray(src.apiKeys)) ? src.apiKeys : {};
    src.apiKeys = {
      gemini: typeof rawKeys.gemini === 'string' ? rawKeys.gemini.trim() : '',
      deepseek: typeof rawKeys.deepseek === 'string' ? rawKeys.deepseek.trim() : '',
      kimi: typeof rawKeys.kimi === 'string' ? rawKeys.kimi.trim() : '',
      grok: typeof rawKeys.grok === 'string' ? rawKeys.grok.trim() : '',
      openrouter: typeof rawKeys.openrouter === 'string' ? rawKeys.openrouter.trim() : '',
      tavily: typeof rawKeys.tavily === 'string' ? rawKeys.tavily.trim() : ''
    };

    const isSafeConn = (typeof globalThis !== 'undefined' && typeof globalThis.isSafeConnectionId === 'function')
      ? globalThis.isSafeConnectionId
      : (id) => typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);

    const rawConns = (src.appConnections && typeof src.appConnections === 'object' && !Array.isArray(src.appConnections)) ? src.appConnections : {};
    const cleanConns = {};
    Object.keys(rawConns).forEach(k => {
      if (!isSafeConn(k)) return;
      const c = rawConns[k];
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        Object.defineProperty(cleanConns, k, { value: {
          ...c,
          accounts: Array.isArray(c.accounts) ? c.accounts.map((a, accountIdx) => {
            if (typeof a === 'string' && a.trim()) return a.trim();
            if (a && typeof a === 'object' && !Array.isArray(a)) {
              const email = typeof a.email === 'string' ? a.email.trim().slice(0, 320) : '';
              const name = typeof (a.name || a.displayName) === 'string' ? String(a.name || a.displayName).trim().slice(0, 160) : '';
              if (!email && !name) return null;
              return { id: typeof a.id === 'string' ? a.id.slice(0, 160) : `account_${accountIdx}`, email, name: name || email.split('@')[0] || 'Connected account', avatar: typeof a.avatar === 'string' ? a.avatar.slice(0, 2) : (name[0] || email[0] || 'U'), connectedAt: typeof a.connectedAt === 'string' ? a.connectedAt : '' };
            }
            return null;
          }).filter(Boolean) : [],
          token: typeof c.token === 'string' ? c.token.trim() : '',
          mcpEnabled: Boolean(c.mcpEnabled),
          connectedAt: typeof c.connectedAt === 'string' ? c.connectedAt : ''
        }, enumerable: true, writable: true, configurable: true });
      }
    });
    src.appConnections = cleanConns;
    src.addedAppIds = Array.isArray(src.addedAppIds) ? src.addedAppIds.filter(x => typeof x === 'string' && x.trim()) : [];

    const genId = (typeof globalThis !== 'undefined' && typeof globalThis.generateUniqueId === 'function')
      ? globalThis.generateUniqueId
      : (p = 'id') => p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

    const sanitizeAvatar = (typeof globalThis !== 'undefined' && typeof globalThis.sanitizeAvatarSpec === 'function')
      ? globalThis.sanitizeAvatarSpec
      : (rawAvatar, fallbackColor = '#1d8cf8', fallbackShape = 'roundedSquare', fallbackFace = 'wink') => {
          const av = (rawAvatar && typeof rawAvatar === 'object' && !Array.isArray(rawAvatar)) ? rawAvatar : {};
          return {
            mode: ['create', 'edit'].includes(av.mode) ? av.mode : 'create',
            color: typeof av.color === 'string' ? av.color : fallbackColor,
            shape: typeof av.shape === 'string' ? av.shape : fallbackShape,
            face: typeof av.face === 'string' ? av.face : fallbackFace
          };
        };

    const assertUniq = (typeof globalThis !== 'undefined' && typeof globalThis.assertUniqueIds === 'function')
      ? globalThis.assertUniqueIds
      : (items, label) => {
          if (!Array.isArray(items)) return false;
          const seen = new Set();
          let modified = false;
          items.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            if (!item.id || seen.has(item.id)) {
              item.id = genId(label + '_' + idx);
              modified = true;
            }
            seen.add(item.id);
          });
          return modified;
        };

    src.agentsCatalog = validObjs(src.agentsCatalog, []).map((ag, idx) => ({
      ...ag,
      id: (typeof ag.id === 'string' && ag.id.trim()) ? ag.id.trim() : genId('ag_' + idx),
      name: (typeof ag.name === 'string' && ag.name.trim()) ? ag.name.trim() : 'Agent ' + (idx + 1),
      model: (typeof ag.model === 'string' && ag.model.trim()) ? ag.model.trim() : 'gemini-3.8-flash',
      systemPrompt: typeof ag.systemPrompt === 'string' ? ag.systemPrompt : '',
      memory: typeof ag.memory === 'string' ? ag.memory : '',
      presetKey: typeof ag.presetKey === 'string' ? ag.presetKey : '',
      isPreset: Boolean(ag.isPreset || ag.presetKey),
      files: Array.isArray(ag.files) ? ag.files.filter(f => (typeof f === 'string' && f.trim()) || (f && typeof f === 'object' && typeof f.name === 'string')) : [],
      avatar: sanitizeAvatar(ag.avatar)
    }));

    src.chats = validObjs(src.chats, []).map((c, idx) => ({
      ...c,
      id: (typeof c.id === 'string' && c.id.trim()) ? c.id.trim() : genId('chat_' + idx),
      title: (typeof c.title === 'string' && c.title.trim()) ? c.title.trim() : 'گفتگو',
      isGroup: Boolean(c.isGroup),
      memberIds: Array.isArray(c.memberIds) ? c.memberIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()) : [],
      updatedAt: (typeof c.updatedAt === 'string' && c.updatedAt.trim()) ? c.updatedAt : 'الان',
      updatedAtTs: Number.isFinite(Number(c.updatedAtTs)) ? Number(c.updatedAtTs) : 0,
      draftText: typeof c.draftText === 'string' ? c.draftText.slice(0, 50000) : '',
      messages: validObjs(c.messages, []).slice(-300).map((m, mIdx) => ({
        ...m,
        id: (typeof m.id === 'string' && m.id.trim()) ? m.id.trim() : genId('m_' + mIdx),
        senderType: ['user', 'agent', 'system'].includes(m.senderType) ? m.senderType : 'agent',
        senderId: typeof m.senderId === 'string' ? m.senderId.trim() : '',
        senderName: typeof m.senderName === 'string' ? m.senderName : '',
        text: String(m.text ?? ''),
        options: Array.isArray(m.options) ? m.options.filter(o => typeof o === 'string' && o.trim()) : [],
        attachmentName: typeof m.attachmentName === 'string' ? m.attachmentName : '',
        attachmentImage: typeof m.attachmentImage === 'string' ? m.attachmentImage : '',
        attachmentMime: typeof m.attachmentMime === 'string' ? m.attachmentMime : '',
        attachmentTextSnippet: typeof m.attachmentTextSnippet === 'string' ? m.attachmentTextSnippet : '',
        reaction: typeof m.reaction === 'string' ? m.reaction : 'eyes',
        selfReviewed: Boolean(m.selfReviewed),
        isSimulated: Boolean(m.isSimulated),
        chattedWith: typeof m.chattedWith === 'string' ? m.chattedWith : '',
        chattedWithId: typeof m.chattedWithId === 'string' ? m.chattedWithId.trim() : '',
        timestamp: typeof m.timestamp === 'string' ? m.timestamp : 'الان'
      }))
    }));

    src.skills = validObjs(src.skills, base.skills || []).map((sk, idx) => ({
      ...sk,
      id: (typeof sk.id === 'string' && sk.id.trim()) ? sk.id.trim() : genId('sk_' + idx),
      title: (typeof sk.title === 'string' && sk.title.trim()) ? sk.title.trim() : 'Skill ' + (idx + 1),
      source: (typeof sk.source === 'string' && sk.source.trim()) ? sk.source.trim() : 'Custom Skill',
      desc: String(sk.desc ?? '')
    }));
    const agentsRepaired = assertUniq(src.agentsCatalog, 'agent');
    const chatsRepaired = assertUniq(src.chats, 'chat');
    src._idsRepaired = Boolean(agentsRepaired || chatsRepaired);
    src.skillsCatalog = src.skills;

    const workoutTemplate = (typeof globalThis !== 'undefined' && globalThis.DEFAULT_WORKOUT_STUDIO_TEMPLATE) || '';
    if (typeof src.studioCode !== 'string' || !src.studioCode.trim()) {
      src.studioCode = workoutTemplate;
    }
    src.activeChatId = (typeof src.activeChatId === 'string' && src.activeChatId.trim()) ? src.activeChatId.trim() : null;
    src.activeAgentProfileId = (typeof src.activeAgentProfileId === 'string' && src.activeAgentProfileId.trim()) ? src.activeAgentProfileId.trim() : null;
    if (!src.chats.some(c => c.id === src.activeChatId)) src.activeChatId = null;
    if (!src.agentsCatalog.some(a => a.id === src.activeAgentProfileId)) src.activeAgentProfileId = null;
    return src;
  }

  // Conflict Recording & Notification Bus
  const _conflictEvents = [];
  const MAX_CONFLICT_LOGS = 100;
  const _conflictListeners = new Set();

  function recordConflictEvent(event) {
    if (!event || typeof event !== 'object') return null;
    const item = {
      ...event,
      timestamp: event.timestamp || Date.now()
    };
    _conflictEvents.push(item);
    if (_conflictEvents.length > MAX_CONFLICT_LOGS) {
      _conflictEvents.shift();
    }
    _conflictListeners.forEach(fn => {
      try { fn(item); } catch (e) {}
    });
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('nexus:conflict', { detail: item }));
      } catch (e) {}
    }
    return item;
  }

  function getConflictHistory() {
    return _conflictEvents.slice();
  }

  function clearConflictHistory() {
    _conflictEvents.length = 0;
  }

  function onConflict(listener) {
    if (typeof listener === 'function') {
      _conflictListeners.add(listener);
      return () => _conflictListeners.delete(listener);
    }
    return () => {};
  }

  function getStateRevision(state) {
    if (!state || typeof state !== 'object') return 0;
    const direct = Number(state.state_revision ?? state.stateRevision);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const cloudRev = Number(state.cloudConfig?.stateRevision ?? state.cloudConfig?.state_revision);
    if (Number.isFinite(cloudRev) && cloudRev > 0) return cloudRev;
    return 1;
  }

  function getItemTimestamp(item) {
    if (!item || typeof item !== 'object') return 0;
    if (Number.isFinite(Number(item.updatedAtTs))) return Number(item.updatedAtTs);
    const dateFields = [item.updated_at, item.updatedAt, item.timestamp, item.lastRunAt, item.created_at, item.createdAt];
    for (const d of dateFields) {
      if (typeof d === 'string' && d.trim()) {
        const parsed = new Date(d).getTime();
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      } else if (Number.isFinite(Number(d)) && Number(d) > 0) {
        return Number(d);
      }
    }
    return 0;
  }

  function getItemVersion(item) {
    if (!item || typeof item !== 'object') return 0;
    return Number(item.version ?? item.revision ?? 0) || 0;
  }

  function mergeArrayById(fieldName, localArr, remoteArr, onConflictFn = recordConflictEvent) {
    const listA = Array.isArray(localArr) ? localArr : [];
    const listB = Array.isArray(remoteArr) ? remoteArr : [];

    const map = new Map();
    const order = [];

    listA.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id ?? idx);
      map.set(id, { item, origin: 'local' });
      order.push(id);
    });

    listB.forEach((remoteItem, idx) => {
      if (!remoteItem || typeof remoteItem !== 'object') return;
      const id = String(remoteItem.id ?? idx);

      if (!map.has(id)) {
        map.set(id, { item: remoteItem, origin: 'remote' });
        order.push(id);
        return;
      }

      const existing = map.get(id);
      const localItem = existing.item;

      const localVer = getItemVersion(localItem);
      const remoteVer = getItemVersion(remoteItem);

      let winner = 'local';
      let resolved = localItem;

      if (remoteVer > localVer) {
        winner = 'remote';
        resolved = remoteItem;
      } else if (localVer > remoteVer) {
        winner = 'local';
        resolved = localItem;
      } else {
        const localTs = getItemTimestamp(localItem);
        const remoteTs = getItemTimestamp(remoteItem);
        if (remoteTs > localTs) {
          winner = 'remote';
          resolved = remoteItem;
        } else {
          winner = 'local';
          resolved = localItem;
        }
      }

      const isDifferent = JSON.stringify(localItem) !== JSON.stringify(remoteItem);
      if (isDifferent) {
        const conflict = {
          type: 'array_field_conflict',
          fieldName,
          id,
          local: localItem,
          remote: remoteItem,
          winner,
          resolved,
          timestamp: Date.now()
        };
        if (typeof onConflictFn === 'function') {
          onConflictFn(conflict);
        }
      }

      map.set(id, { item: resolved, origin: winner });
    });

    return order.map(id => map.get(id).item);
  }

  function mergeStateWithRevision(localState, remoteState, options = {}) {
    const rollbackSnapshot = localState ? JSON.parse(JSON.stringify(localState)) : {};
    const recordedConflicts = [];
    const handleConflict = (c) => {
      recordedConflicts.push(c);
      recordConflictEvent(c);
      if (typeof options.onConflict === 'function') {
        try { options.onConflict(c); } catch (e) {}
      }
    };

    try {
      if (options.forceError) {
        throw new Error('Forced sync error for rollback simulation');
      }

      if (!localState || typeof localState !== 'object') {
        const sanitized = sanitizeLoadedState(remoteState || {});
        return {
          success: true,
          state: sanitized,
          revision: getStateRevision(sanitized),
          conflicts: [],
          rollback: () => rollbackSnapshot
        };
      }
      if (!remoteState || typeof remoteState !== 'object') {
        const sanitized = sanitizeLoadedState(localState);
        return {
          success: true,
          state: sanitized,
          revision: getStateRevision(sanitized),
          conflicts: [],
          rollback: () => rollbackSnapshot
        };
      }

      const localRev = getStateRevision(localState);
      const remoteRev = getStateRevision(remoteState);
      const nextRevision = Math.max(localRev, remoteRev) + 1;

      const merged = { ...localState, ...remoteState };

      merged.cloudConfig = {
        ...(localState.cloudConfig || {}),
        ...(remoteState.cloudConfig || {}),
        stateRevision: nextRevision,
        lastSyncAt: new Date().toISOString()
      };

      merged.routines = mergeArrayById('routines', localState.routines, remoteState.routines, handleConflict);

      if (Array.isArray(localState.conversations) || Array.isArray(remoteState.conversations)) {
        merged.conversations = mergeArrayById('conversations', localState.conversations, remoteState.conversations, handleConflict);
      }
      if (Array.isArray(localState.chats) || Array.isArray(remoteState.chats)) {
        merged.chats = mergeArrayById('chats', localState.chats, remoteState.chats, handleConflict);
      }

      if (localState.brain?.nodes || remoteState.brain?.nodes) {
        merged.brain = merged.brain || {};
        merged.brain.nodes = mergeArrayById('brain.nodes', localState.brain?.nodes, remoteState.brain?.nodes, handleConflict);
      }
      if (Array.isArray(localState.brainNodes) || Array.isArray(remoteState.brainNodes)) {
        merged.brainNodes = mergeArrayById('brainNodes', localState.brainNodes, remoteState.brainNodes, handleConflict);
      }

      merged.state_revision = nextRevision;
      if (merged.cloudConfig) {
        merged.cloudConfig.stateRevision = nextRevision;
        merged.cloudConfig.lastSyncAt = new Date().toISOString();
      }

      const sanitizedState = sanitizeLoadedState(merged);
      sanitizedState.state_revision = nextRevision;
      if (sanitizedState.cloudConfig) {
        sanitizedState.cloudConfig.stateRevision = nextRevision;
      }

      if (options.storage && typeof options.storage.setItem === 'function') {
        const key = options.storageKey || STORAGE_KEYS.current;
        options.storage.setItem(key, JSON.stringify(buildPersistedState(sanitizedState)));
      }

      return {
        success: true,
        state: sanitizedState,
        revision: nextRevision,
        conflicts: recordedConflicts,
        rollback: function() {
          if (options.storage && typeof options.storage.setItem === 'function') {
            const key = options.storageKey || STORAGE_KEYS.current;
            options.storage.setItem(key, JSON.stringify(buildPersistedState(rollbackSnapshot)));
          }
          recordConflictEvent({
            type: 'state_rollback',
            restoredRevision: getStateRevision(rollbackSnapshot),
            timestamp: Date.now()
          });
          return JSON.parse(JSON.stringify(rollbackSnapshot));
        }
      };
    } catch (err) {
      if (options.storage && typeof options.storage.setItem === 'function') {
        try {
          const key = options.storageKey || STORAGE_KEYS.current;
          options.storage.setItem(key, JSON.stringify(buildPersistedState(rollbackSnapshot)));
        } catch (storageErr) {}
      }

      const rollbackEvent = {
        type: 'sync_error_rollback',
        error: err.message,
        restoredRevision: getStateRevision(rollbackSnapshot),
        timestamp: Date.now()
      };
      recordConflictEvent(rollbackEvent);

      return {
        success: false,
        rolledBack: true,
        state: JSON.parse(JSON.stringify(rollbackSnapshot)),
        error: err.message,
        conflicts: recordedConflicts,
        rollback: () => JSON.parse(JSON.stringify(rollbackSnapshot))
      };
    }
  }

  function resolveRoutineConflicts(localRoutine, remoteRoutine, options = {}) {
    if (!localRoutine) return { resolved: remoteRoutine, winner: 'remote' };
    if (!remoteRoutine) return { resolved: localRoutine, winner: 'local' };

    const localVer = Number(localRoutine.version) || 0;
    const remoteVer = Number(remoteRoutine.version) || 0;

    let winner = 'local';
    let resolved = localRoutine;

    if (localVer > remoteVer) {
      winner = 'local';
      resolved = localRoutine;
    } else if (remoteVer > localVer) {
      winner = 'remote';
      resolved = remoteRoutine;
    } else {
      const localTime = new Date(localRoutine.updated_at || localRoutine.lastRunAt || localRoutine.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteRoutine.updated_at || remoteRoutine.lastRunAt || remoteRoutine.updatedAt || 0).getTime();

      if (remoteTime > localTime) {
        winner = 'remote';
        resolved = remoteRoutine;
      } else {
        winner = 'local';
        resolved = localRoutine;
      }
    }

    const isDifferent = JSON.stringify(localRoutine) !== JSON.stringify(remoteRoutine);
    if (isDifferent) {
      const conflictEvent = {
        type: 'routine_conflict',
        id: localRoutine.id || remoteRoutine.id,
        local: localRoutine,
        remote: remoteRoutine,
        winner,
        resolved,
        timestamp: Date.now()
      };
      recordConflictEvent(conflictEvent);
      if (options && typeof options.onConflict === 'function') {
        try { options.onConflict(conflictEvent); } catch (e) {}
      }
    }

    return {
      resolved,
      winner,
      rollback: () => JSON.parse(JSON.stringify(localRoutine))
    };
  }

  function compareTimestampsWithClockSkewProtection(tsA, tsB, options = {}) {
    const now = typeof options.now === 'number' ? options.now : Date.now();
    const maxSkew = typeof options.maxClockSkewMs === 'number' ? options.maxClockSkewMs : 60000;

    let a = Number(tsA) || 0;
    let b = Number(tsB) || 0;
    let clockSkewDetected = false;

    if (a > now + maxSkew) {
      clockSkewDetected = true;
      a = now;
    }
    if (b > now + maxSkew) {
      clockSkewDetected = true;
      b = now;
    }

    const diff = a - b;
    return {
      clockSkewDetected,
      diff,
      winner: diff > 0 ? 'A' : (diff < 0 ? 'B' : 'equal'),
      normalizedA: a,
      normalizedB: b
    };
  }

  async function syncWithCloudWorker(options = {}) {
    const storage = options.storage || getLocalStorage();
    const storageKey = options.storageKey || STORAGE_KEY;
    const backupRaw = storage && typeof storage.getItem === 'function' ? storage.getItem(storageKey) : null;
    let backupSnapshot = null;
    try {
      if (backupRaw) backupSnapshot = JSON.parse(backupRaw);
    } catch (_) {}

    try {
      let stateToSync = options.state || backupSnapshot;
      if (!stateToSync && backupRaw) {
        try { stateToSync = JSON.parse(backupRaw); } catch (_) {}
      }
      if (!stateToSync) {
        throw new Error('No state available to sync');
      }

      if (typeof options.transportFn !== 'function') {
        throw new Error('Transport function required for cloud sync');
      }

      const res = await options.transportFn(stateToSync);
      if (!res || res.ok === false) {
        throw new Error((res && res.error) || 'Cloud worker sync rejected');
      }

      const rev = (res && Number(res.stateRevision)) || (stateToSync.cloudConfig && Number(stateToSync.cloudConfig.stateRevision)) || (Number(stateToSync.state_revision) || 1);
      return {
        ok: true,
        rolledBack: false,
        result: res,
        stateRevision: rev
      };
    } catch (netErr) {
      if (storage && typeof storage.setItem === 'function' && backupRaw !== null) {
        storage.setItem(storageKey, backupRaw);
      }
      return {
        ok: false,
        rolledBack: true,
        error: netErr.message || String(netErr)
      };
    }
  }

  function mergeMultiTabState(localState, incomingState, options = {}) {
    if (!localState && !incomingState) {
      return { mergedState: {}, winner: 'equal', clockSkewDetected: false, conflictResolved: false };
    }
    if (!localState) {
      return { mergedState: JSON.parse(JSON.stringify(incomingState)), winner: 'incoming', clockSkewDetected: false, conflictResolved: false };
    }
    if (!incomingState) {
      return { mergedState: JSON.parse(JSON.stringify(localState)), winner: 'local', clockSkewDetected: false, conflictResolved: false };
    }

    const localRev = getStateRevision(localState);
    const incomingRev = getStateRevision(incomingState);

    const localTs = Number(localState.updatedAtTs) || 0;
    const incomingTs = Number(incomingState.updatedAtTs) || 0;

    const timeComp = compareTimestampsWithClockSkewProtection(localTs, incomingTs, options);
    const clockSkewDetected = timeComp.clockSkewDetected;

    const merged = JSON.parse(JSON.stringify(localState));

    let primaryWinner = 'merged';
    if (incomingRev > localRev) {
      primaryWinner = 'incoming';
    } else if (localRev > incomingRev) {
      primaryWinner = 'local';
    } else {
      primaryWinner = timeComp.winner === 'B' ? 'incoming' : (timeComp.winner === 'A' ? 'local' : 'merged');
    }

    const allKeys = new Set([...Object.keys(localState), ...Object.keys(incomingState)]);
    allKeys.forEach(k => {
      if (['chats', 'routines', 'agentsCatalog', 'skills', 'addedAppIds'].includes(k)) {
        return;
      }
      if (localState[k] === undefined && incomingState[k] !== undefined) {
        merged[k] = JSON.parse(JSON.stringify(incomingState[k]));
      } else if (incomingState[k] !== undefined) {
        if (primaryWinner === 'incoming') {
          merged[k] = JSON.parse(JSON.stringify(incomingState[k]));
        } else if (primaryWinner === 'local') {
          merged[k] = JSON.parse(JSON.stringify(localState[k]));
        } else {
          merged[k] = (incomingState[k] !== '' && incomingState[k] !== null)
            ? JSON.parse(JSON.stringify(incomingState[k]))
            : JSON.parse(JSON.stringify(localState[k]));
        }
      }
    });

    function mergeCollection(localArr = [], incomingArr = [], itemTsField = 'updatedAtTs') {
      const map = new Map();
      (Array.isArray(localArr) ? localArr : []).forEach(item => {
        if (item && item.id) map.set(item.id, JSON.parse(JSON.stringify(item)));
      });
      (Array.isArray(incomingArr) ? incomingArr : []).forEach(item => {
        if (!item || !item.id) return;
        if (!map.has(item.id)) {
          map.set(item.id, JSON.parse(JSON.stringify(item)));
        } else {
          const existing = map.get(item.id);
          const exTs = Number(existing[itemTsField]) || Number(existing.version) || 0;
          const inTs = Number(item[itemTsField]) || Number(item.version) || 0;
          const comp = compareTimestampsWithClockSkewProtection(exTs, inTs, options);
          if (comp.winner === 'B' || (comp.winner === 'equal' && primaryWinner === 'incoming')) {
            map.set(item.id, JSON.parse(JSON.stringify(item)));
          }
        }
      });
      return Array.from(map.values());
    }

    if (Array.isArray(localState.chats) || Array.isArray(incomingState.chats)) {
      merged.chats = mergeCollection(localState.chats, incomingState.chats, 'updatedAtTs');
    }
    if (Array.isArray(localState.routines) || Array.isArray(incomingState.routines)) {
      merged.routines = mergeCollection(localState.routines, incomingState.routines, 'updated_at');
    }
    if (Array.isArray(localState.agentsCatalog) || Array.isArray(incomingState.agentsCatalog)) {
      merged.agentsCatalog = mergeCollection(localState.agentsCatalog, incomingState.agentsCatalog, 'version');
    }

    const targetRev = Math.max(localRev, incomingRev) + (primaryWinner === 'merged' ? 1 : 0);
    if (!merged.cloudConfig) merged.cloudConfig = {};
    merged.cloudConfig.stateRevision = targetRev;
    merged.state_revision = targetRev;
    merged.stateRevision = targetRev;
    merged.updatedAtTs = Math.max(timeComp.normalizedA, timeComp.normalizedB, typeof options.now === 'number' ? options.now : Date.now());

    return {
      mergedState: merged,
      winner: primaryWinner,
      clockSkewDetected,
      conflictResolved: true
    };
  }

  function _getSecretsModule() {
    if (typeof globalThis !== 'undefined' && globalThis._nexusCoreSecrets) return globalThis._nexusCoreSecrets;
    if (typeof window !== 'undefined' && window._nexusCoreSecrets) return window._nexusCoreSecrets;
    if (typeof globalThis !== 'undefined' && globalThis.NexusSecrets) return globalThis.NexusSecrets;
    if (typeof window !== 'undefined' && window.NexusSecrets) return window.NexusSecrets;
    if (typeof require === 'function') {
      try {
        return require('../security/secrets.js');
      } catch (_) {}
    }
    return null;
  }

  let _localWriteQueue = Promise.resolve();
  let _localWriteRevision = 0;
  let _localWriteState = 'idle';

  function queueSessionSecretsWrite(state, storage) {
    const sec = _getSecretsModule();
    if (sec && typeof sec.queueSessionSecretsWrite === 'function') {
      return sec.queueSessionSecretsWrite(state, storage);
    }
    _localWriteRevision++;
    _localWriteState = 'pending';
    const p = _localWriteQueue.then(() => {
      _localWriteState = 'success';
      return true;
    }).catch(err => {
      _localWriteState = 'failed';
      throw err;
    });
    _localWriteQueue = p.catch(() => {});
    return p;
  }

  function getSessionWriteState() {
    const sec = _getSecretsModule();
    if (sec && typeof sec.getSessionWriteState === 'function') {
      return sec.getSessionWriteState();
    }
    return _localWriteState;
  }

  function getSessionWriteRevision() {
    const sec = _getSecretsModule();
    if (sec && typeof sec.getSessionWriteRevision === 'function') {
      return sec.getSessionWriteRevision();
    }
    return _localWriteRevision;
  }

  function resetSessionWriteQueue() {
    const sec = _getSecretsModule();
    if (sec && typeof sec.resetSessionWriteQueue === 'function') {
      return sec.resetSessionWriteQueue();
    }
    _localWriteQueue = Promise.resolve();
    _localWriteRevision = 0;
    _localWriteState = 'idle';
  }

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    SESSION_SECRETS_KEY,
    API_KEY_NAMES,
    nexusStorageGet,
    nexusStorageSet,
    nexusStorageRemove,
    migrateLegacyStorage,
    getStorageSizeEstimate,
    sanitizeLoadedState,
    buildPersistedState,
    emptyApiKeys,
    getStateRevision,
    mergeArrayById,
    mergeStateWithRevision,
    mergeMultiTabState,
    resolveMultiTabStateConflict: mergeMultiTabState,
    syncWithCloudWorker,
    compareTimestampsWithClockSkewProtection,
    resolveRoutineConflicts,
    recordConflictEvent,
    getConflictHistory,
    clearConflictHistory,
    onConflict,
    queueSessionSecretsWrite,
    getSessionWriteState,
    getSessionWriteRevision,
    resetSessionWriteQueue
  };
});
