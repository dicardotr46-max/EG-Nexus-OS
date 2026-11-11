/**
 * EG-Nexus-OS — Core Persistence Module
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  /* istanbul ignore else */
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    /* istanbul ignore next */
    const exports = factory();
    /* istanbul ignore next */
    if (root) {
      Object.assign(root, exports);
      root._nexusCorePersistence = exports;
    }
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
      Object.assign(window, exports);
      window._nexusCorePersistence = exports;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : /* istanbul ignore next */ this, function() {
  'use strict';

  const STORAGE_KEY = 'eg_nexus_os_state_v5.1';
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

  function emptyApiKeys() {
    const names = ['gemini', 'openrouter', 'deepseek', 'grok', 'kimi', 'tavily', 'perplx'];
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
    persisted.apiKeys = emptyApiKeys();
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

  return {
    STORAGE_KEY,
    SESSION_SECRETS_KEY,
    nexusStorageGet,
    nexusStorageSet,
    nexusStorageRemove,
    getStorageSizeEstimate,
    sanitizeLoadedState,
    buildPersistedState,
    emptyApiKeys
  };
});
