# GitHub Copilot Instructions for EG-Nexus-OS

This repository strictly enforces the architectural and security invariants documented in [AGENTS.md](../AGENTS.md).

## Critical Guidelines for Copilot:
1. **Search Before Implementing:** Always grep `index.html` to find existing implementations before introducing any new function, object, or variable. Do not generate duplicate or parallel functions.
2. **Synchronize Root & www/:** Any change in `index.html` must be duplicated to `www/index.html`. Any change in `sw.js` must be duplicated to `www/sw.js`. Both pairs must be byte-for-byte identical.
3. **Template Literal Escaping:** In script generators (`generateCloudflareWorkerScript` and `generateTermuxBridgeScript`), all regular expression meta-characters must be double-escaped (`\\s`, `\\n`, `\\r`, `\\b`, `\\/`), and multiline strings like `allowedFolders` must be wrapped in `JSON.stringify()`.
4. **Security & Tokens:**
   - Use `escapeHtml()` or `textContent` for dynamic values in DOM.
   - Do not write raw auth tokens or secrets to `localStorage`.
   - Google OAuth tokens must be namespaced per app and account (`${appId}_${accountId}`).
   - Abort/revoke worker and supabase secrets on endpoint or workspace changes during backup imports.
   - Guard MCP executions with `mcpEnabled` check and user confirmations.
5. **No Regressions:** Do not remove, simplify, or bypass existing unit or static tests.
6. **Required Validation Commands:**
   - `npm run test:syntax`
   - `npm test`
   - `python3 full_app_audit.py`
   - `python3 test_full_app_audit.py`
