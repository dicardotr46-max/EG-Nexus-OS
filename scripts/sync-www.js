#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function copyFileWithDir(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function syncDirectory(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      syncDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileWithDir(srcPath, destPath);
    }
  }
}

function collectFiles(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list = list.concat(collectFiles(full));
    } else if (entry.isFile()) {
      list.push(full);
    }
  }
  return list;
}

console.log('🔄 Synchronizing root assets to www/ directory...');

// Ensure www exists
if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

// 1. Copy top-level assets
const topFiles = ['index.html', 'sw.js', 'manifest.json'];
topFiles.forEach(file => {
  const src = path.join(rootDir, file);
  const dest = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    copyFileWithDir(src, dest);
  }
});

// 2. Sync src directory
const srcDir = path.join(rootDir, 'src');
const wwwSrcDir = path.join(wwwDir, 'src');
if (fs.existsSync(srcDir)) {
  syncDirectory(srcDir, wwwSrcDir);
}

// 3. Verify SHA-256 parity for all assets
console.log('🔍 Verifying SHA-256 parity between root and www/ mirror...');
let mismatchCount = 0;

topFiles.forEach(file => {
  const src = path.join(rootDir, file);
  const dest = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    const hashSrc = sha256File(src);
    const hashDest = sha256File(dest);
    if (hashSrc !== hashDest) {
      console.error(`❌ Mismatch in ${file}: root=${hashSrc} vs www=${hashDest}`);
      mismatchCount++;
    }
  }
});

const allSrcFiles = collectFiles(srcDir);
allSrcFiles.forEach(srcPath => {
  const rel = path.relative(srcDir, srcPath);
  const destPath = path.join(wwwSrcDir, rel);
  if (!fs.existsSync(destPath)) {
    console.error(`❌ Missing file in www/src: ${rel}`);
    mismatchCount++;
    return;
  }
  const hashSrc = sha256File(srcPath);
  const hashDest = sha256File(destPath);
  if (hashSrc !== hashDest) {
    console.error(`❌ Mismatch in src/${rel}: root=${hashSrc} vs www=${hashDest}`);
    mismatchCount++;
  }
});

if (mismatchCount > 0) {
  console.error(`❌ Mirror verification failed with ${mismatchCount} mismatches.`);
  process.exit(1);
}

console.log('✅ Mirror parity verification succeeded: 100% byte-for-byte SHA-256 parity.');
