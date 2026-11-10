/**
 * EG-Nexus-OS — Providers & App Catalog Registry Module
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

  function getGoogleScopes(appId) {
    return GOOGLE_OAUTH_SCOPES[appId] || 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  }

  function validateRequestedGoogleScope(scope) {
    if (typeof scope !== 'string' || !scope.trim()) return false;
    const tokens = scope.trim().split(/\s+/);
    return tokens.every(token => /^https:\/\/(?:www\.)?googleapis\.com\/auth\/[a-zA-Z0-9._-]+$/i.test(token));
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

  return {
    APPS_CATALOG,
    GOOGLE_OAUTH_SCOPES,
    getGoogleScopes,
    validateRequestedGoogleScope,
    resolveProviderModelId,
    recordModelTokenAndCostUsage,
    isAppGenuinelyConnected
  };
});
