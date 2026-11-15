#!/usr/bin/env node
/**
 * EG-Nexus-OS — CycloneDX v1.5 Software Bill of Materials (SBOM) Generator
 * Generates 100% byte-for-byte deterministic, spec-compliant dist/sbom.cdx.json
 * combining npm lockfile packages and Android Gradle Maven dependencies.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function generateDeterministicUuid(seedString) {
  const hash = crypto.createHash('sha256').update(seedString).digest('hex');
  const p1 = hash.substring(0, 8);
  const p2 = hash.substring(8, 12);
  const p3 = '5' + hash.substring(13, 16); // UUID v5 (name-based)
  const p4 = ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20); // RFC 4122 variant
  const p5 = hash.substring(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function getDeterministicTimestamp(rootDir) {
  if (process.env.SOURCE_DATE_EPOCH) {
    const epoch = parseInt(process.env.SOURCE_DATE_EPOCH, 10);
    if (!isNaN(epoch)) {
      return new Date(epoch * 1000).toISOString();
    }
  }
  try {
    const gitTime = execSync('git log -1 --format=%cI', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (gitTime) {
      const d = new Date(gitTime);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  } catch (_) {}
  return '2026-11-15T00:00:00.000Z';
}

function parseGradleVariables(variablesGradlePath) {
  const vars = {};
  if (!fs.existsSync(variablesGradlePath)) return vars;
  const content = fs.readFileSync(variablesGradlePath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([a-zA-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
      vars[match[1]] = match[2];
    }
  }
  return vars;
}

function parseAndroidDependencies(buildGradlePath, variables, pkg) {
  const mavenDeps = [];
  if (!fs.existsSync(buildGradlePath)) return mavenDeps;
  const content = fs.readFileSync(buildGradlePath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Capacitor Android module dependency
    if (trimmed.includes("project(':capacitor-android')")) {
      const capVer = (pkg.dependencies && pkg.dependencies['@capacitor/android']) || pkg.version || '8.6.0';
      mavenDeps.push({
        group: 'com.getcapacitor',
        name: 'capacitor-android',
        version: capVer,
        purl: `pkg:maven/com.getcapacitor/capacitor-android@${capVer}`
      });
      continue;
    }

    // Cordova plugins module dependency
    if (trimmed.includes("project(':capacitor-cordova-android-plugins')")) {
      const capVer = (pkg.dependencies && pkg.dependencies['@capacitor/android']) || pkg.version || '8.6.0';
      mavenDeps.push({
        group: 'com.getcapacitor',
        name: 'capacitor-cordova-android-plugins',
        version: capVer,
        purl: `pkg:maven/com.getcapacitor/capacitor-cordova-android-plugins@${capVer}`
      });
      continue;
    }

    // Match dependency declarations: implementation, testImplementation, etc.
    const match = trimmed.match(/(?:implementation|api|testImplementation|androidTestImplementation|classpath)\s+["']([^"']+)["']/);
    if (match) {
      const coord = match[1];
      const parts = coord.split(':');
      if (parts.length >= 3) {
        const group = parts[0];
        const artifact = parts[1];
        let ver = parts.slice(2).join(':');
        if (ver.startsWith('$')) {
          const varName = ver.slice(1);
          ver = variables[varName] || ver;
        }
        mavenDeps.push({
          group: group,
          name: artifact,
          version: ver,
          purl: `pkg:maven/${group}/${artifact}@${ver}`
        });
      }
    }
  }

  return mavenDeps;
}

function generateCycloneDxSbom(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const pkgPath = path.join(rootDir, 'package.json');
  const lockPath = path.join(rootDir, 'package-lock.json');
  const distDir = options.outDir || path.join(rootDir, 'dist');
  const outFile = options.outFile || path.join(distDir, 'sbom.cdx.json');

  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }
  if (!fs.existsSync(lockPath)) {
    throw new Error(`package-lock.json not found at ${lockPath}`);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  const components = [];
  const seenPurls = new Set();

  function parseIntegrity(integrityStr) {
    if (!integrityStr || typeof integrityStr !== 'string') return [];
    const hashes = [];
    const entries = integrityStr.trim().split(/\s+/);
    for (const entry of entries) {
      if (entry.startsWith('sha512-')) {
        const base64 = entry.slice(7);
        hashes.push({
          alg: 'SHA-512',
          content: Buffer.from(base64, 'base64').toString('hex')
        });
      } else if (entry.startsWith('sha1-')) {
        const base64 = entry.slice(5);
        hashes.push({
          alg: 'SHA-1',
          content: Buffer.from(base64, 'base64').toString('hex')
        });
      } else if (entry.startsWith('sha256-')) {
        const base64 = entry.slice(7);
        hashes.push({
          alg: 'SHA-256',
          content: Buffer.from(base64, 'base64').toString('hex')
        });
      }
    }
    return hashes;
  }

  function formatPurl(name, version) {
    const encodedName = name.startsWith('@')
      ? `%40${name.slice(1)}`
      : name;
    return `pkg:npm/${encodedName}@${version}`;
  }

  // 1. Handle npm lockfile v2 / v3 packages
  if (lock.packages && typeof lock.packages === 'object') {
    for (const [pkgKey, pkgData] of Object.entries(lock.packages)) {
      if (!pkgKey || pkgKey === '') continue; // Skip root package
      if (!pkgData || typeof pkgData !== 'object') continue;

      const parts = pkgKey.split('node_modules/');
      const rawName = parts[parts.length - 1];
      const version = pkgData.version;
      if (!rawName || !version) continue;

      const purl = formatPurl(rawName, version);
      if (seenPurls.has(purl)) continue;
      seenPurls.add(purl);

      const component = {
        'bom-ref': purl,
        type: 'library',
        name: rawName,
        version: String(version),
        purl: purl,
        hashes: parseIntegrity(pkgData.integrity)
      };

      if (pkgData.license) {
        component.licenses = [
          {
            license: {
              id: typeof pkgData.license === 'string' ? pkgData.license : (pkgData.license.type || 'UNKNOWN')
            }
          }
        ];
      }

      components.push(component);
    }
  } else if (lock.dependencies && typeof lock.dependencies === 'object') {
    // Fallback for v1 lockfiles
    for (const [depName, depData] of Object.entries(lock.dependencies)) {
      if (!depData || !depData.version) continue;
      const purl = formatPurl(depName, depData.version);
      if (seenPurls.has(purl)) continue;
      seenPurls.add(purl);

      components.push({
        'bom-ref': purl,
        type: 'library',
        name: depName,
        version: String(depData.version),
        purl: purl,
        hashes: parseIntegrity(depData.integrity)
      });
    }
  }

  // 2. Extract Android/Gradle Maven dependencies from build.gradle and variables.gradle
  const appGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
  const varGradlePath = path.join(rootDir, 'android', 'variables.gradle');
  const gradleVars = parseGradleVariables(varGradlePath);
  const androidDeps = parseAndroidDependencies(appGradlePath, gradleVars, pkg);

  for (const dep of androidDeps) {
    if (seenPurls.has(dep.purl)) continue;
    seenPurls.add(dep.purl);

    components.push({
      'bom-ref': dep.purl,
      type: 'library',
      group: dep.group,
      name: dep.name,
      version: String(dep.version),
      purl: dep.purl
    });
  }

  // 3. Sort all components deterministically by purl and name
  components.sort((a, b) => {
    const purlA = a.purl || '';
    const purlB = b.purl || '';
    if (purlA !== purlB) {
      return purlA.localeCompare(purlB);
    }
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });

  // 4. Derive deterministic UUID v5 from package-lock.json and android/app/build.gradle
  const lockData = fs.readFileSync(lockPath, 'utf8');
  const appGradleData = fs.existsSync(appGradlePath) ? fs.readFileSync(appGradlePath, 'utf8') : '';
  const varGradleData = fs.existsSync(varGradlePath) ? fs.readFileSync(varGradlePath, 'utf8') : '';
  const seedString = `${lockData}\n${appGradleData}\n${varGradleData}`;
  const deterministicUuid = generateDeterministicUuid(seedString);

  // 5. Build deterministic CycloneDX SBOM
  const rootPurl = formatPurl(pkg.name || 'eg-nexus-os', pkg.version || '6.0.0');
  const sbom = {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${deterministicUuid}`,
    version: 1,
    metadata: {
      timestamp: getDeterministicTimestamp(rootDir),
      tools: [
        {
          vendor: 'EG-Nexus-OS',
          name: 'generate-cyclonedx-sbom',
          version: pkg.version || '6.0.0'
        }
      ],
      component: {
        'bom-ref': rootPurl,
        type: 'application',
        name: pkg.name || 'eg-nexus-os',
        version: pkg.version || '6.0.0',
        description: pkg.description || '',
        purl: rootPurl
      }
    },
    components: components
  };

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(sbom, null, 2) + '\n', 'utf8');
  console.log(`✅ Successfully generated CycloneDX v1.5 SBOM with ${components.length} components at ${outFile}`);
  return sbom;
}

if (require.main === module) {
  try {
    generateCycloneDxSbom();
  } catch (err) {
    console.error('❌ Error generating CycloneDX SBOM:', err);
    process.exit(1);
  }
}

module.exports = {
  generateCycloneDxSbom,
  generateDeterministicUuid,
  getDeterministicTimestamp,
  parseGradleVariables,
  parseAndroidDependencies
};
