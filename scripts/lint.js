#!/usr/bin/env node
/**
 * EG Nexus OS — Code Quality, Secret Leak & Security Policy Linter
 * Scans all text files (.js, .html, .json, .py, .sh, .gradle, .java, .xml, .yml, .yaml)
 * across the codebase (including __tests__) for secret leaks, dangerous keys,
 * and disallowed expressions while whitelisting test mocks and dummy tokens.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('🔍 Running code quality, secret leak, and security policy linting...');

let errorCount = 0;

// 1. Target text file extensions
const textExtensions = [
  '.js',
  '.html',
  '.json',
  '.py',
  '.sh',
  '.gradle',
  '.java',
  '.xml',
  '.yml',
  '.yaml'
];

// 2. Secret leak and dangerous key patterns
const leakPatterns = [
  { name: 'Hardcoded Google API Key', regex: /AIzaSy[0-9A-Za-z\-_]{33}/ },
  { name: 'Hardcoded GitHub Personal Access Token', regex: /ghp_[0-9A-Za-z]{36}/ },
  { name: 'Hardcoded GitHub Fine-Grained PAT', regex: /github_pat_[0-9A-Za-z_]{82}/ },
  { name: 'Hardcoded OpenAI Secret Key', regex: /sk-[0-9A-Za-z]{40,}/ },
  { name: 'Hardcoded Anthropic Secret Key', regex: /sk-ant-[0-9A-Za-z\-_]{40,}/ },
  { name: 'Hardcoded Private Key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Hardcoded AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ }
];

// 3. Whitelist / Allowlist for test mock strings, dummy tokens, and fixtures
const MOCK_ALLOWLIST_PATTERNS = [
  /mock/i,
  /dummy/i,
  /test/i,
  /sample/i,
  /example/i,
  /placeholder/i,
  /fake/i,
  /fixture/i,
  /not_a_secret/i,
  /test-secret-mock/i,
  /test_dummy/i,
  /dummy_key/i,
  /dummy_token/i,
  /test_token/i,
  /leakPatterns/i
];

function isAllowedMockOrTest(matchedStr, lineContext, relPath) {
  // Never flag definitions in lint.js itself
  if (relPath === 'scripts/lint.js') {
    return true;
  }
  const textToCheck = `${matchedStr} ${lineContext}`;
  for (const pattern of MOCK_ALLOWLIST_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return true;
    }
  }
  return false;
}

function getFilesToScan(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'coverage', 'dist', 'build_workspace'].includes(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list = list.concat(getFilesToScan(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (textExtensions.includes(ext)) {
        list.push(full);
      }
    }
  }
  return list;
}

const files = getFilesToScan(rootDir);

files.forEach(f => {
  const rel = path.relative(rootDir, f);
  const content = fs.readFileSync(f, 'utf8');

  // JSON Validation
  if (f.endsWith('.json')) {
    try {
      JSON.parse(content);
    } catch (err) {
      console.error(`❌ Invalid JSON in ${rel}:`, err.message);
      errorCount++;
    }
  }

  // Scan line-by-line for secret leaks with context awareness
  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    leakPatterns.forEach(pattern => {
      const match = line.match(pattern.regex);
      if (match) {
        if (!isAllowedMockOrTest(match[0], line, rel)) {
          console.error(`❌ Potential security issue in ${rel}:${lineIdx + 1}: ${pattern.name} detected!`);
          errorCount++;
        }
      }
    });
  });

  // Dangerous eval check in src/ and www/src/
  if ((rel.startsWith('src/') || rel.startsWith('www/src/')) && /\beval\s*\(/.test(content)) {
    console.error(`❌ Disallowed eval() expression detected in ${rel}`);
    errorCount++;
  }
});

if (errorCount > 0) {
  console.error(`❌ Lint verification failed with ${errorCount} error(s).`);
  process.exit(1);
}

console.log(`✅ Lint check passed: 0 secret leaks, valid JSON, and clean security rules across ${files.length} files.`);
