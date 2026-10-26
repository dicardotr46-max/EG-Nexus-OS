const fs = require('fs');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

// Dynamically extract and run the sanitizeAvatarHexColor function from index.html
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');
let inS = false, start = -1, blocks = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!inS && (l === '<script>' || l.startsWith('<script id='))) {
    inS = true;
    start = i;
  } else if (inS && l === '</script>') {
    blocks.push(lines.slice(start + 1, i).join('\n'));
    inS = false;
  }
}

const sandbox = {
  window: {},
  document: {
    getElementById: () => ({}),
    createElement: () => ({ style: {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
    execCommand: () => true
  },
  navigator: { vibrate: () => {}, clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {} },
  crypto: { subtle: { digest: async () => {} }, createHash: () => ({ update: () => ({ digest: () => {} }), timingSafeEqual: () => true }) },
  history: { replaceState: () => {}, pushState: () => {} },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  console: console
};
vm.createContext(sandbox);

blocks.forEach((b, idx) => {
  try {
    vm.runInContext(b, sandbox);
  } catch (e) {
    // Expected to fail on some blocks due to missing browser APIs, but sanitizeAvatarHexColor should be defined
  }
});

const sanitizeAvatarHexColor = sandbox.sanitizeAvatarHexColor;

test('sanitizeAvatarHexColor', async (t) => {
  assert.ok(typeof sanitizeAvatarHexColor === 'function', 'sanitizeAvatarHexColor should be extracted');

  await t.test('returns lowercase 6-character hex color as is', () => {
    assert.strictEqual(sanitizeAvatarHexColor('#123456'), '#123456');
    assert.strictEqual(sanitizeAvatarHexColor('#abcdef'), '#abcdef');
  });

  await t.test('returns lowercase 6-character hex color for uppercase input', () => {
    assert.strictEqual(sanitizeAvatarHexColor('#ABCDEF'), '#abcdef');
  });

  await t.test('expands and lowercases valid 3-character hex color', () => {
    assert.strictEqual(sanitizeAvatarHexColor('#123'), '#112233');
    assert.strictEqual(sanitizeAvatarHexColor('#abc'), '#aabbcc');
    assert.strictEqual(sanitizeAvatarHexColor('#ABC'), '#aabbcc');
  });

  await t.test('trims whitespace around valid hex colors', () => {
    assert.strictEqual(sanitizeAvatarHexColor('  #123456  '), '#123456');
    assert.strictEqual(sanitizeAvatarHexColor('\t#abc\n'), '#aabbcc');
  });

  await t.test('returns default fallback (#1d8cf8) for invalid hex colors', () => {
    const defaultFallback = '#1d8cf8';
    assert.strictEqual(sanitizeAvatarHexColor('#12'), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor('#1234'), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor('#12345'), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor('#1234567'), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor('123456'), defaultFallback); // missing #
    assert.strictEqual(sanitizeAvatarHexColor('#12345g'), defaultFallback); // invalid character
    assert.strictEqual(sanitizeAvatarHexColor('invalid'), defaultFallback);
  });

  await t.test('returns default fallback for null, undefined, empty, or whitespace-only inputs', () => {
    const defaultFallback = '#1d8cf8';
    assert.strictEqual(sanitizeAvatarHexColor(null), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor(undefined), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor(''), defaultFallback);
    assert.strictEqual(sanitizeAvatarHexColor('   '), defaultFallback);
  });

  await t.test('returns custom fallback for invalid hex colors when provided', () => {
    const customFallback = '#ff0000';
    assert.strictEqual(sanitizeAvatarHexColor('invalid', customFallback), customFallback);
    assert.strictEqual(sanitizeAvatarHexColor(null, customFallback), customFallback);
    assert.strictEqual(sanitizeAvatarHexColor('#12', customFallback), customFallback);
  });
});
