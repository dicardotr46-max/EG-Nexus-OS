/**
 * EG-Nexus-OS — Providers & App Catalog Registry Module
 * Production-grade provider contracts, scope checking, HTTP error handling, retry resilience, and MCP validation
 * UMD / ESM compatible (Node.js, Jest, and Browser)
 */
(function(root, factory) {
  const exports = factory();
  /* istanbul ignore else */
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = exports;
  }
  /* istanbul ignore next */
  if (root) {
    Object.assign(root, exports);
    root.NexusProviders = exports;
    root._nexusCoreProviders = exports;
    root._nexusCoreRegistry = exports;
  }
  /* istanbul ignore next */
  if (typeof globalThis !== 'undefined') {
    globalThis.NexusProviders = exports;
    globalThis._nexusCoreProviders = exports;
    globalThis._nexusCoreRegistry = exports;
  }
  /* istanbul ignore next */
  if (typeof window !== 'undefined') {
    Object.assign(window, exports);
    window.NexusProviders = exports;
    window._nexusCoreProviders = exports;
    window._nexusCoreRegistry = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : /* istanbul ignore next */ this, function() {
  'use strict';

  const STORAGE_KEY = 'eg_nexus_os_v5_master_state';

  // Provider Capability Tiers
  const PROVIDER_TIERS = {
    PRODUCTION_READY: 'production-ready',
    CONTRACT_TESTED: 'contract-tested',
    CATALOG_ADAPTER: 'catalog-adapter'
  };

  // Full Provider Configurations with Explicit Capability Tiers
  const PROVIDERS = {
    // Production-Ready: Full OAuth 2.0 / REST contracts, scoped auth & production retry semantics
    github: {
      id: 'github',
      name: 'GitHub',
      tier: 'production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://github.com',
      authType: 'pat_or_oauth'
    },
    gmail: {
      id: 'gmail',
      name: 'Gmail',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://mail.google.com',
      authType: 'google_oauth'
    },
    gcal: {
      id: 'gcal',
      name: 'Google Calendar',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://calendar.google.com',
      authType: 'google_oauth'
    },
    calendar: {
      id: 'calendar',
      name: 'Google Calendar',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://calendar.google.com',
      authType: 'google_oauth'
    },
    google_drive: {
      id: 'google_drive',
      name: 'Google Drive',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://drive.google.com',
      authType: 'google_oauth'
    },
    drive: {
      id: 'drive',
      name: 'Google Drive',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://drive.google.com',
      authType: 'google_oauth'
    },
    gworkspace: {
      id: 'gworkspace',
      name: 'Google Workspace',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://workspace.google.com',
      authType: 'google_oauth'
    },
    youtube: {
      id: 'youtube',
      name: 'YouTube',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://youtube.com',
      authType: 'google_oauth'
    },
    google_sheets: {
      id: 'google_sheets',
      name: 'Google Sheets',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://sheets.google.com',
      authType: 'google_oauth'
    },
    google_contacts: {
      id: 'google_contacts',
      name: 'Google Contacts',
      tier: 'production-ready',
      category: 'Productivity',
      type: 'MultiAccount',
      website: 'https://contacts.google.com',
      authType: 'google_oauth'
    },
    google_ads: {
      id: 'google_ads',
      name: 'Google Ads',
      tier: 'production-ready',
      category: 'Finance',
      type: 'App',
      website: 'https://ads.google.com',
      authType: 'google_oauth'
    },
    fitbit: {
      id: 'fitbit',
      name: 'Fitbit',
      tier: 'production-ready',
      category: 'Health',
      type: 'App',
      website: 'https://fitbit.com',
      authType: 'google_oauth'
    },
    cloudflare: {
      id: 'cloudflare',
      name: 'Cloudflare Worker',
      tier: 'production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://cloudflare.com',
      authType: 'api_token'
    },
    cloudflare_worker: {
      id: 'cloudflare_worker',
      name: 'Cloudflare Worker',
      tier: 'production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://cloudflare.com',
      authType: 'api_token'
    },
    supabase: {
      id: 'supabase',
      name: 'Supabase',
      tier: 'production-ready',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://supabase.com',
      authType: 'api_key_or_jwt'
    },

    // Contract-Tested: Formal schema validation, lease/webhook verification & local socket bridge
    telegram: {
      id: 'telegram',
      name: 'Telegram Bot API',
      tier: 'contract-tested',
      category: 'Productivity',
      type: 'App',
      website: 'https://telegram.org',
      authType: 'bot_token'
    },
    termux: {
      id: 'termux',
      name: 'Termux Local Bridge',
      tier: 'contract-tested',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://termux.dev',
      authType: 'local_socket'
    },
    clash_royale: {
      id: 'clash_royale',
      name: 'Clash Royale Official API',
      tier: 'contract-tested',
      category: 'Dev & AI',
      type: 'App',
      website: 'https://developer.clashroyale.com',
      authType: 'api_token'
    },
    coingecko: {
      id: 'coingecko',
      name: 'CoinGecko',
      tier: 'contract-tested',
      category: 'Finance',
      type: 'MCP',
      website: 'https://coingecko.com',
      authType: 'public_or_key'
    },

    // Catalog-Adapter: MCP tools, search bridges, and third-party SaaS adapters
    tavily: {
      id: 'tavily',
      name: 'Tavily Search',
      tier: 'catalog-adapter',
      category: 'Dev & AI',
      type: 'Search',
      website: 'https://tavily.com',
      authType: 'api_key'
    },
    web_search: {
      id: 'web_search',
      name: 'Web Search',
      tier: 'catalog-adapter',
      category: 'Dev & AI',
      type: 'Search',
      website: 'https://duckduckgo.com',
      authType: 'none'
    }
  };

  function getProviderConfig(providerId) {
    if (!providerId || typeof providerId !== 'string') return null;
    const norm = providerId.trim().toLowerCase();
    if (PROVIDERS[norm]) return PROVIDERS[norm];
    const cat = APPS_CATALOG.find(a => a.id.toLowerCase() === norm);
    if (cat) {
      return {
        id: cat.id,
        name: cat.name,
        tier: cat.tier || 'catalog-adapter',
        category: cat.category,
        type: cat.type,
        website: cat.website
      };
    }
    return null;
  }

  function getProviderTier(providerId) {
    if (!providerId || typeof providerId !== 'string') return 'catalog-adapter';
    const cfg = getProviderConfig(providerId);
    if (cfg && cfg.tier) return cfg.tier;
    const norm = providerId.trim().toLowerCase();
    if (['gmail', 'gcal', 'calendar', 'gworkspace', 'drive', 'google_drive', 'youtube', 'github', 'cloudflare', 'cloudflare_worker', 'supabase', 'google_sheets', 'google_contacts', 'google_ads', 'fitbit'].includes(norm)) {
      return 'production-ready';
    }
    if (['telegram', 'termux', 'clash_royale', 'coingecko'].includes(norm)) {
      return 'contract-tested';
    }
    return 'catalog-adapter';
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
    return GOOGLE_OAUTH_SCOPES[appId] || 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  }

  function validateRequestedGoogleScope(scope) {
    if (typeof scope !== 'string' || !scope.trim()) return false;
    const tokens = scope.trim().split(/\s+/);
    return tokens.every(token => /^https:\/\/(?:www\.)?googleapis\.com\/auth\/[a-zA-Z0-9._-]+$/i.test(token));
  }

  function getRequiredScope(providerId, action) {
    const p = PROVIDER_ACTION_SCOPES[providerId];
    if (p && p[action]) return p[action];
    return null;
  }

  function validateProviderScope(providerId, action, grantedScopes = null) {
    if (!providerId || typeof providerId !== 'string') return false;
    if (!action || typeof action !== 'string') return false;

    const pScopes = PROVIDER_ACTION_SCOPES[providerId];
    const requiredScope = pScopes ? pScopes[action] : null;

    if (grantedScopes === null || grantedScopes === undefined) {
      if (pScopes) {
        return Boolean(pScopes[action]);
      }
      return true;
    }

    if (!requiredScope) {
      return true;
    }

    let scopeList = [];
    if (Array.isArray(grantedScopes)) {
      scopeList = grantedScopes;
    } else if (typeof grantedScopes === 'string') {
      scopeList = grantedScopes.trim().split(/[\s,]+/);
    } else {
      return false;
    }

    if (scopeList.includes('*') || scopeList.includes('all') || scopeList.includes('admin')) {
      return true;
    }

    return scopeList.some(scope => {
      if (scope === requiredScope) return true;
      const shortRequired = requiredScope.replace(/^https:\/\/www\.googleapis\.com\/auth\//, '');
      const shortScope = scope.replace(/^https:\/\/www\.googleapis\.com\/auth\//, '');
      return shortScope === shortRequired || scope.includes(shortRequired);
    });
  }

  function isMutatingOrSensitiveAction(providerId, action) {
    if (!action || typeof action !== 'string') return false;
    const a = action.toLowerCase();
    if (/send|upload|publish|delete|exec|write|push|drop|truncate|setwebhook|deletewebhook|broadcast/i.test(a)) {
      return true;
    }
    if (providerId === 'termux' && (a === 'exec' || a === 'write_file' || a === 'delete_file')) return true;
    if (providerId === 'gmail' && (a === 'send' || a === 'delete')) return true;
    if (providerId === 'youtube' && (a === 'upload' || a === 'shorts_publish' || a === 'delete')) return true;
    if (providerId === 'github' && (a === 'push' || a === 'delete_repo')) return true;
    return false;
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
    const maxRetries = options.maxRetries !== undefined ? Math.max(0, Number(options.maxRetries)) : 3;
    const baseDelayMs = options.baseDelayMs !== undefined ? Math.max(0, Number(options.baseDelayMs)) : 100;
    const backoffFactor = options.backoffFactor !== undefined ? Number(options.backoffFactor) : 2;
    const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;

    let attempt = 0;
    while (true) {
      try {
        return await fn();
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
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async function executeProviderRequest(request) {
    if (!request || typeof request !== 'object') {
      return { status: 400, error: 'BAD_REQUEST', message: 'Invalid provider request payload' };
    }

    const {
      providerId,
      action,
      token,
      grantedScopes,
      executeFn,
      requireApproval = null,
      approved = false,
      retryOptions = { maxRetries: 3, baseDelayMs: 100 },
      appConnections = null,
      approvalGateHandler = null
    } = request;

    if (!providerId) {
      return { status: 400, error: 'BAD_REQUEST', message: 'providerId is required' };
    }

    // Step 1: Check MCP disabled status
    const catalogItem = APPS_CATALOG.find(app => app.id === providerId);
    if (catalogItem && catalogItem.type === 'MCP') {
      const conn = appConnections?.[providerId];
      if (conn && conn.mcpEnabled === false) {
        return {
          status: 403,
          error: 'MCP_DISABLED',
          message: `MCP server for ${providerId} is disabled.`
        };
      }
    }

    // Step 2: Validate provider action scope
    if (grantedScopes !== undefined && grantedScopes !== null) {
      const hasScope = validateProviderScope(providerId, action, grantedScopes);
      if (!hasScope) {
        return {
          status: 403,
          error: 'SCOPE_INSUFFICIENT',
          message: `Insufficient scope for action ${action} on provider ${providerId}`
        };
      }
    }

    // Step 3: Check Approval Queue requirement for mutating or sensitive actions
    const needsApproval = requireApproval === true || (requireApproval !== false && isMutatingOrSensitiveAction(providerId, action));
    if (needsApproval && !approved) {
      const reason = `Sensitive operation: ${action} on ${providerId} requires user confirmation.`;
      if (typeof approvalGateHandler === 'function') {
        try {
          approvalGateHandler({ reason, providerId, action });
        } catch (_) {}
      }
      return {
        status: 403,
        error: 'APPROVAL_REQUIRED',
        pendingApproval: true,
        reason
      };
    }

    // Step 4: Token presence validation for non-anonymous providers
    if (providerId !== 'clash_royale' && providerId !== 'coingecko' && (!token || !String(token).trim())) {
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

  function resolveRoutineConflicts(localRoutine, remoteRoutine) {
    if (!localRoutine) return { resolved: remoteRoutine, winner: 'remote' };
    if (!remoteRoutine) return { resolved: localRoutine, winner: 'local' };

    const localVer = Number(localRoutine.version) || 0;
    const remoteVer = Number(remoteRoutine.version) || 0;

    if (localVer > remoteVer) return { resolved: localRoutine, winner: 'local' };
    if (remoteVer > localVer) return { resolved: remoteRoutine, winner: 'remote' };

    const localTime = new Date(localRoutine.updated_at || localRoutine.lastRunAt || 0).getTime();
    const remoteTime = new Date(remoteRoutine.updated_at || remoteRoutine.lastRunAt || 0).getTime();

    if (remoteTime > localTime) {
      return { resolved: remoteRoutine, winner: 'remote' };
    }
    return { resolved: localRoutine, winner: 'local' };
  }

  // MCP Server Contract
  function isMcpServerEnabled(providerId, appConnections) {
    if (!appConnections || typeof appConnections !== 'object') return false;
    const conn = appConnections[providerId];
    return Boolean(conn && conn.mcpEnabled === true);
  }

  function formatMcpToolCall(serverName, toolName, args = {}) {
    return {
      jsonrpc: '2.0',
      id: `mcp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args || {},
        server: serverName
      }
    };
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
    STORAGE_KEY,
    PROVIDER_TIERS,
    PROVIDERS,
    getProviderConfig,
    getProviderTier,
    APPS_CATALOG,
    GOOGLE_OAUTH_SCOPES,
    PROVIDER_ACTION_SCOPES,
    getGoogleScopes,
    validateRequestedGoogleScope,
    getRequiredScope,
    validateProviderScope,
    isMutatingOrSensitiveAction,
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
    validateMcpToolApproval,
    createSyncLock,
    cleanMemoryState,
    resolveProviderModelId,
    recordModelTokenAndCostUsage,
    isAppGenuinelyConnected
  };
});
