#!/usr/bin/env node
/**
 * EG-Nexus-OS — CycloneDX v1.5 Software Bill of Materials (SBOM) Generator
 * Generates spec-compliant dist/sbom.cdx.json from package-lock.json and package.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  // Handle npm lockfile v2 / v3 packages
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

  // Sort components deterministically by name and version
  components.sort((a, b) => (a.name + '@' + a.version).localeCompare(b.name + '@' + b.version));

  const rootPurl = formatPurl(pkg.name || 'eg-nexus-os', pkg.version || '6.0.0');
  const sbom = {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
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

module.exports = { generateCycloneDxSbom };
