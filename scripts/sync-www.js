#!/usr/bin/env node
/**
 * EG Nexus OS — Bidirectional Mirror Synchronization & Parity Engine
 * Synchronizes root assets to www/ mirror with automated pruning and
 * bidirectional byte-for-byte SHA-256 verification.
 */

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

function pruneEmptyDirectories(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      pruneEmptyDirectories(sub);
    }
  }
  const remaining = fs.readdirSync(dir);
  if (remaining.length === 0) {
    try {
      fs.rmdirSync(dir);
    } catch (_) {}
  }
}

/**
 * Synchronizes src/ to www/src/ with automated pruning of stale or deleted files
 */
function syncSrc(srcDir, wwwSrcDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(wwwSrcDir)) {
    fs.mkdirSync(wwwSrcDir, { recursive: true });
  }

  // 1. Copy/update all files from src to www/src
  syncDirectory(srcDir, wwwSrcDir);

  // 2. Prune any files in www/src that do not exist in src
  const wwwFiles = collectFiles(wwwSrcDir);
  for (const wwwFile of wwwFiles) {
    const rel = path.relative(wwwSrcDir, wwwFile);
    const srcFile = path.join(srcDir, rel);
    if (!fs.existsSync(srcFile)) {
      console.log(`🧹 Pruning stale file from www/src: ${rel}`);
      try {
        fs.unlinkSync(wwwFile);
      } catch (err) {
        console.error(`❌ Failed to prune stale file ${wwwFile}:`, err.message);
      }
    }
  }

  // 3. Clean up empty directories in www/src
  const subdirs = fs.readdirSync(wwwSrcDir, { withFileTypes: true });
  for (const sub of subdirs) {
    if (sub.isDirectory()) {
      pruneEmptyDirectories(path.join(wwwSrcDir, sub.name));
    }
  }
}

function syncGradleVersion() {
  const pkgPath = path.join(rootDir, 'package.json');
  const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

  if (!fs.existsSync(pkgPath) || !fs.existsSync(gradlePath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const versionParts = String(pkg.version || '0.0.0').trim().split('.');
  const major = parseInt(versionParts[0] || '0', 10);
  const minor = parseInt(versionParts[1] || '0', 10);
  const patch = parseInt((versionParts[2] || '0').split(/[-+]/)[0], 10) || 0;
  const versionCode = (major * 10000) + (minor * 100) + patch;

  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/, 'versionCode ' + versionCode);
  content = content.replace(/versionName\s+["'][^"']+["']/, 'versionName "' + pkg.version + '"');

  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('🤖 Synced android/app/build.gradle version to', pkg.version, '(' + versionCode + ')');
}

/**
 * Bidirectional parity verification check
 * Verifies src/ -> www/src/ AND ensures NO extra or stale files in www/src/
 */
function verifyParity(options = {}) {
  const root = options.rootDir || rootDir;
  const www = options.wwwDir || wwwDir;
  const topFiles = options.topFiles || ['index.html', 'sw.js', 'manifest.json'];
  const src = path.join(root, 'src');
  const wwwSrc = path.join(www, 'src');

  console.log('🔍 Verifying SHA-256 parity between root and www/ mirror...');
  let mismatchCount = 0;

  // 1. Verify top-level assets
  topFiles.forEach(file => {
    const srcPath = path.join(root, file);
    const destPath = path.join(www, file);
    if (fs.existsSync(srcPath)) {
      if (!fs.existsSync(destPath)) {
        console.error(`❌ Missing top-level asset in www: ${file}`);
        mismatchCount++;
        return;
      }
      const hashSrc = sha256File(srcPath);
      const hashDest = sha256File(destPath);
      if (hashSrc !== hashDest) {
        console.error(`❌ Mismatch in ${file}: root=${hashSrc} vs www=${hashDest}`);
        mismatchCount++;
      }
    }
  });

  // 2. Verify all files in src/ match www/src/ with identical SHA-256
  const allSrcFiles = collectFiles(src);
  allSrcFiles.forEach(srcPath => {
    const rel = path.relative(src, srcPath);
    const destPath = path.join(wwwSrc, rel);
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

  // 3. Bidirectional check: ensure NO extra or stale files in www/src/
  const allWwwSrcFiles = collectFiles(wwwSrc);
  allWwwSrcFiles.forEach(wwwPath => {
    const rel = path.relative(wwwSrc, wwwPath);
    const originalSrcPath = path.join(src, rel);
    if (!fs.existsSync(originalSrcPath)) {
      console.error(`❌ Extra/stale file found in www/src: ${rel}`);
      if (options.autoPrune) {
        try {
          fs.unlinkSync(wwwPath);
          console.log(`   🧹 Auto-pruned stale file: ${rel}`);
        } catch (e) {
          console.error(`   ❌ Failed to auto-prune stale file ${rel}:`, e.message);
          mismatchCount++;
        }
      } else {
        mismatchCount++;
      }
    }
  });

  if (mismatchCount > 0) {
    console.error(`❌ Mirror verification failed with ${mismatchCount} mismatches.`);
    return false;
  }

  console.log('✅ Mirror parity verification succeeded: 100% byte-for-byte SHA-256 parity.');
  return true;
}

function runSync(options = {}) {
  console.log('🔄 Synchronizing root assets to www/ directory...');

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

  // 2. Bidirectional sync and prune for src/
  const srcDir = path.join(rootDir, 'src');
  const wwwSrcDir = path.join(wwwDir, 'src');
  if (fs.existsSync(srcDir)) {
    syncSrc(srcDir, wwwSrcDir);
  }

  // 3. Sync Android Gradle version
  syncGradleVersion();

  // 4. Verify bidirectional parity
  const paritySuccess = verifyParity(options);
  if (!paritySuccess) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSync();
}

module.exports = {
  syncSrc,
  verifyParity,
  syncGradleVersion,
  syncDirectory,
  collectFiles,
  sha256File,
  runSync
};
