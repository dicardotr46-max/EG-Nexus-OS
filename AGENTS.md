# EG Nexus OS - AI Agents Blueprint

## Build & Test Commands
- **Syntax Check:** `npm run test:syntax` (or run `python3 full_app_audit.py`)
- **Android APK Build:** Clean up, setup Capacitor, and run `./gradlew assembleDebug` (via GitHub Actions `nexus-factory.yml`).

## 5-Phase Modular Architecture
1. **Core State & Persistence:** `appState`, `uiState`, robust self-healing `localStorage`.
2. **UI Engine:** Render functions tailored for mobile (390x844), using safe DOM manipulations (`escapeHtml`, `escapeJsAttr`).
3. **Agent Brain:** Swarm, Deep Research, Skills, Memory context.
4. **24/7 Cloud & Telegram Bridge:** Cloudflare workers integration, Telegram bots.
5. **Clash Royale Viral Studio & Apps Directory:** Native-like modules integrated within the Nexus.

## UI/UX & Layout Rules
- **Mobile First:** Strict 390x844 viewport limit.
- **RTL / LTR Mixing:** Persian UI with LTR technical badges/inputs. Use `dir="ltr"` for code/tokens.
- **No Overlaps:** Always use `flex-shrink: 0` for pills, badges, and avatars.
- **No Stubs:** Buttons must either be fully functional or safely alert their future role. No dead clicks.
- **Navigation:** Deeply integrated Android Back Button handling (`history.pushState` & Capacitor backButton event).

## Strict Zero-Regression Policy
- **DO NOT** delete, stub out, or drastically rewrite the 5 core modules.
- **ALWAYS** check for XSS vulnerabilities, ensuring dynamic attributes are escaped.
- Ensure state persistence (localStorage) never crashes.
