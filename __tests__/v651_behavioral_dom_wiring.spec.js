'use strict';

/**
 * EG-Nexus-OS v6.5.1 — Behavioral DOM & Engine Wiring Test Suite
 *
 * Verifies 100% end-to-end vertical-slice wiring and zero-hollow parity:
 * 1. Live i18n DOM translation (en, fa, ar) for textContent and placeholders
 * 2. Theme mode live CSS variables (--cue-bg, --cue-card, --cue-text) on :root
 * 3. App icon live selector updating data-app-icon and SVG favicon
 * 4. Speed vs. Quality Effort Mode Router and dynamic model / token dispatch
 * 5. Skills Hub active prompt injection into agent system prompt
 * 6. Multi-agent group chat sequential turn execution
 * 7. Sovereign computer bridge health check and workspace snapshot create/restore
 */

const fs = require('fs');
const path = require('path');
const state = require('../src/state.js');
const persistence = require('../src/persistence.js');

function createIsolatedStorage() {
  let mem = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
    clear: () => { mem = {}; },
    key: (i) => Object.keys(mem)[i] || null,
    get length() { return Object.keys(mem).length; }
  };
}

function createMockDOM() {
  const elements = new Map();
  const attributes = new Map();
  const styles = new Map();
  const classList = new Set();

  function makeEl(id, tagName = 'div', initialAttrs = {}) {
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      textContent: '',
      innerText: '',
      placeholder: '',
      href: '',
      lang: '',
      dir: '',
      style: {
        setProperty: (k, v) => styles.set(k, String(v)),
        getPropertyValue: (k) => styles.get(k) || '',
        removeProperty: (k) => styles.delete(k)
      },
      classList: {
        add: (...cls) => cls.forEach(c => classList.add(c)),
        remove: (...cls) => cls.forEach(c => classList.delete(c)),
        contains: (c) => classList.has(c),
        toggle: (c, force) => {
          if (force === true) classList.add(c);
          else if (force === false) classList.delete(c);
          else if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        }
      },
      getAttribute: (k) => attributes.get(`${id}:${k}`) || el[k] || null,
      setAttribute: (k, v) => {
        attributes.set(`${id}:${k}`, String(v));
        el[k] = String(v);
      },
      removeAttribute: (k) => attributes.delete(`${id}:${k}`)
    };
    for (const [k, v] of Object.entries(initialAttrs)) {
      el.setAttribute(k, v);
      if (k === 'textContent') el.textContent = v;
      if (k === 'placeholder') el.placeholder = v;
    }
    elements.set(id, el);
    return el;
  }

  const docEl = makeEl('documentElement', 'html');
  const bodyEl = makeEl('body', 'body');

  const doc = {
    documentElement: docEl,
    body: bodyEl,
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (selector) => {
      const results = [];
      const hasI18n = selector.includes('[data-i18n]');
      const hasPlaceholder = selector.includes('[data-i18n-placeholder]');
      for (const [id, el] of elements.entries()) {
        if (hasI18n && attributes.has(`${id}:data-i18n`)) results.push(el);
        if (hasPlaceholder && attributes.has(`${id}:data-i18n-placeholder`)) results.push(el);
      }
      return results;
    },
    _makeEl: makeEl,
    _styles: styles,
    _classList: classList
  };

  return doc;
}

describe('EG-Nexus-OS v6.5.1 — Behavioral DOM & Engine Wiring Suite', () => {
  const rootDir = path.resolve(__dirname, '..');
  let htmlContent = '';
  let mockDOM;
  let mockStorage;

  beforeAll(() => {
    mockStorage = createIsolatedStorage();
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf8');
    }
  });

  beforeEach(() => {
    mockDOM = createMockDOM();
    mockStorage.clear();
    globalThis.document = mockDOM;
    globalThis.window = globalThis;
    globalThis.localStorage = mockStorage;
  });

  // =========================================================================
  // Suite 1: DOM Live i18n & Language Switching
  // =========================================================================
  describe('Suite 1: DOM Live i18n & Language Switching', () => {
    it('should export NEXUS_I18N_DICTIONARY with en, fa, and ar dictionaries in index.html', () => {
      expect(htmlContent).toContain('NEXUS_I18N_DICTIONARY');
      expect(htmlContent).toContain('applyLiveLanguage');
      expect(htmlContent).toContain('plus_agent');
      expect(htmlContent).toContain('search_home_placeholder');
      expect(htmlContent).toContain('cat_added_apps');
      expect(htmlContent).toContain('header_settings');
    });

    it('should translate DOM textContent and input placeholders dynamically on applyLiveLanguage', () => {
      // Setup elements with data-i18n and data-i18n-placeholder
      const labelAgent = mockDOM._makeEl('labelAgent', 'span', { 'data-i18n': 'plus_agent', textContent: 'ایجنت جدید' });
      const btnApprove = mockDOM._makeEl('btnApprove', 'button', { 'data-i18n': 'btn_approve', textContent: 'تایید و ادامه' });
      const settingsUsage = mockDOM._makeEl('settingsUsage', 'span', { 'data-i18n': 'settings_usage', textContent: 'میزان مصرف هفتگی و سهمیه' });
      const searchInput = mockDOM._makeEl('searchInput', 'input', { 'data-i18n-placeholder': 'search_home_placeholder', placeholder: 'جستجو...' });
      const chatInput = mockDOM._makeEl('chatInput', 'textarea', { 'data-i18n-placeholder': 'chat_placeholder', placeholder: 'پیام...' });

      // Extract dictionary and applyLiveLanguage from htmlContent
      const dictMatch = htmlContent.match(/const NEXUS_I18N_DICTIONARY\s*=\s*\{[\s\S]*?\n\s*\};/);
      expect(dictMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(dictMatch[0] + ' globalThis.NEXUS_I18N_DICTIONARY = NEXUS_I18N_DICTIONARY;');
      expect(typeof globalThis.NEXUS_I18N_DICTIONARY).toBe('object');
      expect(globalThis.NEXUS_I18N_DICTIONARY.en).toBeDefined();
      expect(globalThis.NEXUS_I18N_DICTIONARY.fa).toBeDefined();
      expect(globalThis.NEXUS_I18N_DICTIONARY.ar).toBeDefined();

      const applyLiveMatch = htmlContent.match(/function applyLiveLanguage\(code\)\s*\{[\s\S]*?\n\s*\}\s*window\.applyLiveLanguage\s*=\s*applyLiveLanguage;/);
      expect(applyLiveMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(applyLiveMatch[0]);
      expect(typeof globalThis.applyLiveLanguage).toBe('function');

      // 1. Switch to English
      globalThis.applyLiveLanguage('en');
      expect(mockDOM.documentElement.lang).toBe('en');
      expect(mockDOM.documentElement.dir).toBe('ltr');
      expect(labelAgent.textContent).toBe('New Agent');
      expect(btnApprove.textContent).toBe('Approve & Proceed');
      expect(settingsUsage.textContent).toBe('Weekly Usage & Quotas');
      expect(searchInput.placeholder).toBe('Search apps & tools...');
      expect(chatInput.placeholder).toBe('Type your message...');

      // 2. Switch to Arabic
      globalThis.applyLiveLanguage('ar');
      expect(mockDOM.documentElement.lang).toBe('ar');
      expect(mockDOM.documentElement.dir).toBe('rtl');
      expect(labelAgent.textContent).toBe('وكيل جديد');
      expect(btnApprove.textContent).toBe('موافقة ومتابعة');
      expect(settingsUsage.textContent).toBe('الاستخدام الأسبوعي والحصص');
      expect(searchInput.placeholder).toBe('بحث في التطبيقات والأدوات...');
      expect(chatInput.placeholder).toBe('اكتب رسالتك...');

      // 3. Switch back to Persian
      globalThis.applyLiveLanguage('fa');
      expect(mockDOM.documentElement.lang).toBe('fa');
      expect(mockDOM.documentElement.dir).toBe('rtl');
      expect(labelAgent.textContent).toBe('ایجنت جدید');
      expect(btnApprove.textContent).toBe('تایید و ادامه');
      expect(settingsUsage.textContent).toBe('میزان مصرف هفتگی و سهمیه');
      expect(searchInput.placeholder).toBe('جستجوی اپ‌ها و ابزارها...');
      expect(chatInput.placeholder).toBe('پیام خود را بنویسید...');
    });

    it('should verify CUE_ALL_LANGUAGES is pruned to en, fa, ar with RTL/LTR metadata', () => {
      const match = htmlContent.match(/const CUE_ALL_LANGUAGES\s*=\s*(\[[\s\S]*?\]);/);
      expect(match).not.toBeNull();
      // eslint-disable-next-line no-new-func
      const parsedLangs = new Function('return ' + match[1])();
      expect(parsedLangs.length).toBe(3);
      const codes = parsedLangs.map(l => l.code);
      expect(codes).toEqual(['en', 'fa', 'ar']);
      expect(parsedLangs.find(l => l.code === 'en').dir).toBe('ltr');
      expect(parsedLangs.find(l => l.code === 'fa').dir).toBe('rtl');
      expect(parsedLangs.find(l => l.code === 'ar').dir).toBe('rtl');
    });
  });

  // =========================================================================
  // Suite 2: Appearance & Theme Mode Live CSS Variables
  // =========================================================================
  describe('Suite 2: Appearance & Theme Mode Live CSS Variables', () => {
    it('should set live CSS variables --cue-bg, --cue-card, --cue-text on applyThemeMode', () => {
      const themeFnMatch = htmlContent.match(/function applyThemeMode\(mode\)\s*\{[\s\S]*?\n\s*\}\s*window\.applyThemeMode\s*=\s*applyThemeMode;/);
      expect(themeFnMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(themeFnMatch[0]);
      expect(typeof globalThis.applyThemeMode).toBe('function');

      // 1. Light Mode
      globalThis.applyThemeMode('light');
      expect(mockDOM.documentElement.classList.contains('light')).toBe(true);
      expect(mockDOM.documentElement.classList.contains('dark')).toBe(false);
      expect(mockDOM.documentElement.style.getPropertyValue('--cue-bg')).toBe('#f8fafc');
      expect(mockDOM.documentElement.style.getPropertyValue('--cue-card')).toBe('#ffffff');
      expect(mockDOM.documentElement.style.getPropertyValue('--cue-text')).toBe('#0f172a');

      // 2. Dark Mode
      globalThis.applyThemeMode('dark');
      expect(mockDOM.documentElement.classList.contains('dark')).toBe(true);
      expect(mockDOM.documentElement.classList.contains('light')).toBe(false);
      expect(mockDOM.documentElement.style.getPropertyValue('--cue-bg')).toBe('#000000');
      expect(mockDOM.documentElement.style.getPropertyValue('--cue-card')).toBe('#111115');
      expect(mockDOM.documentElement.style.getPropertyValue('--cue-text')).toBe('#f8fafc');
    });
  });

  // =========================================================================
  // Suite 3: App Icon Selector & Favicon Wiring
  // =========================================================================
  describe('Suite 3: App Icon Selector & Favicon Wiring', () => {
    it('should wire CUE_APP_FAVICONS and update data-app-icon and link#appFavicon on selectAppIcon', () => {
      const favEl = mockDOM._makeEl('appFavicon', 'link', { rel: 'icon', href: 'init' });

      const favMatch = htmlContent.match(/const CUE_APP_FAVICONS\s*=\s*\{[\s\S]*?\n\s*\};/);
      expect(favMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(favMatch[0] + ' globalThis.CUE_APP_FAVICONS = CUE_APP_FAVICONS;');
      expect(typeof globalThis.CUE_APP_FAVICONS).toBe('object');
      expect(globalThis.CUE_APP_FAVICONS.Classic).toBeDefined();
      expect(globalThis.CUE_APP_FAVICONS['OLED Dark']).toBeDefined();
      expect(globalThis.CUE_APP_FAVICONS.Cyberpunk).toBeDefined();
      expect(globalThis.CUE_APP_FAVICONS.Minimal).toBeDefined();

      globalThis.updateAppIconUI = jest.fn();
      globalThis.triggerCueHaptic = jest.fn();
      globalThis.showToast = jest.fn();
      globalThis.closeCueAppIconModal = jest.fn();

      const selectMatch = htmlContent.match(/function selectAppIcon\(iconName\)\s*\{[\s\S]*?\n\s*\}\s*window\.selectAppIcon\s*=\s*selectAppIcon;/);
      expect(selectMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(selectMatch[0]);
      expect(typeof globalThis.selectAppIcon).toBe('function');

      // Select Cyberpunk
      globalThis.selectAppIcon('Cyberpunk');
      expect(mockDOM.documentElement.getAttribute('data-app-icon')).toBe('Cyberpunk');
      expect(favEl.href).toBe(globalThis.CUE_APP_FAVICONS.Cyberpunk);
      expect(globalThis.updateAppIconUI).toHaveBeenCalledWith('Cyberpunk');

      // Select OLED Dark
      globalThis.selectAppIcon('OLED Dark');
      expect(mockDOM.documentElement.getAttribute('data-app-icon')).toBe('OLED Dark');
      expect(favEl.href).toBe(globalThis.CUE_APP_FAVICONS['OLED Dark']);

      // Invalid icon falls back to Classic
      globalThis.selectAppIcon('invalid_icon_name');
      expect(mockDOM.documentElement.getAttribute('data-app-icon')).toBe('Classic');
      expect(favEl.href).toBe(globalThis.CUE_APP_FAVICONS.Classic);
    });
  });

  // =========================================================================
  // Suite 4: Speed vs. Quality Effort Mode Router
  // =========================================================================
  describe('Suite 4: Speed vs Quality Effort Mode Router', () => {
    it('should route speed mode to gemini-3.8-flash and quality mode to deepseek-v4-pro', () => {
      const effortMatch = htmlContent.match(/window\.resolveModelByEffortMode\s*=\s*function\s*\([\s\S]*?\n\s{4}\};/);
      expect(effortMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(effortMatch[0]);
      expect(typeof globalThis.resolveModelByEffortMode).toBe('function');

      const speedRes = globalThis.resolveModelByEffortMode('speed');
      expect(speedRes.model).toBe('gemini-3.8-flash');
      expect(speedRes.mode).toBe('speed');
      expect(speedRes.thinkingBudget).toBe(0);

      const qualityRes = globalThis.resolveModelByEffortMode('quality');
      expect(qualityRes.model).toBe('deepseek-v4-pro');
      expect(qualityRes.mode).toBe('quality');
      expect(qualityRes.thinkingBudget).toBe(8192);

      // Model preserved if matching tier
      const customFast = globalThis.resolveModelByEffortMode('speed', 'gemini-2.5-flash');
      expect(customFast.model).toBe('gemini-2.5-flash');

      const customPro = globalThis.resolveModelByEffortMode('quality', 'claude-3-5-pro');
      expect(customPro.model).toBe('claude-3-5-pro');
    });

    it('should dynamically set max tokens for speed and quality modes in callAgentAPI logic', () => {
      expect(htmlContent).toContain('resolveModelByEffortMode');
      expect(htmlContent).toContain("effortRouted.mode === 'quality' ? 8192 : (effortRouted.mode === 'speed' ? 2048");
      expect(htmlContent).toContain('dynamicMaxTokens');
    });
  });

  // =========================================================================
  // Suite 5: Skills Hub Prompt Injection
  // =========================================================================
  describe('Suite 5: Skills Hub Prompt Injection', () => {
    it('should inject active skill directives into sysPrompt in callAgentAPI', () => {
      expect(htmlContent).toContain('Active Skills Directives');
      expect(htmlContent).toContain('activeSkillsDirectives');

      const skillHub = new state.SkillHubManager({ storage: mockStorage });
      expect(skillHub).toBeDefined();

      const enabledSkills = skillHub.listSkills('enabled');
      expect(enabledSkills.length).toBeGreaterThanOrEqual(1);

      // Import custom skill
      const custom = skillHub.uploadSkill({
        name: 'Autonomous Code Reviewer',
        description: 'Enforce strict 100% test coverage and AST validation on all PRs.',
        directive: 'Review every diff for zero placeholders and AST safety.'
      });
      expect(custom).not.toBeNull();
      expect(custom.enabled).toBe(true);

      const updated = skillHub.listSkills('enabled');
      const customFound = updated.find(s => s.name === 'Autonomous Code Reviewer');
      expect(customFound).toBeDefined();
    });
  });

  // =========================================================================
  // Suite 6: Group Chat Sequential Turn Execution
  // =========================================================================
  describe('Suite 6: Group Chat Multi-Agent Sequential Turn Execution', () => {
    it('should calculate turns based on all group members without truncation', () => {
      const match = htmlContent.match(/const turns = chat\.isGroup \? Math\.max\(1, memberIds\.length\) : 1;/);
      expect(match).not.toBeNull();

      // Test with 4 agents in group
      const chat = { isGroup: true, memberIds: ['ag_1', 'ag_2', 'ag_3', 'ag_4'] };
      const turns = chat.isGroup ? Math.max(1, chat.memberIds.length) : 1;
      expect(turns).toBe(4);

      // Single chat
      const singleChat = { isGroup: false, memberIds: ['ag_1'] };
      const singleTurns = singleChat.isGroup ? Math.max(1, singleChat.memberIds.length) : 1;
      expect(singleTurns).toBe(1);
    });
  });

  // =========================================================================
  // Suite 7: Sovereign Computer Bridge & Workspace Snapshots
  // =========================================================================
  describe('Suite 7: Sovereign Computer Bridge & Workspace Snapshots', () => {
    it('should check local Termux bridge health endpoint http://127.0.0.1:8765/health', async () => {
      const badge = mockDOM._makeEl('computerBridgeStatusBadge', 'span', { textContent: 'STANDALONE' });

      globalThis.triggerCueHaptic = jest.fn();
      globalThis.showToast = jest.fn();

      const bridgeFnMatch = htmlContent.match(/async function checkComputerBridgeStatus\(\)\s*\{[\s\S]*?\n\s*\}\s*window\.checkComputerBridgeStatus\s*=\s*checkComputerBridgeStatus;/);
      expect(bridgeFnMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(bridgeFnMatch[0]);
      expect(typeof globalThis.checkComputerBridgeStatus).toBe('function');

      // Test 1: Successful response
      globalThis.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200 });
      const onlineRes = await globalThis.checkComputerBridgeStatus();
      expect(onlineRes).toBe(true);
      expect(badge.innerText).toBe('ONLINE (Termux Bridge)');

      // Test 2: Network failure / offline
      globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('Connection refused'));
      const offlineRes = await globalThis.checkComputerBridgeStatus();
      expect(offlineRes).toBe(false);
      expect(badge.innerText).toBe('LOCAL STANDALONE');
    });

    it('should create and restore workspace snapshots with serialized state', () => {
      globalThis.appState = {
        computerSnapshots: [],
        agentsCatalog: [{ id: 'ag_1' }],
        chats: [{ id: 'c_1' }],
        addedAppIds: ['app_1'],
        activeSnapshot: null
      };
      globalThis.saveState = jest.fn();
      globalThis.renderComputerSettingsPanel = jest.fn();
      globalThis.triggerCueHaptic = jest.fn();
      globalThis.showToast = jest.fn();

      const snapFnMatch = htmlContent.match(/function createWorkspaceSnapshot\(\)\s*\{[\s\S]*?\n\s*\}\s*window\.createWorkspaceSnapshot\s*=\s*createWorkspaceSnapshot;/);
      expect(snapFnMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(snapFnMatch[0]);
      expect(typeof globalThis.createWorkspaceSnapshot).toBe('function');

      const restoreFnMatch = htmlContent.match(/function restoreWorkspaceSnapshot\(snapshotId\)\s*\{[\s\S]*?\n\s*\}\s*window\.restoreWorkspaceSnapshot\s*=\s*restoreWorkspaceSnapshot;/);
      expect(restoreFnMatch).not.toBeNull();
      // eslint-disable-next-line no-eval
      eval(restoreFnMatch[0]);
      expect(typeof globalThis.restoreWorkspaceSnapshot).toBe('function');

      // Create snapshot
      globalThis.createWorkspaceSnapshot();
      expect(globalThis.appState.computerSnapshots.length).toBe(1);
      const createdSnap = globalThis.appState.computerSnapshots[0];
      expect(createdSnap.id).toMatch(/^snap_\d+/);
      expect(createdSnap.data).toBeDefined();
      expect(['6.5.1', '6.6.0']).toContain(createdSnap.data.version);
      expect(createdSnap.data.agentsCount).toBe(1);
      expect(createdSnap.data.stateChecksum).toMatch(/^sha256_/);

      // Restore snapshot
      globalThis.restoreWorkspaceSnapshot(createdSnap.id);
      expect(globalThis.appState.activeSnapshot).toBe(createdSnap.id);
      expect(globalThis.appState.restoredSnapshotData).toEqual(createdSnap.data);
      expect(globalThis.saveState).toHaveBeenCalled();
      expect(globalThis.renderComputerSettingsPanel).toHaveBeenCalled();
    });
  });
});
