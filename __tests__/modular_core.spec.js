const sanitization = require('../src/core/sanitization.js');
const state = require('../src/core/state.js');
const persistence = require('../src/core/persistence.js');
const secrets = require('../src/security/secrets.js');
const approvals = require('../src/security/approvals.js');
const registry = require('../src/providers/registry.js');

describe('Modular Core Architecture & Security', () => {
  test('sanitization exports correct functions and escapes HTML safely', () => {
    expect(typeof sanitization.escapeHtml).toBe('function');
    expect(typeof sanitization.escapeJsAttr).toBe('function');
    expect(typeof sanitization.normalizePersianText).toBe('function');
    expect(typeof sanitization.sanitizeHttpUrl).toBe('function');

    expect(sanitization.escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(sanitization.escapeJsAttr("test' OR '1'='1")).toContain('\\&#39;');
    expect(sanitization.sanitizeHttpUrl('javascript:alert(1)')).toBe('#');
    expect(sanitization.sanitizeHttpUrl('https://example.com/api')).toBe('https://example.com/api');
  });

  test('state module creates separate fresh instances', () => {
    const s1 = state.createInitialAppState();
    const s2 = state.createInitialAppState();
    expect(s1).not.toBe(s2);
    expect(s1.profileName).toBe('Ali');
    expect(Array.isArray(s1.chats)).toBe(true);
    expect(s1.apiKeys.gemini).toBe('');
  });

  test('persistence module builds persisted state with sanitized credentials', () => {
    const testState = state.createInitialAppState();
    testState.apiKeys.gemini = 'secret-key-123';
    testState.cloudConfig.workerSecret = 'worker-sec';
    testState.telegramConfig.botToken = 'bot-tok';

    const persisted = persistence.buildPersistedState(testState);
    expect(persisted.apiKeys.gemini).toBe('');
    expect(persisted.cloudConfig.workerSecret).toBe('');
    expect(persisted.telegramConfig.botToken).toBe('');
  });

  test('secrets module encrypts and decrypts with AES-GCM and sync fallback', () => {
    const rawKeys = new Uint8Array(32).fill(7);
    const iv = new Uint8Array(12).fill(3);
    const plain = new TextEncoder().encode(JSON.stringify({ apiKey: 'sk-antigravity-999' }));

    const cipher = secrets._syncTransform(plain, rawKeys, iv);
    expect(cipher).not.toEqual(plain);

    const decrypted = secrets._syncTransform(cipher, rawKeys, iv);
    expect(decrypted).toEqual(plain);
    const parsed = JSON.parse(new TextDecoder().decode(decrypted));
    expect(parsed.apiKey).toBe('sk-antigravity-999');
  });

  test('secrets module converts hex to uint8 and back deterministically', () => {
    const original = new Uint8Array([0, 15, 255, 128, 42]);
    const hex = secrets._uint8ToHex(original);
    expect(hex).toBe('000fff802a');
    const back = secrets._hexToUint8(hex);
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  test('providers registry validates Google scopes and models', () => {
    expect(registry.getGoogleScopes('gmail')).toContain('gmail.readonly');
    expect(registry.validateRequestedGoogleScope('https://www.googleapis.com/auth/gmail.readonly')).toBe(true);
    expect(registry.validateRequestedGoogleScope('https://evil.com/auth')).toBe(false);
    expect(registry.resolveProviderModelId('deepseek-flash', false)).toBe('deepseek-flash');
    expect(registry.resolveProviderModelId('deepseek-flash', true)).toBe('deepseek/deepseek-flash');
  });
});
