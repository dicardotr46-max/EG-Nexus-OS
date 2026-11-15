#!/usr/bin/env node
/**
 * EG Nexus OS — Full AST Syntax & Script Verification Engine
 * Verifies index.html inline script blocks and all tracked JavaScript files
 * (scripts, tests, www, benchmark_v4.js, benchmark_v5.js,
 * mobile_visual_crawler.js, jest.stryker.config.js, src, etc.)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const htmlPath = path.join(rootDir, 'index.html');

console.log('🔍 Running AST Syntax Check on EG Nexus OS codebase...');

// 1. Verify index.html inline script blocks
if (!fs.existsSync(htmlPath)) {
  console.error('❌ index.html not found at', htmlPath);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineBlocks = scriptMatches
  .map((m, idx) => ({ index: idx + 1, code: m[1] }))
  .filter(b => b.code.trim().length > 0);

inlineBlocks.forEach((b, i) => {
  try {
    new vm.Script(b.code, { filename: `index.html#block_${i + 1}` });
  } catch (err) {
    console.error(`❌ Syntax error in index.html block ${i + 1}:`, err);
    process.exit(1);
  }
});

// Combined inline scripts verification
try {
  new vm.Script(inlineBlocks.map(b => b.code).join('\n;\n'), { filename: 'index.html#combined' });
} catch (err) {
  console.error('❌ Syntax error in index.html combined script:', err);
  process.exit(1);
}
console.log(`✅ Passed: ${inlineBlocks.length} inline <script> blocks in index.html are syntactically valid.`);

// 2. Discover all JavaScript files tracked in repository
function getTrackedJsFiles(baseDir) {
  const fileSet = new Set();

  try {
    const gitOutput = execSync('git ls-files "*.js" "**/*.js"', {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    gitOutput.trim().split('\n').forEach(line => {
      const rel = line.trim();
      if (rel && rel.endsWith('.js')) {
        const abs = path.join(baseDir, rel);
        if (fs.existsSync(abs)) {
          fileSet.add(abs);
        }
      }
    });
  } catch (_) {
    // Fallback if git is unavailable
  }

  // Fallback / complement scan ensuring specific known targets are included
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', 'coverage', 'dist', 'build_workspace'].includes(entry.name)) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        fileSet.add(full);
      }
    }
  }

  scanDir(baseDir);

  // Explicit check for required individual files
  const explicitFiles = [
    'benchmark_v4.js',
    'benchmark_v5.js',
    'mobile_visual_crawler.js',
    'jest.stryker.config.js',
    'sw.js'
  ];
  explicitFiles.forEach(f => {
    const full = path.join(baseDir, f);
    if (fs.existsSync(full)) {
      fileSet.add(full);
    }
  });

  return Array.from(fileSet).sort();
}

const jsFiles = getTrackedJsFiles(rootDir);
let errorCount = 0;

jsFiles.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  try {
    new vm.Script(code, { filename: relPath });
  } catch (err) {
    console.error(`❌ Syntax error in ${relPath}:`, err.message);
    errorCount++;
  }
});

if (errorCount > 0) {
  console.error(`❌ AST Syntax verification failed with ${errorCount} error(s).`);
  process.exit(1);
}

console.log(`✅ Passed: ${jsFiles.length} JavaScript files across codebase are syntactically valid.`);
console.log('🎉 Full AST Syntax verification succeeded with 0 errors.');
