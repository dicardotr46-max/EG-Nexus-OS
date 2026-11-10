const fs = require('fs');
const path = require('path');
const vm = require('vm');

let _cachedHtml = null;
function getIndexHtml() {
  if (!_cachedHtml) {
    _cachedHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  }
  return _cachedHtml;
}

function extractFunction(name, html = getIndexHtml()) {
  const regex = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = html.match(regex);
  if (!m) return null;
  const startIdx = m.index;
  const paramEnd = html.indexOf(')', startIdx);
  const bodyStart = html.indexOf('{', paramEnd);
  let braceCount = 1;
  let endIdx = bodyStart + 1;
  for (let i = bodyStart + 1; i < html.length; i++) {
    if (html[i] === '{') braceCount++;
    else if (html[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  return html.slice(startIdx, endIdx);
}

const API_KEY_NAMES = ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'mistral', 'openrouter', 'perplexica', 'cohere'];
const SESSION_SECRETS_KEY = 'eg_nexus_session_secrets_v1';
const SESSION_SECRETS_SCHEMA_VERSION = 1;

function isSafeConnectionId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
}

function emptyApiKeys() {
  return API_KEY_NAMES.reduce((out, name) => { out[name] = ''; return out; }, {});
}

function createStorageMock() {
  let store = {};
  const fn = typeof jest !== 'undefined' ? jest.fn : f => f;
  return {
    getItem: fn(key => (key in store ? store[key] : null)),
    setItem: fn((key, val) => {
      store[key] = String(val);
    }),
    removeItem: fn(key => {
      delete store[key];
    }),
    clear: fn(() => {
      store = {};
    }),
    _getStore: () => store,
    _setStore: newStore => {
      store = { ...newStore };
    }
  };
}

module.exports = {
  getIndexHtml,
  extractFunction,
  API_KEY_NAMES,
  SESSION_SECRETS_KEY,
  SESSION_SECRETS_SCHEMA_VERSION,
  isSafeConnectionId,
  emptyApiKeys,
  createStorageMock
};
