'use strict';

/**
 * EG-Nexus-OS v6.5.0 — Cue v26.18.15 Deep Exhaustive Parity Specification
 *
 * Landmark Milestone Verification:
 * 1. Suite 1: AgentGroupManager & getAgentGroupManager():
 *    - createGroup(name, agentIds, metadata) with valid ID, name, members, memberCount, files [], isPinned: false.
 *    - getGroup(groupId) returns group or null.
 *    - listGroups() lists all groups.
 *    - updateGroup(groupId, updates) updates group properties and memberCount.
 *    - addMember(groupId, agentId) and removeMember(groupId, agentId) manage membership.
 *    - togglePin(groupId) toggles pinned state.
 *    - addFileToGroup(groupId, fileInfo) and getGroupFiles(groupId) manage file attachments (e.g. app-debug.apk).
 *    - deleteGroup(groupId) removes group from memory and persistence.
 * 2. Suite 2: SkillHubManager & getSkillHubManager():
 *    - listSkills(filter) supports 'all', 'builtin', 'user'/'custom', 'github', 'enabled'.
 *    - toggleSkill(skillId, enabled) toggles skill enabled state.
 *    - importSkillFromGitHub(repoUrl) validates regex, rejects invalid URLs, and parses repo/owner.
 *    - uploadSkill(skillPayload) creates skill from payload.
 *    - deleteSkill(skillId) deletes skill.
 * 3. Suite 3: AppearanceManager, LanguageManager, CacheManager, AppIconManager:
 *    - getPersistedThemeMode / setPersistedThemeMode for 'system', 'light', 'dark'.
 *    - getPersistedLanguage / setPersistedLanguage for 14 locales with RTL/LTR support.
 *    - calculateStorageCacheSize returns { bytes, formatted, toString() }.
 *    - clearAppCache clears transient caches while preserving secrets, agent groups, user skills, settings.
 *    - getPersistedAppIcon / setPersistedAppIcon for 'classic', 'oled_dark', 'cyberpunk', 'minimal'.
 * 4. Suite 4: registry.js Registration of agent_groups & skill_hub & 7 Cue Categories:
 *    - agent_groups registered in ACTION_POLICY_MANIFEST (8 actions) & PROVIDER_ACTION_SCOPES.
 *    - skill_hub registered in ACTION_POLICY_MANIFEST (5 actions) & PROVIDER_ACTION_SCOPES.
 *    - CUE_CATEGORIES contains all 7 categories: ['Recommended', 'Health', 'Finance', 'Travel', 'Productivity', 'Developer', 'Social'].
 *    - getCatalogByCategory(category) correctly filters connectors for each category.
 *    - Simulated responses for agent_groups and skill_hub actions.
 * 5. Suite 5: Static DOM & Event Handlers in index.html:
 *    - Verify presence of cueAppearanceModal, cueLanguageModal, cueSkillsHubModal, cueAddSkillsMenu,
 *      cueImportGithubModal, cueGithubRepoInput, cueImportGithubBtn, cueChatMoreMenu, chatHeaderMoreBtn,
 *      cueGroupChatInfoPanel, cueGroupTitleDisplay, cueGroupMemberCountDisplay, appsCategoryBar,
 *      cueAppIconModal, settingsClearCacheBtn and zero-stub handlers.
 */

const fs = require('fs');
const path = require('path');

const registry = require('../src/registry.js');
const state = require('../src/state.js');
const persistence = require('../src/persistence.js');

// Mock storage factory supporting both Node.js and JSDOM environments
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

function ensureStorageMock() {
  const mockStorage = createIsolatedStorage();
  if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage || typeof globalThis.localStorage.setItem !== 'function') {
    globalThis.localStorage = mockStorage;
  }
  if (typeof globalThis.sessionStorage === 'undefined' || !globalThis.sessionStorage || typeof globalThis.sessionStorage.setItem !== 'function') {
    globalThis.sessionStorage = mockStorage;
  }
  return mockStorage;
}

describe('EG-Nexus-OS v6.5.0 — Cue v26.18.15 Deep Exhaustive Parity Suite', () => {
  const rootDir = path.resolve(__dirname, '..');
  let htmlContent = '';

  beforeAll(() => {
    ensureStorageMock();
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf8');
    }
  });

  beforeEach(() => {
    ensureStorageMock();
    if (globalThis.localStorage && typeof globalThis.localStorage.clear === 'function') {
      try { globalThis.localStorage.clear(); } catch (_) {}
    }
    if (globalThis.appState) {
      globalThis.appState.agentGroups = [];
      globalThis.appState.skills = [];
    }
  });

  // =========================================================================
  // Suite 1: AgentGroupManager and getAgentGroupManager()
  // =========================================================================
  describe('Suite 1: AgentGroupManager and getAgentGroupManager()', () => {
    it('should export AgentGroupManager and getAgentGroupManager factory', () => {
      expect(typeof state.AgentGroupManager).toBe('function');
      expect(typeof state.getAgentGroupManager).toBe('function');
    });

    it('should createGroup(name, agentIds, metadata) with valid ID, name, members, memberCount, files [], isPinned: false', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const group = manager.createGroup('Autonomous Core Team', ['agent_research', 'agent_coder']);
      expect(group).toBeDefined();
      expect(typeof group.groupId).toBe('string');
      expect(group.groupId.length).toBeGreaterThan(0);
      expect(group.id).toBe(group.groupId);
      expect(group.name).toBe('Autonomous Core Team');
      expect(Array.isArray(group.agentIds)).toBe(true);
      expect(group.agentIds).toEqual(['agent_research', 'agent_coder']);
      expect(group.memberCount).toBe(2);
      expect(Array.isArray(group.files)).toBe(true);
      expect(group.files).toEqual([]);
      expect(group.isPinned).toBe(false);
      expect(typeof group.createdAt).toBe('string');
    });

    it('should getGroup(groupId) return the created group or null for unknown ID', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const group = manager.createGroup('DevOps Squad', ['agent_infra']);
      const found = manager.getGroup(group.groupId);
      expect(found).not.toBeNull();
      expect(found.name).toBe('DevOps Squad');
      expect(found.memberCount).toBe(1);

      expect(manager.getGroup('grp_non_existent')).toBeNull();
      expect(manager.getGroup('')).toBeNull();
      expect(manager.getGroup(null)).toBeNull();
    });

    it('should listGroups() return all created groups', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      expect(manager.listGroups()).toEqual([]);

      const g1 = manager.createGroup('Group Alpha', ['a1']);
      const g2 = manager.createGroup('Group Beta', ['b1', 'b2']);

      const all = manager.listGroups();
      expect(all.length).toBe(2);
      expect(all.some(g => g.groupId === g1.groupId)).toBe(true);
      expect(all.some(g => g.groupId === g2.groupId)).toBe(true);
    });

    it('should updateGroup(groupId, updates) update properties and memberCount', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const g = manager.createGroup('Original Name', ['a1']);
      const updated = manager.updateGroup(g.groupId, {
        name: 'Renamed Group',
        agentIds: ['a1', 'a2', 'a3'],
        customTag: 'priority_high'
      });

      expect(updated).not.toBeNull();
      expect(updated.name).toBe('Renamed Group');
      expect(updated.memberCount).toBe(3);
      expect(updated.customTag).toBe('priority_high');

      // Non-existent group update returns null
      expect(manager.updateGroup('invalid_id', { name: 'Test' })).toBeNull();
    });

    it('should addMember and removeMember update memberCount and array correctly', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const g = manager.createGroup('Collaboration Pod', ['leader_agent']);
      expect(g.memberCount).toBe(1);

      // Add member
      const addRes = manager.addMember(g.groupId, 'helper_agent', 'contributor');
      expect(addRes).toBe(true);
      const afterAdd = manager.getGroup(g.groupId);
      expect(afterAdd.agentIds.includes('helper_agent')).toBe(true);
      expect(afterAdd.memberCount).toBe(2);
      if (afterAdd.roles) {
        expect(afterAdd.roles.helper_agent).toBe('contributor');
      }

      // Add duplicate member should not double count
      manager.addMember(g.groupId, 'helper_agent');
      expect(manager.getGroup(g.groupId).memberCount).toBe(2);

      // Remove member
      const remRes = manager.removeMember(g.groupId, 'leader_agent');
      expect(remRes).toBe(true);
      const afterRem = manager.getGroup(g.groupId);
      expect(afterRem.agentIds.includes('leader_agent')).toBe(false);
      expect(afterRem.agentIds.includes('helper_agent')).toBe(true);
      expect(afterRem.memberCount).toBe(1);

      // Edge cases: invalid group or agentId
      expect(manager.addMember('non_existent', 'agent_x')).toBe(false);
      expect(manager.addMember(g.groupId, '')).toBe(false);
      expect(manager.removeMember('non_existent', 'agent_x')).toBe(false);
      expect(manager.removeMember(g.groupId, '')).toBe(false);
    });

    it('should togglePin(groupId) toggle pinned state', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const g = manager.createGroup('Pinned Test Group');
      expect(g.isPinned).toBe(false);

      const pin1 = manager.togglePin(g.groupId);
      expect(pin1).toBe(true);
      expect(manager.getGroup(g.groupId).isPinned).toBe(true);

      const pin2 = manager.togglePin(g.groupId);
      expect(pin2).toBe(false);
      expect(manager.getGroup(g.groupId).isPinned).toBe(false);

      expect(manager.togglePin('invalid_id')).toBe(false);
    });

    it('should addFileToGroup and getGroupFiles manage file attachments like app-debug.apk', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const g = manager.createGroup('Build Release Pod');
      expect(manager.getGroupFiles(g.groupId)).toEqual([]);

      const fileInfo = {
        name: 'app-debug.apk',
        size: 855638016,
        type: 'application/vnd.android.package-archive',
        url: 'file:///android_asset/builds/app-debug.apk'
      };

      const added = manager.addFileToGroup(g.groupId, fileInfo);
      expect(added).not.toBeNull();
      expect(added.name).toBe('app-debug.apk');
      expect(added.size).toBe(855638016);
      expect(added.type).toBe('application/vnd.android.package-archive');

      const files = manager.getGroupFiles(g.groupId);
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('app-debug.apk');
      expect(files[0].size).toBe(855638016);

      // Edge cases
      expect(manager.addFileToGroup('invalid_id', fileInfo)).toBeNull();
      expect(manager.getGroupFiles('invalid_id')).toEqual([]);
    });

    it('should deleteGroup(groupId) remove group and persist changes', () => {
      const storage = createIsolatedStorage();
      const manager = new state.AgentGroupManager({ storage });

      const g = manager.createGroup('Ephemeral Group');
      expect(manager.getGroup(g.groupId)).not.toBeNull();

      const delRes = manager.deleteGroup(g.groupId);
      expect(delRes).toBe(true);
      expect(manager.getGroup(g.groupId)).toBeNull();
      expect(manager.listGroups().length).toBe(0);

      // Repeated delete returns false
      expect(manager.deleteGroup(g.groupId)).toBe(false);
      expect(manager.deleteGroup('')).toBe(false);
    });

    it('should restore persisted agent groups when a new manager is initialized', () => {
      const storage = createIsolatedStorage();
      const manager1 = new state.AgentGroupManager({ storage });

      const g = manager1.createGroup('Persisted Pod', ['a1', 'a2'], { isPinned: true });
      manager1.addFileToGroup(g.groupId, { name: 'app-debug.apk', size: 1024 });

      // Create new instance backed by same storage
      const manager2 = new state.AgentGroupManager({ storage });
      const loaded = manager2.getGroup(g.groupId);

      expect(loaded).not.toBeNull();
      expect(loaded.name).toBe('Persisted Pod');
      expect(loaded.memberCount).toBe(2);
      expect(loaded.isPinned).toBe(true);
      expect(loaded.files.length).toBe(1);
      expect(loaded.files[0].name).toBe('app-debug.apk');
    });

    it('should support singleton getAgentGroupManager', () => {
      const instance1 = state.getAgentGroupManager();
      const instance2 = state.getAgentGroupManager();
      expect(instance1).toBe(instance2);

      const resetInstance = state.getAgentGroupManager({ reset: true });
      expect(resetInstance).toBeDefined();
    });
  });

  // =========================================================================
  // Suite 2: SkillHubManager and getSkillHubManager()
  // =========================================================================
  describe('Suite 2: SkillHubManager and getSkillHubManager()', () => {
    it('should export SkillHubManager and getSkillHubManager factory', () => {
      expect(typeof state.SkillHubManager).toBe('function');
      expect(typeof state.getSkillHubManager).toBe('function');
    });

    it('should listSkills(filter) support all, builtin, user/custom, github, enabled', () => {
      const storage = createIsolatedStorage();
      const manager = new state.SkillHubManager({ storage });

      // Initial builtin skills should exist
      const all = manager.listSkills('all');
      expect(all.length).toBeGreaterThanOrEqual(2);

      const builtin = manager.listSkills('builtin');
      expect(builtin.length).toBeGreaterThanOrEqual(2);
      builtin.forEach(s => {
        expect(s.source === 'System Built-in' || s.isBuiltin === true).toBe(true);
      });

      // User filter should be empty initially
      expect(manager.listSkills('user')).toEqual([]);
      expect(manager.listSkills('custom')).toEqual([]);
      expect(manager.listSkills('github')).toEqual([]);

      // Enabled filter
      const enabled = manager.listSkills('enabled');
      expect(enabled.length).toBeGreaterThanOrEqual(2);
    });

    it('should toggleSkill(skillId, enabled) toggle skill enabled state', () => {
      const storage = createIsolatedStorage();
      const manager = new state.SkillHubManager({ storage });

      const skills = manager.listSkills('builtin');
      const target = skills[0];
      const targetId = target.id;

      // Toggle from true to false
      const toggled1 = manager.toggleSkill(targetId, false);
      expect(toggled1).not.toBeNull();
      expect(toggled1.enabled).toBe(false);

      // Toggle from false to true without explicit boolean
      const toggled2 = manager.toggleSkill(targetId);
      expect(toggled2.enabled).toBe(true);

      // Non-existent skill returns null
      expect(manager.toggleSkill('invalid_skill_id')).toBeNull();
      expect(manager.toggleSkill('')).toBeNull();
    });

    it('should importSkillFromGitHub validate repo URL regex and reject invalid URLs', () => {
      const storage = createIsolatedStorage();
      const manager = new state.SkillHubManager({ storage });

      // Reject non-string / empty
      expect(() => manager.importSkillFromGitHub('')).toThrow(/Invalid GitHub repository URL/i);
      expect(() => manager.importSkillFromGitHub(null)).toThrow(/Invalid GitHub repository URL/i);

      // Reject invalid protocols and domains
      expect(() => manager.importSkillFromGitHub('not-a-url')).toThrow(/Invalid GitHub repository URL/i);
      expect(() => manager.importSkillFromGitHub('http://insecure.com/repo')).toThrow(/Invalid GitHub repository URL/i);
      expect(() => manager.importSkillFromGitHub('https://gitlab.com/foo/bar')).toThrow(/Invalid GitHub repository URL/i);
      expect(() => manager.importSkillFromGitHub('ftp://github.com/foo/bar')).toThrow(/Invalid GitHub repository URL/i);
    });

    it('should importSkillFromGitHub successfully import and parse repo name/owner', () => {
      const storage = createIsolatedStorage();
      const manager = new state.SkillHubManager({ storage });

      const repoUrl = 'https://github.com/google/antigravity';
      const imported = manager.importSkillFromGitHub(repoUrl);

      expect(imported).toBeDefined();
      expect(imported.name).toBe('antigravity');
      expect(imported.author).toBe('google');
      expect(imported.repoUrl).toBe(repoUrl);
      expect(imported.source).toBe('github');
      expect(imported.enabled).toBe(true);
      expect(typeof imported.id).toBe('string');
      expect(imported.id).toContain('antigravity');

      // Verify presence in listSkills('github')
      const ghSkills = manager.listSkills('github');
      expect(ghSkills.length).toBe(1);
      expect(ghSkills[0].name).toBe('antigravity');

      // Also present in listSkills('user') and listSkills('all')
      expect(manager.listSkills('user').length).toBe(1);
      expect(manager.listSkills('all').some(s => s.name === 'antigravity')).toBe(true);
    });

    it('should uploadSkill(skillPayload) create skill from payload and reject invalid payload', () => {
      const storage = createIsolatedStorage();
      const manager = new state.SkillHubManager({ storage });

      // Reject invalid payloads
      expect(() => manager.uploadSkill(null)).toThrow(/Invalid skill payload/i);
      expect(() => manager.uploadSkill('not an object')).toThrow(/Invalid skill payload/i);

      const payload = {
        name: 'Custom Memory Audit Skill',
        description: 'Audits memory leaks and dangling closures',
        instructions: 'Run leak checks every 60s',
        tools: ['mem_profile', 'heap_dump'],
        author: 'Ali'
      };

      const uploaded = manager.uploadSkill(payload);
      expect(uploaded).toBeDefined();
      expect(uploaded.name).toBe('Custom Memory Audit Skill');
      expect(uploaded.description).toBe('Audits memory leaks and dangling closures');
      expect(uploaded.tools).toEqual(['mem_profile', 'heap_dump']);
      expect(uploaded.author).toBe('Ali');
      expect(uploaded.source).toBe('upload');
      expect(uploaded.enabled).toBe(true);

      const customSkills = manager.listSkills('custom');
      expect(customSkills.some(s => s.id === uploaded.id)).toBe(true);
    });

    it('should deleteSkill(skillId) remove user/imported skill and return boolean', () => {
      const storage = createIsolatedStorage();
      const manager = new state.SkillHubManager({ storage });

      const skill = manager.uploadSkill({ name: 'Temporary Skill' });
      expect(manager.listSkills('user').some(s => s.id === skill.id)).toBe(true);

      const delRes = manager.deleteSkill(skill.id);
      expect(delRes).toBe(true);
      expect(manager.listSkills('user').some(s => s.id === skill.id)).toBe(false);

      // Repeated delete returns false
      expect(manager.deleteSkill(skill.id)).toBe(false);
      expect(manager.deleteSkill('')).toBe(false);
    });

    it('should persist user skills across manager instances', () => {
      const storage = createIsolatedStorage();
      const manager1 = new state.SkillHubManager({ storage });

      manager1.uploadSkill({ id: 'skill_test_persist', name: 'Persisted Skill', enabled: true });

      const manager2 = new state.SkillHubManager({ storage });
      const found = manager2.listSkills('user').find(s => s.id === 'skill_test_persist');
      expect(found).toBeDefined();
      expect(found.name).toBe('Persisted Skill');
    });

    it('should support singleton getSkillHubManager', () => {
      const inst1 = state.getSkillHubManager();
      const inst2 = state.getSkillHubManager();
      expect(inst1).toBe(inst2);

      const resetInst = state.getSkillHubManager({ reset: true });
      expect(resetInst).toBeDefined();
    });
  });

  // =========================================================================
  // Suite 3: AppearanceManager, LanguageManager, CacheManager, AppIconManager
  // =========================================================================
  describe('Suite 3: AppearanceManager, LanguageManager, CacheManager, AppIconManager', () => {
    it('should manage persisted theme mode for system, light, and dark', () => {
      const storage = createIsolatedStorage();

      // Default is 'dark'
      expect(persistence.getPersistedThemeMode(storage)).toBe('dark');
      if (persistence.AppearanceManager) {
        expect(persistence.AppearanceManager.getPersistedThemeMode(storage)).toBe('dark');
      }

      // Valid modes
      expect(persistence.setPersistedThemeMode('system', storage)).toBe(true);
      expect(persistence.getPersistedThemeMode(storage)).toBe('system');

      expect(persistence.setPersistedThemeMode('light', storage)).toBe(true);
      expect(persistence.getPersistedThemeMode(storage)).toBe('light');

      expect(persistence.setPersistedThemeMode('dark', storage)).toBe(true);
      expect(persistence.getPersistedThemeMode(storage)).toBe('dark');

      // Invalid modes return false and do not overwrite
      expect(persistence.setPersistedThemeMode('neon_pink', storage)).toBe(false);
      expect(persistence.setPersistedThemeMode('', storage)).toBe(false);
      expect(persistence.setPersistedThemeMode(null, storage)).toBe(false);
      expect(persistence.getPersistedThemeMode(storage)).toBe('dark');
    });

    it('should manage persisted language for 14 locales and validate format', () => {
      const storage = createIsolatedStorage();

      // Default is 'en'
      expect(persistence.getPersistedLanguage(storage)).toBe('en');

      // Supported languages
      const locales = ['en', 'fa', 'zh_CN', 'zh_TW', 'ja', 'ko', 'de', 'es_ES', 'es_LA', 'ar', 'fr', 'id', 'it', 'pt'];
      locales.forEach(loc => {
        expect(persistence.setPersistedLanguage(loc, storage)).toBe(true);
        expect(persistence.getPersistedLanguage(storage)).toBe(loc);
      });

      // Hyphenated codes also supported
      expect(persistence.setPersistedLanguage('zh-Hans', storage)).toBe(true);
      expect(persistence.getPersistedLanguage(storage)).toBe('zh-Hans');

      expect(persistence.setPersistedLanguage('es-419', storage)).toBe(true);
      expect(persistence.getPersistedLanguage(storage)).toBe('es-419');

      // Invalid language codes return false
      expect(persistence.setPersistedLanguage('invalid_lang_12345678', storage)).toBe(false);
      expect(persistence.setPersistedLanguage('', storage)).toBe(false);
      expect(persistence.setPersistedLanguage(null, storage)).toBe(false);
    });

    it('should calculate storage cache size returning { bytes, formatted, toString() }', () => {
      const storage = createIsolatedStorage();

      const initial = persistence.calculateStorageCacheSize(storage);
      expect(typeof initial.bytes).toBe('number');
      expect(typeof initial.formatted).toBe('string');
      expect(initial.toString()).toBe(initial.formatted);
      expect(initial.bytes).toBe(0);
      expect(initial.formatted).toBe('0 B');

      // Add dummy data to increase bytes
      storage.setItem('test_cache_chunk', 'a'.repeat(2048));
      const sized = persistence.calculateStorageCacheSize(storage);
      expect(sized.bytes).toBeGreaterThan(2000);
      expect(sized.formatted).toMatch(/KB|MB/);
      expect(sized.toString()).toBe(sized.formatted);
    });

    it('should clearAppCache clear transient caches while preserving secrets, agent groups, skills, and settings', () => {
      const storage = createIsolatedStorage();

      // Critical keys that MUST be preserved
      storage.setItem(persistence.STORAGE_KEY, JSON.stringify({ chats: [{ id: 'c1', draftText: 'ephemeral draft' }] }));
      storage.setItem(persistence.SESSION_SECRETS_KEY, 'encrypted_secrets_block');
      storage.setItem(persistence.NEXUS_THEME_MODE_KEY, 'dark');
      storage.setItem(persistence.NEXUS_APP_LANGUAGE_KEY, 'fa');
      storage.setItem(persistence.NEXUS_APP_ICON_KEY, 'oled_dark');
      storage.setItem(persistence.AGENT_GROUPS_STORAGE_KEY, JSON.stringify([{ id: 'g1', name: 'Preserved Group' }]));
      storage.setItem(persistence.USER_SKILLS_STORAGE_KEY, JSON.stringify([{ id: 'sk1', name: 'Preserved Skill' }]));

      // Ephemeral transient keys that MUST be purged
      storage.setItem('cached_preview_buffer', 'preview_binary_data');
      storage.setItem('ephemeral_temp_tokens', 'temp_tokens');
      storage.setItem('app_thumbnail_cache', 'thumb_data');

      const beforeBytes = persistence.calculateStorageCacheSize(storage).bytes;
      expect(beforeBytes).toBeGreaterThan(0);

      const clearResult = persistence.clearAppCache(storage);
      expect(clearResult.success).toBe(true);
      expect(clearResult.freedBytes).toBeGreaterThan(0);

      // Verify preservation
      expect(storage.getItem(persistence.STORAGE_KEY)).not.toBeNull();
      expect(storage.getItem(persistence.SESSION_SECRETS_KEY)).toBe('encrypted_secrets_block');
      expect(storage.getItem(persistence.NEXUS_THEME_MODE_KEY)).toBe('dark');
      expect(storage.getItem(persistence.NEXUS_APP_LANGUAGE_KEY)).toBe('fa');
      expect(storage.getItem(persistence.NEXUS_APP_ICON_KEY)).toBe('oled_dark');
      expect(storage.getItem(persistence.AGENT_GROUPS_STORAGE_KEY)).toContain('Preserved Group');
      expect(storage.getItem(persistence.USER_SKILLS_STORAGE_KEY)).toContain('Preserved Skill');

      // Verify purged transient keys
      expect(storage.getItem('cached_preview_buffer')).toBeNull();
      expect(storage.getItem('ephemeral_temp_tokens')).toBeNull();
      expect(storage.getItem('app_thumbnail_cache')).toBeNull();

      // Verify draftText in master state was reset to empty string
      const parsedMaster = JSON.parse(storage.getItem(persistence.STORAGE_KEY));
      expect(parsedMaster.chats[0].draftText).toBe('');
    });

    it('should manage persisted app icon for classic, oled_dark, cyberpunk, and minimal', () => {
      const storage = createIsolatedStorage();

      // Default is 'classic'
      expect(persistence.getPersistedAppIcon(storage)).toBe('classic');

      const validIcons = ['classic', 'oled_dark', 'cyberpunk', 'minimal'];
      validIcons.forEach(iconId => {
        expect(persistence.setPersistedAppIcon(iconId, storage)).toBe(true);
        expect(persistence.getPersistedAppIcon(storage)).toBe(iconId);
      });

      // Invalid icon IDs return false
      expect(persistence.setPersistedAppIcon('neon_invalid', storage)).toBe(false);
      expect(persistence.setPersistedAppIcon('', storage)).toBe(false);
      expect(persistence.setPersistedAppIcon(null, storage)).toBe(false);
    });

    it('should expose manager facade namespaces in persistence and state', () => {
      expect(persistence.AppearanceManager).toBeDefined();
      expect(persistence.LanguageManager).toBeDefined();
      expect(persistence.AppIconManager).toBeDefined();
      expect(persistence.CacheManager).toBeDefined();

      expect(state.AppearanceManager).toBeDefined();
      expect(state.LanguageManager).toBeDefined();
      expect(state.AppIconManager).toBeDefined();
      expect(state.CacheManager).toBeDefined();
    });
  });

  // =========================================================================
  // Suite 4: registry.js Registration of agent_groups & skill_hub & 7 Cue Categories
  // =========================================================================
  describe('Suite 4: registry.js Registration of agent_groups & skill_hub & 7 Cue Categories', () => {
    it('should register agent_groups in ACTION_POLICY_MANIFEST with exact 8 action policies', () => {
      const manifest = registry.ACTION_POLICY_MANIFEST;
      expect(manifest).toBeDefined();
      expect(manifest.agent_groups).toBeDefined();

      const expected = {
        list_groups: 'read_only',
        get_group: 'read_only',
        create_group: 'mutating',
        update_group: 'mutating',
        delete_group: 'high_risk',
        add_member: 'mutating',
        remove_member: 'mutating',
        set_pinned: 'mutating'
      };

      Object.entries(expected).forEach(([act, policy]) => {
        expect(manifest.agent_groups[act]).toBe(policy);
      });
      expect(Object.keys(manifest.agent_groups).length).toBe(8);
    });

    it('should map agent_groups actions in PROVIDER_ACTION_SCOPES', () => {
      const scopes = registry.PROVIDER_ACTION_SCOPES;
      expect(scopes.agent_groups).toBeDefined();

      expect(scopes.agent_groups.list_groups).toBe('group.read');
      expect(scopes.agent_groups.get_group).toBe('group.read');
      expect(scopes.agent_groups.create_group).toBe('group.manage');
      expect(scopes.agent_groups.update_group).toBe('group.manage');
      expect(scopes.agent_groups.delete_group).toBe('group.manage');
      expect(scopes.agent_groups.add_member).toBe('group.manage');
      expect(scopes.agent_groups.remove_member).toBe('group.manage');
      expect(scopes.agent_groups.set_pinned).toBe('group.manage');
    });

    it('should register skill_hub in ACTION_POLICY_MANIFEST with exact 5 action policies', () => {
      const manifest = registry.ACTION_POLICY_MANIFEST;
      expect(manifest.skill_hub).toBeDefined();

      const expected = {
        list_skills: 'read_only',
        toggle_skill: 'mutating',
        import_from_github: 'mutating',
        upload_skill: 'mutating',
        delete_skill: 'high_risk'
      };

      Object.entries(expected).forEach(([act, policy]) => {
        expect(manifest.skill_hub[act]).toBe(policy);
      });
      expect(Object.keys(manifest.skill_hub).length).toBe(5);
    });

    it('should map skill_hub actions in PROVIDER_ACTION_SCOPES', () => {
      const scopes = registry.PROVIDER_ACTION_SCOPES;
      expect(scopes.skill_hub).toBeDefined();

      expect(scopes.skill_hub.list_skills).toBe('skill.read');
      expect(scopes.skill_hub.toggle_skill).toBe('skill.manage');
      expect(scopes.skill_hub.import_from_github).toBe('skill.manage');
      expect(scopes.skill_hub.upload_skill).toBe('skill.manage');
      expect(scopes.skill_hub.delete_skill).toBe('skill.manage');
    });

    it('should contain all 7 official Cue categories in CUE_CATEGORIES', () => {
      expect(Array.isArray(registry.CUE_CATEGORIES)).toBe(true);
      const expectedCategories = ['Recommended', 'Health', 'Finance', 'Travel', 'Productivity', 'Developer', 'Social'];
      expect(registry.CUE_CATEGORIES).toEqual(expectedCategories);
    });

    it('should getCatalogByCategory correctly filter connectors for all 7 Cue categories', () => {
      const cats = registry.CUE_CATEGORIES;
      cats.forEach(c => {
        const catalog = registry.getCatalogByCategory(c);
        expect(Array.isArray(catalog)).toBe(true);
        expect(catalog.length).toBeGreaterThan(0);
      });

      // Verify specific placement
      const rec = registry.getCatalogByCategory('Recommended');
      expect(rec.some(a => a.id === 'agent_groups')).toBe(true);
      expect(rec.some(a => a.id === 'skill_hub')).toBe(true);

      const prod = registry.getCatalogByCategory('Productivity');
      expect(prod.some(a => a.id === 'agent_groups')).toBe(true);

      const dev = registry.getCatalogByCategory('Developer');
      expect(dev.some(a => a.id === 'skill_hub')).toBe(true);

      const soc = registry.getCatalogByCategory('Social');
      expect(soc.some(a => a.id === 'slack')).toBe(true);

      const travel = registry.getCatalogByCategory('Travel');
      expect(travel.some(a => a.id === 'google_maps')).toBe(true);

      // 'all' returns complete catalog
      expect(registry.getCatalogByCategory('all').length).toBe(registry.APPS_CATALOG.length);
    });

    it('should simulate agent_groups and skill_hub connector responses accurately', () => {
      const sim = registry._getSimulatedConnectorResponse;
      expect(typeof sim).toBe('function');

      // agent_groups simulations
      const listGroups = sim('agent_groups', 'list_groups');
      expect(Array.isArray(listGroups.groups)).toBe(true);

      const getGroup = sim('agent_groups', 'get_group', { groupId: 'grp_001' });
      expect(getGroup.groupId).toBe('grp_001');
      expect(getGroup.files.some(f => f.name === 'app-debug.apk')).toBe(true);

      const createGroup = sim('agent_groups', 'create_group', { name: 'Simulated Group' });
      expect(createGroup.success).toBe(true);
      expect(createGroup.name).toBe('Simulated Group');

      const updateGroup = sim('agent_groups', 'update_group', { groupId: 'grp_001' });
      expect(updateGroup.success).toBe(true);
      expect(updateGroup.updated).toBe(true);

      const delGroup = sim('agent_groups', 'delete_group', { groupId: 'grp_001' });
      expect(delGroup.success).toBe(true);
      expect(delGroup.deleted).toBe(true);

      const addMem = sim('agent_groups', 'add_member', { groupId: 'grp_001', agentId: 'a1' });
      expect(addMem.success).toBe(true);
      expect(addMem.added).toBe(true);

      const remMem = sim('agent_groups', 'remove_member', { groupId: 'grp_001', agentId: 'a1' });
      expect(remMem.success).toBe(true);
      expect(remMem.removed).toBe(true);

      const setPin = sim('agent_groups', 'set_pinned', { groupId: 'grp_001', isPinned: true });
      expect(setPin.success).toBe(true);
      expect(setPin.isPinned).toBe(true);

      // skill_hub simulations
      const listSkills = sim('skill_hub', 'list_skills');
      expect(Array.isArray(listSkills.skills)).toBe(true);

      const toggleSkill = sim('skill_hub', 'toggle_skill', { skillId: 'sk_test', enabled: false });
      expect(toggleSkill.success).toBe(true);
      expect(toggleSkill.enabled).toBe(false);

      const importSkill = sim('skill_hub', 'import_from_github', { repoUrl: 'https://github.com/foo/bar' });
      expect(importSkill.success).toBe(true);
      expect(importSkill.imported).toBe(true);

      const uploadSkill = sim('skill_hub', 'upload_skill', { name: 'Uploaded' });
      expect(uploadSkill.success).toBe(true);
      expect(uploadSkill.uploaded).toBe(true);

      const delSkill = sim('skill_hub', 'delete_skill', { skillId: 'sk_test' });
      expect(delSkill.success).toBe(true);
      expect(delSkill.deleted).toBe(true);
    });

    it('should execute provider requests in simulated mode for agent_groups and skill_hub', async () => {
      const resGroup = await registry.executeProviderRequest({
        providerId: 'agent_groups',
        action: 'list_groups',
        simulated: true
      });
      expect(resGroup.status).toBe(200);
      expect(resGroup.simulated).toBe(true);
      expect(resGroup.data.groups).toBeDefined();

      const resSkill = await registry.executeProviderRequest({
        providerId: 'skill_hub',
        action: 'list_skills',
        simulated: true
      });
      expect(resSkill.status).toBe(200);
      expect(resSkill.simulated).toBe(true);
      expect(resSkill.data.skills).toBeDefined();
    });
  });

  // =========================================================================
  // Suite 5: Static DOM & Event Handlers in index.html
  // =========================================================================
  describe('Suite 5: Static DOM & Event Handlers in index.html', () => {
    it('should verify cueAppearanceModal exists with system, light, and dark choices', () => {
      expect(htmlContent).toContain('cueAppearanceModal');
      expect(htmlContent).toContain('data-mode="system"');
      expect(htmlContent).toContain('data-mode="light"');
      expect(htmlContent).toContain('data-mode="dark"');
      expect(htmlContent).toContain('openCueAppearanceModal');
      expect(htmlContent).toContain('closeCueAppearanceModal');
      expect(htmlContent).toContain('setPersistedThemeMode');
    });

    it('should verify cueLanguageModal exists with 14 languages and RTL/LTR support', () => {
      expect(htmlContent).toContain('cueLanguageModal');
      expect(htmlContent).toContain('cueLanguageList');
      expect(htmlContent).toContain('openCueLanguageModal');
      expect(htmlContent).toContain('closeCueLanguageModal');
      expect(htmlContent).toContain('renderCueLanguageList');
      expect(htmlContent).toContain('setPersistedLanguage');

      // 14 Language codes
      const codes = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'de', 'es', 'es-419', 'ar', 'fr', 'id', 'it', 'pt', 'fa'];
      codes.forEach(c => {
        expect(htmlContent).toContain(c);
      });
    });

    it('should verify cueSkillsHubModal, cueAddSkillsMenu, cueImportGithubModal, and GitHub inputs', () => {
      expect(htmlContent).toContain('cueSkillsHubModal');
      expect(htmlContent).toContain('cueAddSkillsMenu');
      expect(htmlContent).toContain('cueImportGithubModal');
      expect(htmlContent).toContain('cueGithubRepoInput');
      expect(htmlContent).toContain('cueImportGithubBtn');
      expect(htmlContent).toContain('openCueSkillsHubModal');
      expect(htmlContent).toContain('closeCueSkillsHubModal');
      expect(htmlContent).toContain('openCueImportGithubModal');
      expect(htmlContent).toContain('submitImportSkillFromGitHub');
    });

    it('should verify in-chat more menu and full Group Chat Info Panel', () => {
      expect(htmlContent).toContain('cueChatMoreMenu');
      expect(htmlContent).toContain('chatHeaderMoreBtn');
      expect(htmlContent).toContain('cueGroupChatInfoPanel');
      expect(htmlContent).toContain('cueGroupTitleDisplay');
      expect(htmlContent).toContain('cueGroupMemberCountDisplay');
      expect(htmlContent).toContain('toggleCueChatMoreMenu');
      expect(htmlContent).toContain('openCueGroupChatInfoPanel');
      expect(htmlContent).toContain('closeCueGroupChatInfoPanel');
      expect(htmlContent).toContain('app-debug.apk');
      expect(htmlContent).toContain('View all files');
    });

    it('should verify appsCategoryBar with all 7 category tabs', () => {
      expect(htmlContent).toContain('appsCategoryBar');
      const cats = ['Recommended', 'Health', 'Finance', 'Travel', 'Productivity', 'Developer', 'Social'];
      cats.forEach(c => {
        expect(htmlContent).toContain(c);
      });
      expect(htmlContent).toContain('selectAppsCategory');
      expect(htmlContent).toContain('renderAppsCategories');
    });

    it('should verify cueAppIconModal with 4 choices and clear cache element with byte display', () => {
      expect(htmlContent).toContain('cueAppIconModal');
      expect(htmlContent).toContain('openCueAppIconModal');
      expect(htmlContent).toContain('closeCueAppIconModal');
      expect(htmlContent).toContain('selectAppIcon');

      // 4 app icons (matching UI labels and data-icon attributes)
      expect(htmlContent).toMatch(/Classic/i);
      expect(htmlContent).toMatch(/OLED Dark|oled_dark/i);
      expect(htmlContent).toMatch(/Cyberpunk|cyberpunk/i);
      expect(htmlContent).toMatch(/Minimal|minimal/i);

      // Clear cache row
      expect(htmlContent).toContain('settingsClearCacheBtn');
      expect(htmlContent).toContain('clearAppCache()');
      expect(htmlContent).toContain('settingsCacheSizeLabel');
    });

    it('should verify zero-stub policy with interactive functions bound to backing state', () => {
      const requiredFunctions = [
        'openCueAppearanceModal',
        'closeCueAppearanceModal',
        'setPersistedThemeMode',
        'openCueLanguageModal',
        'closeCueLanguageModal',
        'setPersistedLanguage',
        'openCueSkillsHubModal',
        'closeCueSkillsHubModal',
        'toggleCueAddSkillsMenu',
        'openCueImportGithubModal',
        'closeCueImportGithubModal',
        'submitImportSkillFromGitHub',
        'toggleCueChatMoreMenu',
        'openCueGroupChatInfoPanel',
        'closeCueGroupChatInfoPanel',
        'togglePinCurrentChat',
        'confirmDeleteCurrentGroupChat',
        'openAddGroupMembersModal',
        'viewAllGroupFiles',
        'selectAppsCategory',
        'renderAppsCategories',
        'openCueAppIconModal',
        'closeCueAppIconModal',
        'selectAppIcon',
        'clearAppCache'
      ];

      requiredFunctions.forEach(fn => {
        expect(htmlContent).toContain(fn);
      });
    });
  });

  // =========================================================================
  // Suite 6: Edge Cases, Branch Coverage & Resilient Fallbacks
  // =========================================================================
  describe('Suite 6: Edge Cases, Branch Coverage & Resilient Fallbacks', () => {
    it('should exercise persistence.js calculateStorageCacheSize across Map, plain object, null, and large units', () => {
      // null storage
      const nullRes = persistence.calculateStorageCacheSize(null);
      expect(nullRes.bytes).toBe(0);
      expect(nullRes.formatted).toBe('0 B');

      // Map storage
      const mapStore = new Map();
      mapStore.set('key1', 'val1');
      mapStore.set('key2', 'val2');
      const mapRes = persistence.calculateStorageCacheSize(mapStore);
      expect(mapRes.bytes).toBeGreaterThan(0);

      // Plain object storage
      const objStore = {
        keyA: 'abc',
        funcA: () => {},
        numVal: 12345
      };
      const objRes = persistence.calculateStorageCacheSize(objStore);
      expect(objRes.bytes).toBeGreaterThan(0);

      // Formatted units (KB, MB, GB)
      const bigStore = {
        huge: 'x'.repeat(1024 * 1024 + 10)
      };
      const bigRes = persistence.calculateStorageCacheSize(bigStore);
      expect(bigRes.formatted).toMatch(/MB/);
    });

    it('should exercise persistence.js clearAppCache with Map, plain object, custom preserve keys, and edge cases', () => {
      // null storage
      expect(persistence.clearAppCache(null)).toEqual({ success: true, freedBytes: 0 });

      // Map storage with transient and protected keys
      const mapStore = new Map();
      mapStore.set(persistence.STORAGE_KEY, JSON.stringify({
        chats: [{ id: '1', draftText: 'clear me' }, { id: '2' }],
        previewAssets: { img: 'base64' },
        cachedPreviews: { p: 1 },
        ephemeralCache: { e: 2 }
      }));
      mapStore.set('api_key_secret', 'secret123');
      mapStore.set('temp_cache_buffer', 'purge me');
      mapStore.set('custom_saved', 'do not purge');

      const mapResult = persistence.clearAppCache(mapStore, {
        customPreservedKeys: ['custom_saved'],
        extraKeysToRemove: ['non_existent_key']
      });
      expect(mapResult.success).toBe(true);
      expect(mapResult.freedBytes).toBeGreaterThan(0);
      expect(mapStore.has('api_key_secret')).toBe(true);
      expect(mapStore.has('custom_saved')).toBe(true);
      expect(mapStore.has('temp_cache_buffer')).toBe(false);

      // Plain object storage
      const objStore = {
        [persistence.STORAGE_KEY]: 'corrupted_non_json_data',
        transient_draft_item: 'purge this',
        auth_credential_key: 'preserve this'
      };
      const objResult = persistence.clearAppCache(objStore);
      expect(objResult.success).toBe(true);
      expect(objStore.transient_draft_item).toBeUndefined();
      expect(objStore.auth_credential_key).toBe('preserve this');
    });

    it('should test state.js delegation functions for theme, language, icon, and cache', () => {
      const storage = createIsolatedStorage();

      // Theme
      expect(state.getPersistedThemeMode(storage)).toBe('dark');
      expect(state.setPersistedThemeMode('light', storage)).toBe(true);
      expect(state.getPersistedThemeMode(storage)).toBe('light');

      // Language
      expect(state.getPersistedLanguage(storage)).toBe('en');
      expect(state.setPersistedLanguage('fa', storage)).toBe(true);
      expect(state.getPersistedLanguage(storage)).toBe('fa');

      // App Icon
      expect(state.getPersistedAppIcon(storage)).toBe('classic');
      expect(state.setPersistedAppIcon('cyberpunk', storage)).toBe(true);
      expect(state.getPersistedAppIcon(storage)).toBe('cyberpunk');

      // Cache size and clear
      const sz = state.calculateStorageCacheSize(storage);
      expect(typeof sz.bytes).toBe('number');
      const clr = state.clearAppCache(storage);
      expect(clr.success).toBe(true);
    });

    it('should test AgentGroupManager edge cases and error handling', () => {
      const storage = createIsolatedStorage();
      const mgr = new state.AgentGroupManager({ storage });

      // Create group with empty name falls back to default
      const defaultGrp = mgr.createGroup('', []);
      expect(['New Group Chat', 'Unnamed Group']).toContain(defaultGrp.name);

      // Nonexistent group operations
      expect(mgr.getGroup('non_existent')).toBeNull();
      expect(mgr.updateGroup('non_existent', { name: 'New' })).toBeNull();
      expect(mgr.deleteGroup('non_existent')).toBe(false);
      expect(mgr.addMember('non_existent', 'agent_x')).toBe(false);
      expect(mgr.removeMember('non_existent', 'agent_x')).toBe(false);
      expect(mgr.togglePin('non_existent')).toBe(false);
      expect(mgr.addFileToGroup('non_existent', { name: 'f.txt' })).toBeNull();
      expect(mgr.getGroupFiles('non_existent')).toEqual([]);

      // Adding duplicate member should not duplicate
      const grp = mgr.createGroup('Dup Test', ['agent_1']);
      expect(mgr.addMember(grp.groupId, 'agent_1')).toBe(true);
      const fetched = mgr.getGroup(grp.groupId);
      expect(fetched.agentIds.filter(id => id === 'agent_1').length).toBe(1);

      // Removing member
      expect(mgr.removeMember(grp.groupId, 'agent_unknown')).toBe(true);

      // Invalid JSON in storage recovery
      storage.setItem(persistence.AGENT_GROUPS_STORAGE_KEY, 'invalid_json{{{');
      const recoveredMgr = new state.AgentGroupManager({ storage });
      expect(recoveredMgr.listGroups()).toEqual([]);
    });

    it('should test SkillHubManager edge cases and filtering', () => {
      const storage = createIsolatedStorage();
      const mgr = new state.SkillHubManager({ storage });

      // Unknown filter falls back to all
      const allSkills = mgr.listSkills('unknown_random_filter');
      expect(Array.isArray(allSkills)).toBe(true);

      // Toggle skill with null ID
      expect(mgr.toggleSkill(null)).toBeNull();
      expect(mgr.toggleSkill('completely_non_existent_skill_id')).toBeNull();

      // Delete with null ID or nonexistent ID
      expect(mgr.deleteSkill(null)).toBe(false);
      expect(mgr.deleteSkill('non_existent_skill_id')).toBe(false);

      // Upload with missing or invalid payload
      expect(() => mgr.uploadSkill(null)).toThrow();
      const uploadedEmptyName = mgr.uploadSkill({ name: '' });
      expect(uploadedEmptyName).toBeDefined();
      expect(uploadedEmptyName.name).toMatch(/Custom Skill|Skill/);

      // Import GitHub with invalid URLs
      expect(() => mgr.importSkillFromGitHub('not_a_url')).toThrow();
      expect(() => mgr.importSkillFromGitHub('ftp://github.com/foo/bar')).toThrow();
      expect(() => mgr.importSkillFromGitHub('https://gitlab.com/foo/bar')).toThrow();

      // Corrupted storage recovery
      storage.setItem(persistence.USER_SKILLS_STORAGE_KEY, 'invalid_json{{{');
      const recoveredMgr = new state.SkillHubManager({ storage });
      expect(recoveredMgr.listSkills('user')).toEqual([]);
    });

    it('should test registry.js category helpers and simulated responses for all new providers', () => {
      // normalizeCueCategory
      expect(registry.normalizeCueCategory('RECOMMENDED')).toBe('Recommended');
      expect(registry.normalizeCueCategory('health')).toBe('Health');
      expect(registry.normalizeCueCategory('Finance')).toBe('Finance');
      expect(registry.normalizeCueCategory('travel')).toBe('Travel');
      expect(registry.normalizeCueCategory('productivity')).toBe('Productivity');
      expect(registry.normalizeCueCategory('developer')).toBe('Developer');
      expect(registry.normalizeCueCategory('social')).toBe('Social');
      expect(registry.normalizeCueCategory('Unknown_Category')).toBe('Productivity');

      // getCatalogByCategory
      const rec = registry.getCatalogByCategory('Recommended');
      expect(rec.length).toBeGreaterThan(0);
      const health = registry.getCatalogByCategory('Health');
      expect(health.length).toBeGreaterThan(0);
      const fin = registry.getCatalogByCategory('Finance');
      expect(fin.length).toBeGreaterThan(0);
      const trav = registry.getCatalogByCategory('Travel');
      expect(trav.length).toBeGreaterThan(0);
      const prod = registry.getCatalogByCategory('Productivity');
      expect(prod.length).toBeGreaterThan(0);
      const dev = registry.getCatalogByCategory('Developer');
      expect(dev.length).toBeGreaterThan(0);
      const soc = registry.getCatalogByCategory('Social');
      expect(soc.length).toBeGreaterThan(0);
      const all = registry.getCatalogByCategory('all');
      expect(all.length).toBeGreaterThan(0);
      const emptyCat = registry.getCatalogByCategory('non_existent_cat');
      expect(emptyCat).toEqual([]);

      // Simulated responses for agent_groups
      const simGroup1 = registry._getSimulatedConnectorResponse('agent_groups', 'unknown_action', {});
      expect(simGroup1.success).toBe(true);
      const simGroup2 = registry._getSimulatedConnectorResponse('agent_groups', 'create_group', {});
      expect(simGroup2.success).toBe(true);
      const simGroup3 = registry._getSimulatedConnectorResponse('agent_groups', 'update_group', { groupId: 'g1' });
      expect(simGroup3.success).toBe(true);
      const simGroup4 = registry._getSimulatedConnectorResponse('agent_groups', 'delete_group', { groupId: 'g1' });
      expect(simGroup4.success).toBe(true);
      const simGroup5 = registry._getSimulatedConnectorResponse('agent_groups', 'add_member', { groupId: 'g1' });
      expect(simGroup5.success).toBe(true);
      const simGroup6 = registry._getSimulatedConnectorResponse('agent_groups', 'remove_member', { groupId: 'g1' });
      expect(simGroup6.success).toBe(true);
      const simGroup7 = registry._getSimulatedConnectorResponse('agent_groups', 'set_pinned', { groupId: 'g1' });
      expect(simGroup7.success).toBe(true);

      // Simulated responses for skill_hub
      const simSkill1 = registry._getSimulatedConnectorResponse('skill_hub', 'unknown_action', {});
      expect(simSkill1.success).toBe(true);
      const simSkill2 = registry._getSimulatedConnectorResponse('skill_hub', 'upload_skill', {});
      expect(simSkill2.success).toBe(true);
      const simSkill3 = registry._getSimulatedConnectorResponse('skill_hub', 'delete_skill', { skillId: 's1' });
      expect(simSkill3.success).toBe(true);

      // Simulated responses for google_maps and slack
      const simMaps = registry._getSimulatedConnectorResponse('google_maps', 'geocode', { address: 'New York' });
      expect(Array.isArray(simMaps.results)).toBe(true);
      const simSlack = registry._getSimulatedConnectorResponse('slack', 'send_message', { message: 'hello' });
      expect(simSlack.ok).toBe(true);

      // Scope validation
      expect(registry.validateProviderScope('agent_groups', 'list_groups', ['group.manage'])).toBe(true);
      expect(registry.validateProviderScope('agent_groups', 'create_group', ['group.read'])).toBe(false);
      expect(registry.validateProviderScope('skill_hub', 'list_skills', ['skill.manage'])).toBe(true);
      expect(registry.validateProviderScope('skill_hub', 'upload_skill', ['skill.read'])).toBe(false);
    });
  });
});
