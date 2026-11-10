# EG Nexus OS — AI Agents Architecture & Engineering Blueprint

> **Notice to All AI Assistants (Claude, Gemini, Copilot, ChatGPT, Antigravity, etc.):**  
> This file is the **Single Source of Truth (SSOT)** for all architectural, security, and coding rules in the `EG-Nexus-OS` repository. Every instruction herein is strictly binding. No rule may be bypassed, simplified, or weakened under any circumstances.

---

## 1. Core Architecture Overview

`EG-Nexus-OS` is an offline-first, mobile-optimized (strict 390×844 CSS viewport), full-stack Personal AI Operating System delivered as a zero-build Single Page Application (`index.html`) and packaged as an Android APK via Capacitor 8.5.3.

### 5-Phase Layered Architecture:
1. **Phase 1 — Core State & Local Persistence:**  
   `appState`, `uiState`, reactive DOM binding, and fail-safe, self-healing `localStorage` / `sessionStorage`.
2. **Phase 2 — UI Engine & Mobile Canvas:**  
   Strict 390×844 mobile viewport, Persian RTL layout with technical LTR spans, live visual canvas, markdown KaTeX rendering, and safe DOM manipulation (`escapeHtml`, `escapeJsAttr`).
3. **Phase 3 — Agent Swarm, Skills & Brain Context:**  
   Multi-model agent orchestrator (Gemini, OpenRouter, DeepSeek, Grok, Kimi), bounded Brain memory nodes, contextual skill synthesis, and approval gates.
4. **Phase 4 — 24/7 Cloud Worker, Supabase & Telegram Bridge:**  
   Cloudflare Workers ES module (`generateCloudflareWorkerScript`), distributed KV deduplication/locks, Supabase PostgreSQL synchronization, and bidirectional Telegram Bot API polling.
5. **Phase 5 — My Computer Bridge (Android Termux) & Studio:**  
   Native local node runner on Android Termux (`generateTermuxBridgeScript`), 4-tier action execution policy, and zero-trust loopback token pairing.

---

## 2. Seven Mandatory Invariant Rules (Zero AI Technical Debt)

### Rule 1: Search-First Anti-Sprawl (ممنوعیت کد تکراری)
- **Before adding any function, handler, serializer, modal, or global variable in `index.html`:**  
  You MUST search the entire file with `grep` or text search first.
- **Always extend or refactor the existing primary function.**  
  Never introduce shadow functions (e.g. `saveState2`, `renderMessagesNew`, `escapeHTML2`), parallel listeners, or duplicate state objects. Dead code and duplicate implementations will be rejected immediately.

### Rule 2: Single Source of Truth & Sync Gate (تضمین برابری فایل‌ها)
- **Root vs. `www/` Parity:**  
  `index.html` and `www/index.html` must remain **100% byte-for-byte identical** at all times.  
  Likewise, `sw.js` and `www/sw.js` must remain **100% byte-for-byte identical**.  
  Command to verify:
  ```bash
  cp index.html www/index.html && cp sw.js www/sw.js
  diff -q index.html www/index.html && diff -q sw.js www/sw.js
  ```
- **Configuration Parity:**  
  Android WebView security configurations must match across all files:
  - `cleartext: false`
  - `allowMixedContent: false`
  - `allowNavigation: ["localhost", "127.0.0.1"]` (Never include `*.local` or broad wildcards)
  - Must be identical in `capacitor.config.json`, embedded `generateInternalCapacitorConfig()`, and embedded `generateGitHubActionsApkWorkflow()`.
- **CI/CD Workflow Hardening:**  
  In `.github/workflows/nexus-factory.yml` and the internal generator:
  - Top-level / build job permissions must be minimal (`contents: read`).
  - Only dedicated publish jobs may have `contents: write`.

### Rule 3: Scope & Reference Guard (جلوگیری از خطاهای TDZ و دامنه متغیر)
- When modifying large functions (especially `renderChatMessages`, Termux bridge handlers, and Cloudflare Worker endpoints):
  - Audit all referenced variables in that scope before concluding the edit.
  - Ensure every variable (`previousNodes`, `templateChildren`, `safeCwd`, `lockToken`, etc.) is declared and initialized before use.
  - Zero tolerance for `ReferenceError` or Temporal Dead Zone (TDZ) bugs.

### Rule 4: Embedded Template Escaping & Safe Injection (ایمن‌سازی قالب‌های متنی)
- Both the Cloudflare Worker script and the Termux Bridge script are embedded as JavaScript template literals (enclosed in backticks `` `...` ``) inside `index.html`.
- **Double-Escaping Rule:**  
  All regular expression meta-characters inside embedded script generators MUST be double-escaped:
  - Write `\\s`, `\\n`, `\\r`, `\\b`, `\\d`, `\\/`, `\\$`, `\\`` instead of single backslashes.
  - Failure to double-escape causes template literal evaluation to convert `\n` into a physical newline, breaking regular expressions into invalid syntax.
- **Safe Dynamic Values Injection:**  
  User-supplied or multiline configuration strings (such as `allowedFolders` or `workspaceId`) MUST be injected using `JSON.stringify(...)`, never raw string interpolation.
  ```javascript
  // CORRECT:
  const DEFAULT_WORKSPACE = ${JSON.stringify(rawAllowedFolders)};
  
  // FORBIDDEN (breaks syntax on newlines):
  const DEFAULT_WORKSPACE = "${rawAllowedFolders}";
  ```

### Rule 5: Security & Token Isolation Invariants (امنیت و تفکیک توکن‌ها)
- **XSS Prevention:**  
  All dynamic content injected into `innerHTML` must be escaped with `escapeHtml()` or `escapeJsAttr()`, or set via `textContent`.
- **Credential Storage Isolation:**  
  - Sensitive credentials (`workerSecret`, `supabaseKey`, `supabaseAuthToken`, `botToken`, `bridgeToken`, Google OAuth tokens) must **NEVER** be saved in plaintext inside `localStorage`.
  - Credentials must reside in memory (`appState`) and temporary session storage (`sessionStorage`).
- **Google OAuth Multi-Account Namespacing:**  
  - Google OAuth tokens must be stored in `secrets.accountTokens` with namespaced keys: `${appId}_${accountId}` and `${accountId}`.
  - Adding a new Google account or switching accounts must NEVER wipe or overwrite tokens belonging to other connected accounts.
- **Fail-Closed Secret Revocation on Endpoint/Workspace Change:**  
  - Any change in `workerUrl` or `supabaseUrl` during backup import (including transition between empty and configured) or change in `workspaceId` MUST immediately revoke prior secrets in `sessionStorage` and purge pending `CLOUD_SYNC` tasks from `offlineQueue`.
- **MCP & Model Invocation Guard:**  
  - Testing or executing MCP server tools must strictly verify `mcpEnabled === true`.
  - Harmless health check and schema validation must be preferred over side-effecting/billing API executions in test buttons.
  - Invocations of destructive commands must require explicit user confirmation through `requestPhase5ConfirmModal` or `triggerApprovalGate`.

### Rule 6: Zero-Regression & Test Integrity (حفظ کدهای سالم و صداقت آزمون‌ها)
- **Do NOT delete, stub out, or minify existing features.**  
  Historical fixes and edge-case protections (Reviewers #1 to #28) are intentional and must remain intact.
- **Test Integrity:**  
  Never delete, comment out, or simplify assertions in `full_app_audit.py`, `test_full_app_audit.py`, or `__tests__/*.spec.js` to fake a passing test. If a test fails, fix the underlying code, not the test!

### Rule 7: Git Hygiene (پاکیزگی مخزن و شاخص گیت)
- Never track or commit compiled Python files (`__pycache__/`, `*.pyc`).
- Never commit build output artifacts (`*.apk`, `node_modules/`, temporary test outputs).
- Never commit real API keys, GitHub Personal Access Tokens (PAT), or private credentials.
- Always review `git status` and `git diff` before committing.

---

## 3. Automated Verification Checklist

Before pushing any commit, execute and ensure 100% pass rate:

```bash
# 1. Sync check: ensure root and www/ files are identical
cp index.html www/index.html && cp sw.js www/sw.js
diff -q index.html www/index.html && diff -q sw.js www/sw.js

# 2. JavaScript AST Syntax Check (all 5 blocks in index.html)
npm run test:syntax

# 3. Jest Unit & Regression Tests (Service Worker & ID Generators)
npm test

# 4. Python Static Security & Feature Crawl Audit
python3 full_app_audit.py

# 5. Full Architecture & Embedded Script Integration Tests
python3 test_full_app_audit.py
```

---

## 4. UI/UX Invariants
- **Viewport:** Strict 390×844 CSS pixels mobile iframe layout.
- **RTL / LTR Mixing:** Persian UI labels (`font-sans`), technical IDs, code blocks, endpoints, and tokens in LTR (`dir="ltr"`, `font-mono`).
- **No Overlaps:** Always use `shrink-0` or `flex-shrink: 0` for icons, badges, buttons, and avatar circles.
- **Touch Targets:** All interactive touch targets must be at least 40×40 CSS pixels.
- **Honest Fallbacks:** When cloud or native services are offline, render truthful fallback badges and status messages, never fake success indicators.
