/**
 * EG-Nexus-OS — Core Persistence Module
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

  const STORAGE_KEY = 'eg_nexus_os_state_v5.1';
  const SESSION_SECRETS_KEY = STORAGE_KEY + '_session_secrets';

  function nexusStorageGet(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(String(key)) || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function nexusStorageSet(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(String(key), String(value));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function nexusStorageRemove(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(String(key));
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

  return {
    STORAGE_KEY,
    SESSION_SECRETS_KEY,
    nexusStorageGet,
    nexusStorageSet,
    nexusStorageRemove,
    buildPersistedState,
    emptyApiKeys
  };
});
