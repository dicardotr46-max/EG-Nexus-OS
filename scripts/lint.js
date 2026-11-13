#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('🔍 Running code quality, secret leak, and security policy linting...');

let errorCount = 0;

// 1. JSON files validation
const jsonFiles = ['package.json', 'manifest.json', 'capacitor.config.json', 'stryker.config.json'];
jsonFiles.forEach(file => {
  const p = path.join(rootDir, file);
  if (fs.existsSync(p)) {
    try {
      JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (err) {
      console.error(`❌ Invalid JSON in ${file}:`, err.message);
      errorCount++;
    }
  }
});

// 2. Secret leak and security rule scan
const leakPatterns = [
  { name: 'Hardcoded Google API Key', regex: /AIzaSy[0-9A-Za-z\-_]{33}/ },
  { name: 'Hardcoded GitHub Personal Access Token', regex: /ghp_[0-9A-Za-z]{36}/ },
  { name: 'Hardcoded OpenAI Secret Key', regex: /sk-[0-9A-Za-z]{40,}/ }
];

function getFilesToScan(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'coverage', 'dist', 'build_workspace'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list = list.concat(getFilesToScan(full));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.json'))) {
      list.push(full);
    }
  }
  return list;
}

const files = getFilesToScan(rootDir);
files.forEach(f => {
  // Exclude test mocks and docs
  const rel = path.relative(rootDir, f);
  if (rel.startsWith('__tests__') || rel.startsWith('dist') || rel.includes('test')) return;

  const content = fs.readFileSync(f, 'utf8');

  leakPatterns.forEach(pattern => {
    if (pattern.regex.test(content)) {
      console.error(`❌ Potential security issue in ${rel}: ${pattern.name} detected!`);
      errorCount++;
    }
  });

  // Dangerous eval check in src/
  if (rel.startsWith('src/') && /\beval\s*\(/.test(content)) {
    console.error(`❌ Disallowed eval() expression detected in ${rel}`);
    errorCount++;
  }
});

if (errorCount > 0) {
  console.error(`❌ Lint verification failed with ${errorCount} errors.`);
  process.exit(1);
}

console.log(`✅ Lint check passed: 0 secret leaks, valid JSON, and clean security rules across ${files.length} files.`);
