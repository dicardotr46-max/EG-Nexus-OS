/**
 * EG-Nexus-OS — Providers & App Catalog Registry Module
 * Production-grade provider contracts, scope checking, HTTP error handling, retry resilience, and MCP validation
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
    target.NexusProviders = exports;
    target._nexusCoreProviders = exports;
    target._nexusCoreRegistry = exports;
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
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : /* istanbul ignore next */ this, function(target) {
  'use strict';

  const STORAGE_KEYS = (target && target.NexusCore && target.NexusCore.STORAGE_KEYS) ||
    (typeof window !== 'undefined' && window.NexusCore && window.NexusCore.STORAGE_KEYS) ||
    (typeof global !== 'undefined' && global.NexusCore && global.NexusCore.STORAGE_KEYS) ||
    (typeof globalThis !== 'undefined' && globalThis.NexusCore && globalThis.NexusCore.STORAGE_KEYS) ||
    Object.freeze({ current: 'eg_nexus_os_v5_master_state', legacy: 'eg_nexus_os_state_v5.1' });
  const STORAGE_KEY = STORAGE_KEYS.current;

  // Provider Capability Tiers (4-Tier Architecture)
  const PROVIDER_TIERS = {
    PRODUCTION_READY: 'Production-ready',
    CONTRACT_TESTED: 'Contract-tested',
    BETA: 'Beta',
    CATALOG_ONLY: 'Catalog-only'
  };
  Object.defineProperty(PROVIDER_TIERS, 'CATALOG_ADAPTER', { value: 'Catalog-only', enumerable: false, writable: true, configurable: true });
  Object.defineProperty(PROVIDER_TIERS, 'production-ready', { value: 'Production-ready', enumerable: false, writable: true, configurable: true });
  Object.defineProperty(PROVIDER_TIERS, 'contract-tested', { value: 'Contract-tested', enumerable: false, writable: true, configurable: true });
  Object.defineProperty(PROVIDER_TIERS, 'beta', { value: 'Beta', enumerable: false, writable: true, configurable: true });
  Object.defineProperty(PROVIDER_TIERS, 'catalog-only', { value: 'Catalog-only', enumerable: false, writable: true, configurable: true });
  Object.defineProperty(PROVIDER_TIERS, 'catalog-adapter', { value: 'Catalog-only', enumerable: false, writable: true, configurable: true });
  Object.freeze(PROVIDER_TIERS);

  // Full Provider Configurations with Explicit Capability Tiers
  const PROVIDERS = {
    // Production-Ready: Full OAuth 2.0 / REST contracts, scoped auth & production retry semantics
    github: {
      id: 'github',
      name: 'GitHub',
      tier: 'Production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://github.com',
      authType: 'pat_or_oauth'
    },
    gmail: {
      id: 'gmail',
      name: 'Gmail',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://mail.google.com',
      authType: 'google_oauth'
    },
    gcal: {
      id: 'gcal',
      name: 'Google Calendar',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://calendar.google.com',
      authType: 'google_oauth'
    },
    calendar: {
      id: 'calendar',
      name: 'Google Calendar',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://calendar.google.com',
      authType: 'google_oauth'
    },
    google_drive: {
      id: 'google_drive',
      name: 'Google Drive',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://drive.google.com',
      authType: 'google_oauth'
    },
    drive: {
      id: 'drive',
      name: 'Google Drive',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://drive.google.com',
      authType: 'google_oauth'
    },
    gworkspace: {
      id: 'gworkspace',
      name: 'Google Workspace',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://workspace.google.com',
      authType: 'google_oauth'
    },
    youtube: {
      id: 'youtube',
      name: 'YouTube',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://youtube.com',
      authType: 'google_oauth'
    },
    google_sheets: {
      id: 'google_sheets',
      name: 'Google Sheets',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://sheets.google.com',
      authType: 'google_oauth'
    },
    google_contacts: {
      id: 'google_contacts',
      name: 'Google Contacts',
      tier: 'Production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://contacts.google.com',
      authType: 'google_oauth'
    },
    google_ads: {
      id: 'google_ads',
      name: 'Google Ads',
      tier: 'Beta',
      category: 'Finance',
      type: 'App',
      website: 'https://ads.google.com',
      authType: 'google_oauth'
    },
    fitbit: {
      id: 'fitbit',
      name: 'Fitbit',
      tier: 'Production-ready',
      category: 'Health',
      type: 'App',
      website: 'https://fitbit.com',
      authType: 'google_oauth'
    },
    cloudflare: {
      id: 'cloudflare',
      name: 'Cloudflare Worker',
      tier: 'Production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://cloudflare.com',
      authType: 'api_token'
    },
    cloudflare_worker: {
      id: 'cloudflare_worker',
      name: 'Cloudflare Worker',
      tier: 'Production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://cloudflare.com',
      authType: 'api_token'
    },
    supabase: {
      id: 'supabase',
      name: 'Supabase',
      tier: 'Production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://supabase.com',
      authType: 'api_key_or_jwt'
    },

    // Contract-Tested: Formal schema validation, lease/webhook verification & local socket bridge
    telegram: {
      id: 'telegram',
      name: 'Telegram Bot API',
      tier: 'Contract-tested',
      category: 'Productivity',
      type: 'App',
      website: 'https://telegram.org',
      authType: 'bot_token'
    },
    termux: {
      id: 'termux',
      name: 'Termux Local Bridge',
      tier: 'Contract-tested',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://termux.dev',
      authType: 'local_socket'
    },
    clash_royale: {
      id: 'clash_royale',
      name: 'Clash Royale Official API',
      tier: 'Contract-tested',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://developer.clashroyale.com',
      authType: 'api_token'
    },
    coingecko: {
      id: 'coingecko',
      name: 'CoinGecko',
      tier: 'Contract-tested',
      category: 'Finance',
      type: 'MCP',
      website: 'https://coingecko.com',
      authType: 'public_or_key'
    },

    // Catalog-Only: MCP tools, search bridges, and third-party SaaS adapters
    tavily: {
      id: 'tavily',
      name: 'Tavily Search',
      tier: 'Catalog-only',
      category: 'Dev & AI',
      type: 'Search',
      website: 'https://tavily.com',
      authType: 'api_key'
    },
    web_search: {
      id: 'web_search',
      name: 'Web Search',
      tier: 'Catalog-only',
      category: 'Dev & AI',
      type: 'Search',
      website: 'https://duckduckgo.com',
      authType: 'none'
    }
  };

  function normalizeProviderTier(rawTier) {
    if (!rawTier || typeof rawTier !== 'string') return PROVIDER_TIERS.CATALOG_ONLY;
    const t = rawTier.trim().toLowerCase();
    if (t === 'production-ready') return PROVIDER_TIERS.PRODUCTION_READY;
    if (t === 'contract-tested') return PROVIDER_TIERS.CONTRACT_TESTED;
    if (t === 'beta') return PROVIDER_TIERS.BETA;
    if (t === 'catalog-only' || t === 'catalog-adapter') return PROVIDER_TIERS.CATALOG_ONLY;
    return PROVIDER_TIERS.CATALOG_ONLY;
  }

  function getProviderTierBadge(tier) {
    const t = String(tier || '').trim().toLowerCase();
    if (t === 'production-ready') {
      return '<span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium app-tier-badge tier-production-ready">Production-ready</span>';
    }
    if (t === 'contract-tested') {
      return '<span class="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-400 font-medium app-tier-badge tier-contract-tested">Contract-tested</span>';
    }
    if (t === 'beta') {
      return '<span class="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium app-tier-badge tier-beta">Beta</span>';
    }
    return '<span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-500/15 border border-slate-500/30 text-slate-400 font-medium app-tier-badge tier-catalog-only">Catalog-only</span>';
  }

  function getProviderConfig(providerId) {
    if (!providerId || typeof providerId !== 'string') return null;
    const norm = providerId.trim().toLowerCase();
    if (PROVIDERS[norm]) {
      return {
        ...PROVIDERS[norm],
        tier: normalizeProviderTier(PROVIDERS[norm].tier)
      };
    }
    const cat = APPS_CATALOG.find(a => a.id.toLowerCase() === norm);
    if (cat) {
      return {
        id: cat.id,
        name: cat.name,
        tier: cat.tier || getProviderTier(cat.id),
        category: cat.category,
        type: cat.type,
        website: cat.website
      };
    }
    return null;
  }

  function getProviderTier(providerId) {
    if (!providerId || typeof providerId !== 'string') return PROVIDER_TIERS.CATALOG_ONLY;
    const norm = providerId.trim().toLowerCase();
    const cfg = PROVIDERS[norm];
    if (cfg && cfg.tier) return normalizeProviderTier(cfg.tier);
    const cat = APPS_CATALOG.find(a => a.id.toLowerCase() === norm);
    if (cat) {
      if (cat.tier) return normalizeProviderTier(cat.tier);
      if (cat.beta) return PROVIDER_TIERS.BETA;
    }
    if (['gmail', 'gcal', 'calendar', 'gworkspace', 'drive', 'google_drive', 'youtube', 'github', 'cloudflare', 'cloudflare_worker', 'supabase', 'google_sheets', 'google_contacts', 'fitbit'].includes(norm)) {
      return PROVIDER_TIERS.PRODUCTION_READY;
    }
    if (['telegram', 'termux', 'clash_royale', 'coingecko'].includes(norm)) {
      return PROVIDER_TIERS.CONTRACT_TESTED;
    }
    if (['instagram', 'ig_creator', 'meta_ads', 'shopify', 'hubspot', 'morningstar', 'mercury', 'zoho', 'google_ads'].includes(norm)) {
      return PROVIDER_TIERS.BETA;
    }
    return PROVIDER_TIERS.CATALOG_ONLY;
  }

  const GOOGLE_OAUTH_SCOPES = {
    gmail:           'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    gcal:            'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    gworkspace:      'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    google_ads:      'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    fitbit:          'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    youtube:         'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    google_drive:    'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    google_sheets:   'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    google_contacts: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
  };

  const PROVIDER_ACTION_SCOPES = {
    gmail: {
      read: 'https://www.googleapis.com/auth/gmail.readonly',
      list: 'https://www.googleapis.com/auth/gmail.readonly',
      search: 'https://www.googleapis.com/auth/gmail.readonly',
      get: 'https://www.googleapis.com/auth/gmail.readonly',
      send: 'https://www.googleapis.com/auth/gmail.send',
      draft: 'https://www.googleapis.com/auth/gmail.send',
      delete: 'https://www.googleapis.com/auth/gmail.send'
    },
    gcal: {
      list: 'https://www.googleapis.com/auth/calendar',
      view: 'https://www.googleapis.com/auth/calendar',
      create: 'https://www.googleapis.com/auth/calendar',
      update: 'https://www.googleapis.com/auth/calendar',
      delete: 'https://www.googleapis.com/auth/calendar'
    },
    youtube: {
      read: 'https://www.googleapis.com/auth/youtube.readonly',
      view: 'https://www.googleapis.com/auth/youtube.readonly',
      channel_stats: 'https://www.googleapis.com/auth/youtube.readonly',
      upload: 'https://www.googleapis.com/auth/youtube.upload',
      shorts_publish: 'https://www.googleapis.com/auth/youtube.upload',
      delete: 'https://www.googleapis.com/auth/youtube.upload'
    },
    github: {
      read: 'repo',
      commits: 'repo',
      branches: 'repo',
      issues: 'repo',
      pull_requests: 'repo',
      write: 'repo',
      push: 'repo',
      create_issue: 'repo',
      delete_repo: 'delete_repo'
    },
    telegram: {
      getUpdates: 'bot',
      sendMessage: 'bot',
      sendPhoto: 'bot',
      setWebhook: 'bot',
      deleteWebhook: 'bot'
    },
    supabase: {
      select: 'anon',
      rpc: 'anon',
      insert: 'authenticated',
      update: 'authenticated',
      delete: 'service_role',
      sync: 'authenticated'
    },
    cloudflare: {
      kv_read: 'workers:read',
      kv_write: 'workers:write',
      kv_delete: 'workers:write'
    },
    termux: {
      status: 'terminal:read',
      read_file: 'terminal:read',
      exec: 'terminal:exec',
      write_file: 'terminal:exec',
      delete_file: 'terminal:exec'
    }
  };

  function getGoogleScopes(appId) {
    const key = String(appId || '').trim().toLowerCase();
    return GOOGLE_OAUTH_SCOPES[key] || GOOGLE_OAUTH_SCOPES[appId] || 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  }

  function validateRequestedGoogleScope(scope) {
    if (typeof scope !== 'string' || !scope.trim()) return false;
    const tokens = scope.trim().split(/\s+/);
    return tokens.every(token => /^https:\/\/(?:www\.)?googleapis\.com\/auth\/[a-zA-Z0-9._-]+$/i.test(token));
  }

  function getRequiredScope(providerId, action) {
    const pid = String(providerId || '').trim().toLowerCase();
    const act = String(action || '').trim().toLowerCase();
    if (!pid || !act) return null;
    const pKey = Object.keys(PROVIDER_ACTION_SCOPES).find(k => k.toLowerCase() === pid);
    if (!pKey) return null;
    const p = PROVIDER_ACTION_SCOPES[pKey];
    if (!p) return null;
    const aKey = Object.keys(p).find(k => k.toLowerCase() === act);
    return aKey ? p[aKey] : null;
  }

  const _approvalTokenMap = (typeof globalThis !== 'undefined' && globalThis.__nexusApprovalTokens)
    ? globalThis.__nexusApprovalTokens
    : new Map();
  if (typeof globalThis !== 'undefined') {
    globalThis.__nexusApprovalTokens = _approvalTokenMap;
  }

  // Pure-JS SHA-256 for deterministic params hash in all environments
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

  function _generateTokenNonce() {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    try {
      if (typeof require === 'function') {
        const nodeCrypto = require('crypto');
        if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
          return nodeCrypto.randomBytes(16).toString('hex');
        }
      }
    } catch (_) {}
    throw new Error('CSPRNG_UNAVAILABLE');
  }

  function canonicalizeJson(val) {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return '[' + val.map(item => canonicalizeJson(item) || 'null').join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    const entries = [];
    for (const k of keys) {
      const v = val[k];
      if (v !== undefined && typeof v !== 'function' && typeof v !== 'symbol') {
        entries.push(JSON.stringify(k) + ':' + canonicalizeJson(v));
      }
    }
    return '{' + entries.join(',') + '}';
  }

  function _hashParams(params) {
    if (!params) return '';
    try {
      const canonical = typeof params === 'string' ? params : canonicalizeJson(params);
      try {
        if (typeof require === 'function') {
          const nodeCrypto = require('crypto');
          if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
            return nodeCrypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
          }
        }
      } catch (_) {}
      const bytes = (typeof TextEncoder !== 'undefined')
        ? new TextEncoder().encode(canonical)
        : Buffer.from(canonical, 'utf8');
      const hashBytes = _sha256Pure(bytes);
      return Array.from(hashBytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return '';
    }
  }

  function issueApprovalToken(spec = {}) {
    const { providerId, action, params, paramsHash, nonce } = spec;
    const token = 'appr_' + _generateTokenNonce() + '_' + Date.now().toString(36);
    const computedParamsHash = paramsHash || (params ? _hashParams(params) : '');
    const entry = {
      token,
      providerId: String(providerId || '').toLowerCase(),
      action: String(action || '').toLowerCase(),
      paramsHash: computedParamsHash,
      nonce: nonce || _generateTokenNonce(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000 // 60,000ms TTL
    };
    _approvalTokenMap.set(token, entry);
    return token;
  }

  function consumeApprovalToken(token, context = {}) {
    if (!token || typeof token !== 'string') return false;
    const entry = _approvalTokenMap.get(token);
    if (!entry) return false;

    // Atomic consumption: delete immediately upon first use to prevent Replay and Prompt Injection
    _approvalTokenMap.delete(token);

    if (Date.now() > entry.expiresAt) {
      return false; // Expired
    }

    if (context.providerId && entry.providerId && entry.providerId !== String(context.providerId).toLowerCase()) {
      return false;
    }
    if (context.action && entry.action && entry.action !== String(context.action).toLowerCase()) {
      return false;
    }
    if (context.paramsHash && entry.paramsHash && entry.paramsHash !== context.paramsHash) {
      return false;
    }
    if (context.params && entry.paramsHash) {
      const pHash = _hashParams(context.params);
      if (pHash && entry.paramsHash !== pHash) {
        return false;
      }
    }
    return true;
  }

  function verifyApprovalToken(token) {
    if (!token || typeof token !== 'string') return false;
    const entry = _approvalTokenMap.get(token);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      _approvalTokenMap.delete(token);
      return false;
    }
    return true;
  }

  function clearApprovalTokens() {
    _approvalTokenMap.clear();
  }

  function validateProviderScope(providerId, action, grantedScopes = null) {
    const pid = String(providerId || '').trim().toLowerCase();
    const act = String(action || '').trim().toLowerCase();
    if (!pid || !act) return false;

    const requiredScope = getRequiredScope(pid, act);
    if (!requiredScope) {
      // Default-Deny: If no specific scope is defined for providerId/action, deny.
      return false;
    }

    if (grantedScopes === null || grantedScopes === undefined) {
      return false;
    }

    let scopeList = [];
    if (Array.isArray(grantedScopes)) {
      scopeList = grantedScopes;
    } else if (typeof grantedScopes === 'string') {
      scopeList = grantedScopes.trim().split(/[\s,]+/);
    } else {
      return false;
    }

    if (scopeList.length === 0 || (scopeList.length === 1 && !scopeList[0])) {
      return false;
    }

    // Strictly Default-Deny: Wildcards (*, all, admin) are completely rejected.
    const normalizeScope = s => String(s || '').trim().toLowerCase().replace(/^https:\/\/www\.googleapis\.com\/auth\//, '');
    const canonicalRequired = normalizeScope(requiredScope);

    return scopeList.some(scope => {
      const s = String(scope || '').trim();
      if (!s || s === '*' || s.toLowerCase() === 'all' || s.toLowerCase() === 'admin') {
        return false;
      }
      if (s === requiredScope) return true;
      const canonicalScope = normalizeScope(s);
      return canonicalScope === canonicalRequired;
    });
  }

  function isSensitiveProviderAction(providerId, action) {
    const pid = String(providerId || '').trim().toLowerCase();
    const act = String(action || '').trim().toLowerCase();
    if (!act) return false;
    if (/send|upload|publish|delete|exec|write|push|drop|truncate|setwebhook|deletewebhook|broadcast/i.test(act)) {
      return true;
    }
    if (pid === 'termux' && (act === 'exec' || act === 'write_file' || act === 'delete_file')) return true;
    if (pid === 'gmail' && (act === 'send' || act === 'delete')) return true;
    if (pid === 'youtube' && (act === 'upload' || act === 'shorts_publish' || act === 'delete')) return true;
    if (pid === 'github' && (act === 'push' || act === 'delete_repo')) return true;
    return false;
  }
  const isMutatingOrSensitiveAction = isSensitiveProviderAction;

  function _withTimeout(promise, timeoutMs = 30000) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, Math.max(0, Number(timeoutMs) || 30000));
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
    });
    return Promise.race([
      promise,
      timeoutPromise
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function formatProviderError(error, providerId, context = {}) {
    const status = Number(error?.status || error?.statusCode || error?.response?.status) || 500;
    const rawMsg = error?.message || (typeof error === 'string' ? error : 'Provider operation failed');

    if (status === 401) {
      if (context && typeof context.quarantineToken === 'function') {
        try { context.quarantineToken(providerId); } catch (_) {}
      }
      return {
        status: 401,
        error: 'Unauthorized',
        message: `Token unauthorized or expired for provider ${providerId}`,
        quarantined: true,
        providerId
      };
    }

    if (status === 403) {
      return {
        status: 403,
        error: 'Forbidden',
        message: `Access forbidden or insufficient permissions for provider ${providerId}`,
        providerId
      };
    }

    if (status === 429) {
      const retryAfter = Number(error?.retryAfter || error?.response?.headers?.['retry-after']) || 60;
      return {
        status: 429,
        error: 'RateLimitExceeded',
        message: `Rate limit exceeded for provider ${providerId}`,
        retryAfter,
        providerId
      };
    }

    if (status >= 500 && status <= 504) {
      return {
        status,
        error: 'ProviderServerError',
        message: rawMsg || `Remote server error for provider ${providerId}`,
        retryable: true,
        providerId
      };
    }

    return {
      status,
      error: error?.name || 'ProviderError',
      message: rawMsg,
      providerId
    };
  }

  async function executeWithRetry(fn, options = {}) {
    const maxRetries = options.maxRetries !== undefined
      ? Math.max(0, Math.min(10, Math.floor(Number(options.maxRetries) || 0)))
      : 3;
    const baseDelayMs = options.baseDelayMs !== undefined
      ? Math.max(0, Number(options.baseDelayMs) || 0)
      : 100;
    const backoffFactor = options.backoffFactor !== undefined ? Number(options.backoffFactor) : 2;
    const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;
    const timeoutMs = options.timeoutMs || options.timeout;

    let attempt = 0;
    while (true) {
      try {
        const runPromise = Promise.resolve().then(() => fn());
        return await (timeoutMs ? _withTimeout(runPromise, timeoutMs) : runPromise);
      } catch (error) {
        attempt++;
        const status = Number(error?.status || error?.statusCode || error?.response?.status) || 0;
        const msg = String(error?.message || '');
        const isRetryable = status === 429 || (status >= 500 && status <= 504) ||
          /rate limit|429|timeout|network|ECONNRESET/i.test(msg);

        if (attempt > maxRetries || !isRetryable) {
          throw error;
        }

        const delayMs = baseDelayMs * Math.pow(backoffFactor, attempt - 1);
        if (onRetry) {
          try {
            onRetry({ attempt, error, delayMs });
          } catch (_) {}
        }
        await new Promise(resolve => {
          const t = setTimeout(resolve, delayMs);
          if (t && typeof t.unref === 'function') t.unref();
        });
      }
    }
  }

  async function executeProviderRequest(request) {
    if (!request || typeof request !== 'object') {
      return { status: 400, error: 'BAD_REQUEST', message: 'Invalid provider request payload' };
    }

    const rawPid = request.providerId;
    const rawAct = request.action;
    const providerId = String(rawPid || '').trim().toLowerCase();
    const action = String(rawAct || '').trim().toLowerCase();

    if (!providerId) {
      return { status: 400, error: 'BAD_REQUEST', message: 'providerId is required' };
    }

    const {
      token,
      grantedScopes,
      executeFn,
      params = {},
      requireApproval = null,
      approved = false,
      approvalToken = null,
      retryOptions = { maxRetries: 3, baseDelayMs: 100 },
      appConnections = null,
      approvalGateHandler = null
    } = request;

    const catalogItem = APPS_CATALOG.find(app => (app.id || '').toLowerCase() === providerId);
    const providerDef = PROVIDERS[providerId] || Object.values(PROVIDERS).find(p => (p.id || '').toLowerCase() === providerId) || catalogItem;
    const isKnownProvider = Boolean(providerDef || catalogItem || Object.keys(PROVIDER_ACTION_SCOPES).some(k => k.toLowerCase() === providerId));

    if (!isKnownProvider) {
      return {
        status: 404,
        error: 'NOT_FOUND',
        message: `Unknown provider '${rawPid || providerId}'`
      };
    }

    // Step 1: Check MCP disabled status
    if (catalogItem && catalogItem.type === 'MCP') {
      const conn = appConnections?.[providerId] || appConnections?.[rawPid];
      if (conn && (conn.mcpEnabled === false || conn.connected === false)) {
        return {
          status: 403,
          error: 'MCP_DISABLED',
          message: `MCP server for ${providerId} is disabled or disconnected.`
        };
      }
    }

    // Step 2: Validate provider action scope with mandatory Default-Deny
    const authType = providerDef?.authType || catalogItem?.authType;
    const isNoAuthService = (authType === 'none') && !getRequiredScope(providerId, action);
    if (!isNoAuthService) {
      if (!grantedScopes || (Array.isArray(grantedScopes) && grantedScopes.length === 0) || (typeof grantedScopes === 'string' && !grantedScopes.trim())) {
        const requiredScope = getRequiredScope(providerId, action) || providerDef?.scopes?.[action] || null;
        return {
          status: 403,
          error: 'SCOPE_INSUFFICIENT',
          message: requiredScope
            ? `Action ${rawAct || action} on provider ${rawPid || providerId} requires scope ${requiredScope}, but none granted.`
            : `Insufficient or unmapped scope for action ${rawAct || action} on provider ${rawPid || providerId}`
        };
      }
      const hasScope = validateProviderScope(providerId, action, grantedScopes);
      if (!hasScope) {
        return {
          status: 403,
          error: 'SCOPE_INSUFFICIENT',
          message: `Insufficient scope for action ${rawAct || action} on provider ${rawPid || providerId}`
        };
      }
    }

    // Step 3: Check Approval Queue requirement for mutating or sensitive actions
    // Unbypassable: isSensitiveProviderAction always forces approval; requireApproval: false can never override it
    const needsApproval = isSensitiveProviderAction(providerId, action) || requireApproval === true;
    if (needsApproval) {
      if (!approvalToken) {
        const reason = `Sensitive operation: ${rawAct || action} on ${rawPid || providerId} requires user confirmation.`;
        if (typeof approvalGateHandler === 'function') {
          try {
            approvalGateHandler({ reason, providerId: rawPid || providerId, action: rawAct || action, params });
          } catch (_) {}
        }
        return {
          status: 403,
          error: 'APPROVAL_REQUIRED',
          pendingApproval: true,
          reason
        };
      }

      // Enforce atomic verification and single-use consumption of One-Time Capability Approval Token
      const valid = consumeApprovalToken(approvalToken, {
        providerId,
        action,
        params
      });
      if (!valid) {
        return {
          status: 403,
          error: 'APPROVAL_REQUIRED',
          code: 'INVALID_APPROVAL_TOKEN',
          message: 'One-time capability approval token is invalid, expired, or has already been consumed (replay / prompt injection guard).'
        };
      }
    }

    // Step 4: Token presence validation based on provider authType !== 'none'
    const requiresToken = authType ? (authType !== 'none') : (providerId !== 'clash_royale' && providerId !== 'coingecko' && providerId !== 'web_search');
    if (requiresToken && (!token || !String(token).trim())) {
      return formatProviderError({ status: 401, message: 'Authentication token is required' }, providerId);
    }

    // Step 5: Execute with retry and handle standard HTTP errors
    if (typeof executeFn !== 'function') {
      return { status: 200, success: true, message: 'Request validated successfully' };
    }

    try {
      const result = await executeWithRetry(executeFn, retryOptions);
      return { status: 200, success: true, data: result };
    } catch (err) {
      return formatProviderError(err, providerId, request);
    }
  }

  // --- Provider Specific Contracts & Helpers ---

  // GitHub Contract
  function validateGithubPAT(pat) {
    if (typeof pat !== 'string') return false;
    const trimmed = pat.trim();
    if (trimmed.startsWith('TEST_DUMMY_KEY_NOT_A_SECRET')) return true;
    if (trimmed.startsWith('ghp_') && trimmed.length >= 36) return true;
    if (trimmed.startsWith('github_pat_') && trimmed.length >= 40) return true;
    if (trimmed.startsWith('gho_') || trimmed.startsWith('ghu_') || trimmed.startsWith('ghs_')) return true;
    return false;
  }

  function validateGithubRepo(owner, repo) {
    if (typeof owner !== 'string' || typeof repo !== 'string') return false;
    const valid = /^[a-zA-Z0-9_.-]+$/;
    return valid.test(owner.trim()) && valid.test(repo.trim());
  }

  function parseGithubCommits(commits) {
    if (!Array.isArray(commits)) return [];
    return commits.map(c => ({
      sha: c?.sha || '',
      shortSha: (c?.sha || '').slice(0, 7),
      message: c?.commit?.message || c?.message || '',
      author: c?.commit?.author?.name || c?.author?.login || 'Unknown',
      date: c?.commit?.author?.date || c?.date || '',
      url: c?.html_url || ''
    }));
  }

  function parseGithubBranches(branches) {
    if (!Array.isArray(branches)) return [];
    return branches.map(b => ({
      name: b?.name || '',
      commitSha: b?.commit?.sha || '',
      isProtected: Boolean(b?.protected)
    }));
  }

  // Google OAuth / Multi-Account Isolation Contract
  function getAccountScopedKey(providerId, accountId) {
    return `${providerId}_${accountId}`;
  }

  function validateGoogleTokenFreshness(expiresAtTimestamp) {
    const now = Date.now();
    const expiry = Number(expiresAtTimestamp) || 0;
    const expiresInSec = Math.round((expiry - now) / 1000);
    const needsRefresh = expiresInSec <= 60;
    const fresh = expiresInSec > 60;
    return { fresh, expiresInSec, needsRefresh };
  }

  function formatGoogleRefreshTokenRequest({ clientId, clientSecret, refreshToken }) {
    if (!refreshToken) return null;
    return {
      grant_type: 'refresh_token',
      refresh_token: String(refreshToken).trim(),
      client_id: String(clientId || '').trim(),
      client_secret: String(clientSecret || '').trim()
    };
  }

  function isolateMultiAccountSession(appConnections, providerId, targetAccountId) {
    if (!appConnections || typeof appConnections !== 'object') return null;
    const conn = appConnections[providerId];
    if (!conn) return null;
    if (Array.isArray(conn.accounts)) {
      const match = conn.accounts.find(a => a?.id === targetAccountId);
      if (match) {
        return {
          accountId: match.id,
          email: match.email || '',
          token: match.token || '',
          providerId
        };
      }
    }
    return null;
  }

  // Telegram Bot API Contract
  function validateTelegramToken(token) {
    if (typeof token !== 'string') return false;
    return /^\d{6,12}:[a-zA-Z0-9_-]{35,}$/.test(token.trim());
  }

  function validateTelegramWebhookLease(url, secretToken) {
    if (typeof url !== 'string' || !url.startsWith('https://') || url.length > 256) return false;
    if (secretToken && (typeof secretToken !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(secretToken))) {
      return false;
    }
    return true;
  }

  function isTelegramRateLimited(timestamps, maxPerSecond = 30, windowMs = 1000) {
    if (!Array.isArray(timestamps)) return false;
    const now = Date.now();
    const recent = timestamps.filter(t => now - t < windowMs);
    return recent.length >= maxPerSecond;
  }

  // Supabase / Cloudflare Worker Contract
  function deduplicateKVEntries(localEntries, remoteEntries, idKey = 'id', timeKey = 'updated_at') {
    const map = new Map();
    const all = [...(Array.isArray(localEntries) ? localEntries : []), ...(Array.isArray(remoteEntries) ? remoteEntries : [])];
    all.forEach(entry => {
      if (!entry || !entry[idKey]) return;
      const id = entry[idKey];
      if (!map.has(id)) {
        map.set(id, entry);
      } else {
        const existing = map.get(id);
        const existingTime = new Date(existing[timeKey] || 0).getTime();
        const entryTime = new Date(entry[timeKey] || 0).getTime();
        if (entryTime >= existingTime) {
          map.set(id, entry);
        }
      }
    });
    return Array.from(map.values());
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
      const localTime = new Date(localRoutine.updated_at || localRoutine.lastRunAt || 0).getTime();
      const remoteTime = new Date(remoteRoutine.updated_at || remoteRoutine.lastRunAt || 0).getTime();

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
      if (options && typeof options.onConflict === 'function') {
        try { options.onConflict(conflictEvent); } catch (e) {}
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('nexus:conflict', { detail: conflictEvent }));
        } catch (e) {}
      }
    }

    return {
      resolved,
      winner,
      rollback: () => JSON.parse(JSON.stringify(localRoutine))
    };
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

  // MCP Server Contract
  function isMcpServerEnabled(providerId, appConnections) {
    if (!appConnections || typeof appConnections !== 'object') return false;
    const conn = appConnections[providerId];
    return Boolean(conn && conn.mcpEnabled === true);
  }

  function formatMcpToolCall(serverName, toolName, args = {}) {
    let parsedArgs = args;
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        throw new Error('Malformed JSON in MCP tool arguments: ' + e.message);
      }
    }
    if (typeof parsedArgs !== 'object' || parsedArgs === null || Array.isArray(parsedArgs)) {
      throw new Error('MCP tool arguments must be a valid JSON object');
    }
    return {
      jsonrpc: '2.0',
      id: secureRandomId('mcp'),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parsedArgs || {},
        server: serverName
      }
    };
  }

  function parseMcpToolCall(raw) {
    if (typeof raw !== 'string') {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
      throw new Error('Invalid MCP payload: expected string or object');
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid MCP payload: root must be an object');
      }
      return parsed;
    } catch (err) {
      throw new Error('Malformed JSON in MCP payload: ' + err.message);
    }
  }

  function validateMcpToolApproval(serverName, toolName) {
    if (!toolName || typeof toolName !== 'string') return false;
    const lower = toolName.toLowerCase();
    return /execute|write|delete|create|drop|update|push|send|deploy/i.test(lower);
  }

  // Memory Cleanup & Concurrency Lock
  function createSyncLock() {
    let _locked = false;
    const _waiters = [];

    return {
      async acquire() {
        if (!_locked) {
          _locked = true;
          return;
        }
        await new Promise(resolve => _waiters.push(resolve));
        _locked = true;
      },
      release() {
        if (_waiters.length > 0) {
          const next = _waiters.shift();
          next();
        } else {
          _locked = false;
        }
      },
      isLocked: () => _locked
    };
  }

  function cleanMemoryState(state, pruneThreshold = 100) {
    if (!state || typeof state !== 'object') return state;
    if (Array.isArray(state.chats)) {
      state.chats.forEach(chat => {
        if (chat && Array.isArray(chat.messages) && chat.messages.length > pruneThreshold) {
          chat.messages = chat.messages.slice(-pruneThreshold);
        }
      });
    }
    return state;
  }

  function resolveProviderModelId(uiModel, isOpenRouter = false) {
    const m = String(uiModel || 'gemini-3.8-flash').toLowerCase();
    if (isOpenRouter) {
      if (m.includes('deepseek-v4-pro')) return 'deepseek/deepseek-v4-pro';
      if (m.includes('deepseek')) return 'deepseek/deepseek-flash';
      if (m.includes('kimi-k3')) return 'moonshotai/kimi-k3';
      if (m.includes('kimi')) return 'moonshotai/kimi-k2.7-code';
      if (m.includes('grok')) return 'x-ai/grok-4.7';
      return 'google/gemini-3.8-flash';
    }
    if (m === 'deepseek-flash') return 'deepseek-flash';
    if (m === 'deepseek-v4-pro') return 'deepseek-v4-pro';
    if (m === 'kimi-k2.7-code') return 'kimi-k2.7-code';
    if (m === 'kimi-k3') return 'kimi-k3';
    if (m === 'grok-4.7') return 'grok-4.7';
    return 'gemini-3.8-flash';
  }

  function recordModelTokenAndCostUsage(modelId, promptText, replyText, apiUsageObj = null) {
    const m = String(modelId || 'gemini-3.8-flash').toLowerCase();
    const ratePerMillion = m.includes('deepseek-flash') ? 0.014
      : m.includes('deepseek-v4-pro') ? 0.28
      : m.includes('kimi') ? 0.15
      : m.includes('grok') ? 0.30
      : 0.015;
    let usedTokens = 0;
    if (apiUsageObj && Number.isFinite(Number(apiUsageObj.totalTokenCount || apiUsageObj.total_tokens))) {
      usedTokens = Math.max(1, Math.round(Number(apiUsageObj.totalTokenCount || apiUsageObj.total_tokens)));
    } else {
      const totalChars = String(promptText || '').length + String(replyText || '').length;
      usedTokens = Math.max(32, Math.round(totalChars / 3.5));
    }

    const state = (typeof window !== 'undefined' && window.appState) ? window.appState : (typeof globalThis !== 'undefined' ? globalThis.appState : null);
    if (state) {
      state.totalTokensUsed = (Number(state.totalTokensUsed) || 0) + usedTokens;
      state.totalEstimatedCostUSD = (Number(state.totalEstimatedCostUSD) || 0) + ((usedTokens / 1000000) * ratePerMillion);
    }
    return { usedTokens, ratePerMillion };
  }

  function isAppGenuinelyConnected(appId) {
    const state = (typeof window !== 'undefined' && window.appState) ? window.appState : (typeof globalThis !== 'undefined' ? globalThis.appState : null);
    const conn = state?.appConnections?.[appId];
    if (!conn) return false;
    if (appId === 'github' && typeof conn.owner === 'string' && conn.owner.trim() && typeof conn.repo === 'string' && conn.repo.trim()) return true;
    if (appId === 'clash_royale' && (conn.playerTag || conn.token)) return true;
    if (Array.isArray(conn.accounts) && conn.accounts.length > 0) return true;
    if (conn.token && String(conn.token).trim().length > 0) return true;
    if (conn.mcpEnabled === true) return true;
    return false;
  }

  const APPS_CATALOG = [
    { id: 'github', name: 'GitHub', category: 'Dev & AI', type: 'App', author: 'GitHub', website: 'https://github.com', desc: 'Access, search, and organize repos, track issues, review pull requests, and automate workflows directly in Nexus.' },
    { id: 'gmail', name: 'Gmail', category: 'Productivity', type: 'MultiAccount', author: 'Google', website: 'https://mail.google.com', desc: 'Access, search, organize and reply to emails easily with multi-account support for improved productivity.' },
    { id: 'gcal', name: 'Google Calendar', category: 'Productivity', type: 'MultiAccount', author: 'Google', website: 'https://calendar.google.com', desc: 'Schedule, view, and manage your daily events and routines across multiple calendars.' },
    { id: 'picsart', name: 'Picsart', category: 'Dev & AI', type: 'MCP', author: 'Picsart', website: 'https://picsart.com', docs: 'https://docs.picsart.io', desc: 'Create and edit image, video, and audio assets with Picsart model catalog. Generate media, remove backgrounds, and vectorize artwork.' },
    { id: 'instagram', name: 'Instagram', beta: true, category: 'Productivity', type: 'App', author: 'Meta', website: 'https://instagram.com', prereq: 'You must have an Instagram professional account to post directly.', desc: 'Connect your Instagram account to ideate, plan, and automatically publish content as Posts, Stories, and Reels.' },
    { id: 'ig_creator', name: 'Instagram Creator Marketplace', beta: true, category: 'Productivity', type: 'App', author: 'Meta', website: 'https://instagram.com', desc: 'Discover creators that fit your brand and campaign goals.' },
    { id: 'meta_ads', name: 'Meta Ads Manager', beta: true, category: 'Finance', type: 'App', author: 'Meta', website: 'https://business.facebook.com', desc: 'Automate ads insights and optimization across Meta campaigns.' },
    { id: 'myfitnesspal', name: 'MyFitnessPal', category: 'Health', type: 'App', author: 'MyFitnessPal', website: 'https://myfitnesspal.com', desc: 'Explore your MyFitnessPal nutrition, calorie intake, and macro logs for your workout app.' },
    { id: 'withings', name: 'Withings', category: 'Health', type: 'App', author: 'Withings', website: 'https://withings.com', desc: 'Explore your Withings body, activity, and sleep metrics.' },
    { id: 'polar', name: 'Polar', category: 'Health', type: 'App', author: 'Polar', website: 'https://polar.com', desc: 'Explore your Polar training, activity, and recovery data.' },
    { id: 'trainingpeaks', name: 'TrainingPeaks', category: 'Health', type: 'App', author: 'TrainingPeaks', website: 'https://trainingpeaks.com', desc: 'Explore your TrainingPeaks workouts and endurance metrics.' },
    { id: 'plaid', name: 'Plaid', category: 'Finance', type: 'App', author: 'Plaid', website: 'https://plaid.com', desc: 'Connect Plaid to securely read transactions and account balances.' },
    { id: 'clue', name: 'Clue', category: 'Health', type: 'App', author: 'Clue', website: 'https://helloclue.com', desc: 'Explore your Clue cycle and reproductive health insights.' },
    { id: 'cronometer', name: 'Cronometer', category: 'Health', type: 'App', author: 'Cronometer', website: 'https://cronometer.com', desc: 'Explore your Cronometer nutrition and biometric data.' },
    { id: 'fitbit', name: 'Fitbit', category: 'Health', type: 'App', author: 'Google', website: 'https://fitbit.com', desc: 'Explore your Fitbit activity, sleep, and heart rate trends.' },
    { id: 'oura', name: 'Oura', category: 'Health', type: 'App', author: 'Oura', website: 'https://ouraring.com', desc: 'Explore your Oura sleep, readiness, and activity scores.' },
    { id: 'shopify', name: 'Shopify', beta: true, category: 'Finance', type: 'App', author: 'Shopify', website: 'https://shopify.com', desc: 'Streamline operations, unlock insights, and manage store orders.' },
    { id: 'outlook_cal', name: 'Outlook Calendar', category: 'Productivity', type: 'MultiAccount', author: 'Microsoft', website: 'https://outlook.live.com', desc: 'Schedule, view, and manage your Outlook Calendar events.' },
    { id: 'outlook_mail', name: 'Outlook Mail', category: 'Productivity', type: 'MultiAccount', author: 'Microsoft', website: 'https://outlook.live.com', desc: 'Write, search, and manage your Outlook emails.' },
    { id: 'gworkspace', name: 'Google Workspace', category: 'Productivity', type: 'MultiAccount', author: 'Google', website: 'https://workspace.google.com', desc: 'Access your files, search instantly across Drive, Docs, and Sheets.' },
    { id: 'youtube', name: 'YouTube', category: 'Productivity', type: 'MultiAccount', author: 'Google', website: 'https://youtube.com', desc: 'Manage your YouTube channel, view live subscriber stats, and publish Shorts from Clash Studio.' },
    { id: 'tailscale', name: 'Tailscale', category: 'Dev & AI', type: 'MCP', author: 'Tailscale', website: 'https://tailscale.com', desc: 'Connect your cloud computer or sandbox to your private Tailnet.' },
    { id: 'google_ads', name: 'Google Ads', beta: true, category: 'Finance', type: 'App', author: 'Google', website: 'https://ads.google.com', desc: 'Query and analyze your Google Ads campaigns and conversions.' },
    { id: 'tomtom', name: 'TomTom Maps', category: 'Travel', type: 'App', author: 'TomTom', website: 'https://tomtom.com', desc: 'Access geocoding, routing, traffic, and location search.' },
    { id: 'ilert', name: 'ilert', category: 'Dev & AI', type: 'App', author: 'ilert', website: 'https://ilert.com', desc: 'Query and act on alerts, incidents, and on-call schedules.' },
    { id: 'wrike', name: 'Wrike', category: 'Productivity', type: 'App', author: 'Wrike', website: 'https://wrike.com', desc: 'Manage projects, organize tasks, and collaborate with teams.' },
    { id: 'neimo', name: 'Neimo', category: 'Dev & AI', type: 'MCP', author: 'Neimo', website: 'https://neimo.ai', desc: 'Accelerate AI regulatory intelligence and compliance checks.' },
    { id: 'atlassian', name: 'Atlassian', category: 'Productivity', type: 'App', author: 'Atlassian', website: 'https://atlassian.com', desc: 'Search, create, and manage Jira issues and Confluence pages.' },
    { id: 'hubspot', name: 'HubSpot', beta: true, category: 'Finance', type: 'App', author: 'HubSpot', website: 'https://hubspot.com', desc: 'Search CRM data, track contacts, and manage deals.' },
    { id: 'intercom', name: 'Intercom', category: 'Productivity', type: 'App', author: 'Intercom', website: 'https://intercom.com', desc: 'Access customer conversations, analyze support tickets.' },
    { id: 'close_crm', name: 'Close', category: 'Finance', type: 'App', author: 'Close', website: 'https://close.com', desc: 'Automate your sales leads pipeline and outreach.' },
    { id: 'explorium', name: 'Explorium', category: 'Finance', type: 'MCP', author: 'Explorium', website: 'https://explorium.ai', desc: 'Access comprehensive business and prospect data signals.' },
    { id: 'revenuecat', name: 'RevenueCat', category: 'Finance', type: 'App', author: 'RevenueCat', website: 'https://revenuecat.com', desc: 'Manage subscription apps, control entitlements and in-app purchases.' },
    { id: 'morningstar', name: 'Morningstar', beta: true, category: 'Finance', type: 'App', author: 'Morningstar', website: 'https://morningstar.com', desc: 'Access Morningstar investment data and portfolio analytics.' },
    { id: 'jam', name: 'Jam', category: 'Dev & AI', type: 'MCP', author: 'Jam.dev', website: 'https://jam.dev', desc: 'Analyze screen recordings, console logs, and network context for bug reports.' },
    { id: 'granola', name: 'Granola', category: 'Productivity', type: 'App', author: 'Granola', website: 'https://granola.so', desc: 'Search, summarize and gather insights from meeting notes.' },
    { id: 'monday', name: 'monday.com', category: 'Productivity', type: 'App', author: 'monday.com', website: 'https://monday.com', desc: 'Coordinate tasks, manage boards, and track team sprints.' },
    { id: 'clickup', name: 'ClickUp', category: 'Productivity', type: 'App', author: 'ClickUp', website: 'https://clickup.com', desc: 'Automate task management and project documentation.' },
    { id: 'sentry', name: 'Sentry', category: 'Dev & AI', type: 'MCP', author: 'Sentry', website: 'https://sentry.io', desc: 'Review errors, analyze root causes, and debug stack traces.' },
    { id: 'todoist', name: 'Todoist', category: 'Productivity', type: 'App', author: 'Doist', website: 'https://todoist.com', desc: 'Organize your to-dos, streamline personal and team tasks.' },
    { id: 'minimax', name: 'MiniMax', category: 'Dev & AI', type: 'MCP', author: 'MiniMax', website: 'https://minimaxi.com', desc: 'Generate speech, music, images, and video assets via MCP.' },
    { id: 'apollo', name: 'Apollo', category: 'Finance', type: 'App', author: 'Apollo.io', website: 'https://apollo.io', desc: 'Find, enrich, and engage B2B prospects.' },
    { id: 'pophive', name: 'PopHIVE', category: 'Health', type: 'App', author: 'PopHIVE', website: 'https://pophive.org', desc: 'Access public health data and epidemiological benchmarks.' },
    { id: 'posthog', name: 'PostHog', category: 'Dev & AI', type: 'MCP', author: 'PostHog', website: 'https://posthog.com', desc: 'Perform product analytics, manage feature flags and session replays.' },
    { id: 'jotform', name: 'Jotform', category: 'Productivity', type: 'App', author: 'Jotform', website: 'https://jotform.com', desc: 'Create, manage, and collect data through online forms.' },
    { id: 'firecrawl', name: 'Firecrawl', category: 'Dev & AI', type: 'MCP', author: 'Firecrawl', website: 'https://firecrawl.dev', desc: 'Unlock powerful web scraping, crawling, and markdown extraction for agents.' },
    { id: 'xero', name: 'Xero', category: 'Finance', type: 'App', author: 'Xero', website: 'https://xero.com', desc: 'View financial data, generate reports, and track invoices.' },
    { id: 'box', name: 'Box', category: 'Productivity', type: 'App', author: 'Box', website: 'https://box.com', desc: 'Search Box files to preview and analyze documents.' },
    { id: 'mercury', name: 'Mercury', beta: true, category: 'Finance', type: 'App', author: 'Mercury', website: 'https://mercury.com', desc: 'Review accounts, track banking activity, and treasury flows.' },
    { id: 'neon', name: 'Neon', category: 'Dev & AI', type: 'MCP', author: 'Neon', website: 'https://neon.tech', desc: 'Use natural language to query and manage serverless Postgres databases.' },
    { id: 'fireflies', name: 'Fireflies', category: 'Productivity', type: 'App', author: 'Fireflies.ai', website: 'https://fireflies.ai', desc: 'Automate meeting transcription and voice notes.' },
    { id: 'linear', name: 'Linear', category: 'Dev & AI', type: 'App', author: 'Linear', website: 'https://linear.app', desc: 'Track issues, manage projects, and organize engineering roadmaps.' },
    { id: 'zoho', name: 'Zoho', beta: true, category: 'Productivity', type: 'App', author: 'Zoho', website: 'https://zoho.com', desc: 'Connect, automate, and execute workflows across Zoho CRM.' },
    { id: 'context7', name: 'Context7', category: 'Dev & AI', type: 'MCP', author: 'Upstash', website: 'https://context7.com', desc: 'Access current, library-specific technical documentation for coding agents.' },
    { id: 'webflow', name: 'Webflow', category: 'Dev & AI', type: 'App', author: 'Webflow', website: 'https://webflow.com', desc: 'Manage Webflow sites, edit pages, and publish CMS items.' },
    { id: 'paypal', name: 'PayPal for Business', category: 'Finance', type: 'App', author: 'PayPal', website: 'https://paypal.com', desc: 'Manage transactions, invoices, and business balances.' },
    { id: 'asana', name: 'Asana', category: 'Productivity', type: 'App', author: 'Asana', website: 'https://asana.com', desc: 'Streamline project and task management.' },
    { id: 'serena', name: 'Serena', category: 'Dev & AI', type: 'MCP', author: 'Serena', website: 'https://github.com/oraios/serena', desc: 'Unlock efficient code management and AST semantic search via MCP.' },
    { id: 'tldv', name: 'tl;dv', category: 'Productivity', type: 'App', author: 'tl;dv', website: 'https://tldv.io', desc: 'Streamline meeting workflows with transcripts and highlights.' },
    { id: 'wix', name: 'Wix', category: 'Productivity', type: 'App', author: 'Wix', website: 'https://wix.com', desc: 'Search website data, access content, and manage Wix stores.' },
    { id: 'playwright', name: 'Playwright', category: 'Dev & AI', type: 'MCP', author: 'Microsoft', website: 'https://playwright.dev', desc: 'Automate browsers for E2E testing, scraping, and visual verification.' },
    { id: 'elevenlabs', name: 'ElevenLabs', category: 'Dev & AI', type: 'MCP', author: 'ElevenLabs', website: 'https://elevenlabs.io', desc: 'Generate, clone, and transcribe lifelike voiceovers for Shorts & Reels.' },
    { id: 'line', name: 'LINE', category: 'Productivity', type: 'App', author: 'LY Corp', website: 'https://line.me', desc: 'Connect to LINE Official Accounts for automated messaging.' },
    { id: 'coingecko', name: 'CoinGecko', category: 'Finance', type: 'MCP', author: 'CoinGecko', website: 'https://coingecko.com', desc: 'Access real-time crypto market data, prices, and trends.' },
    { id: 'clash_royale', name: 'Clash Royale Official API', category: 'Dev & AI', type: 'App', author: 'Supercell', website: 'https://developer.clashroyale.com', desc: 'Live player battle logs, Electro Giant meta win-rates, and clan analytics.' }
  ];

  // Ensure all apps in catalog have their capability tier explicitly set
  APPS_CATALOG.forEach(app => {
    if (!app.tier) {
      app.tier = getProviderTier(app.id);
    }
  });

  return {
    STORAGE_KEYS,
    STORAGE_KEY,
    PROVIDER_TIERS,
    PROVIDERS,
    normalizeProviderTier,
    getProviderConfig,
    getProviderTier,
    getProviderTierBadge,
    APPS_CATALOG,
    GOOGLE_OAUTH_SCOPES,
    PROVIDER_ACTION_SCOPES,
    getGoogleScopes,
    validateRequestedGoogleScope,
    getRequiredScope,
    validateProviderScope,
    isMutatingOrSensitiveAction,
    isSensitiveProviderAction,
    _withTimeout,
    formatProviderError,
    executeWithRetry,
    executeProviderRequest,
    validateGithubPAT,
    validateGithubRepo,
    parseGithubCommits,
    parseGithubBranches,
    getAccountScopedKey,
    validateGoogleTokenFreshness,
    formatGoogleRefreshTokenRequest,
    isolateMultiAccountSession,
    validateTelegramToken,
    validateTelegramWebhookLease,
    isTelegramRateLimited,
    deduplicateKVEntries,
    resolveRoutineConflicts,
    isMcpServerEnabled,
    formatMcpToolCall,
    parseMcpToolCall,
    validateMcpToolApproval,
    createSyncLock,
    cleanMemoryState,
    resolveProviderModelId,
    recordModelTokenAndCostUsage,
    isAppGenuinelyConnected,
    secureRandomId,
    issueApprovalToken,
    consumeApprovalToken,
    verifyApprovalToken,
    clearApprovalTokens,
    canonicalizeJson,
    _hashParams,
    _generateTokenNonce,
    _sha256Pure
  };
});
