#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const htmlPath = path.join(rootDir, 'index.html');
const swPath = path.join(rootDir, 'sw.js');
const srcDir = path.join(rootDir, 'src');

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

if (inlineBlocks.length !== 5) {
  console.warn(`⚠️ Expected 5 inline script blocks in index.html, found ${inlineBlocks.length}`);
}

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

// 2. Verify sw.js
if (fs.existsSync(swPath)) {
  const swCode = fs.readFileSync(swPath, 'utf8');
  try {
    new vm.Script(swCode, { filename: 'sw.js' });
    console.log('✅ Passed: sw.js is syntactically valid.');
  } catch (err) {
    console.error('❌ Syntax error in sw.js:', err);
    process.exit(1);
  }
}

// 3. Verify all src/**/*.js
function getJsFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const srcFiles = getJsFiles(srcDir);
srcFiles.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  try {
    new vm.Script(code, { filename: relPath });
  } catch (err) {
    console.error(`❌ Syntax error in ${relPath}:`, err);
    process.exit(1);
  }
});
console.log(`✅ Passed: ${srcFiles.length} JavaScript files in src/ are syntactically valid.`);
console.log('🎉 Full AST Syntax verification succeeded with 0 errors.');
