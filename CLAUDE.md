# Claude Instructions for EG-Nexus-OS

@AGENTS.md

## Strict Project Instructions for Claude:
1. **Single Source of Truth:** All work in this repository is governed by the rules detailed in `AGENTS.md`.
2. **Search-First:** Grep before writing any new function in `index.html`. Upgrade existing functions; never create duplicates.
3. **File Parity:** Keep `index.html` and `www/index.html` 100% identical (`cp index.html www/index.html`). Keep `sw.js` and `www/sw.js` identical.
4. **Embedded Scripts Escaping:** Double-escape regex in Cloudflare Worker and Termux template strings (`\\s`, `\\n`, `\\r`, `\\b`, `\\/`), and always inject multiline variables with `JSON.stringify()`.
5. **Security Invariants:**
   - Escape dynamic content before setting `innerHTML`.
   - Never store tokens in `localStorage`.
   - Namespace Google session tokens under `${appId}_${accountId}`.
   - Fail-closed secret revocation on any endpoint or workspace change.
6. **Zero Regression:** Never delete existing functionality or tests.
7. **Verification:** Always run `npm run test:syntax`, `npm test`, `python3 test_full_app_audit.py`, and `python3 full_app_audit.py` before concluding.
