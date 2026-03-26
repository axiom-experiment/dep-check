'use strict';

const fs = require('fs');
const path = require('path');
const { parseContent } = require('./parser');

// File extensions to scan for imports
const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.tsx', '.mts', '.cts',
]);

// Directories to always skip
const DEFAULT_SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', 'coverage',
  '.nyc_output', '.cache', '.parcel-cache',
  '__pycache__', '.tox', 'vendor',
]);

/**
 * Recursively collect all scannable source files in a directory.
 * @param {string} dir - Directory to scan
 * @param {Set<string>} skipDirs - Directory names to skip
 * @returns {string[]} Array of absolute file paths
 */
function collectFiles(dir, skipDirs = DEFAULT_SKIP_DIRS) {
  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
        const subDir = path.join(dir, entry.name);
        results.push(...collectFiles(subDir, skipDirs));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  return results;
}

/**
 * Read package.json and extract dependency categories.
 * @param {string} projectRoot
 * @returns {{ dependencies: Set<string>, devDependencies: Set<string>, peerDependencies: Set<string>, optionalDependencies: Set<string>, all: Set<string> }}
 */
function readPackageJson(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  let pkg;

  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read package.json at ${pkgPath}: ${err.message}`);
  }

  const dependencies = new Set(Object.keys(pkg.dependencies || {}));
  const devDependencies = new Set(Object.keys(pkg.devDependencies || {}));
  const peerDependencies = new Set(Object.keys(pkg.peerDependencies || {}));
  const optionalDependencies = new Set(Object.keys(pkg.optionalDependencies || {}));
  const all = new Set([
    ...dependencies,
    ...devDependencies,
    ...peerDependencies,
    ...optionalDependencies,
  ]);

  return { dependencies, devDependencies, peerDependencies, optionalDependencies, all, pkg };
}

/**
 * Scan a project for unused and missing dependencies.
 * @param {string} projectRoot - Root directory of the project
 * @param {object} options
 * @param {string[]} [options.skipDirs] - Additional directories to skip
 * @param {boolean} [options.includeDevDeps=true] - Include devDependencies in analysis
 * @returns {object} Scan results
 */
function scan(projectRoot, options = {}) {
  const {
    skipDirs = [],
    includeDevDeps = true,
  } = options;

  const customSkipDirs = new Set([...DEFAULT_SKIP_DIRS, ...skipDirs]);

  // Read package.json
  const { dependencies, devDependencies, peerDependencies, optionalDependencies, all, pkg } = readPackageJson(projectRoot);

  // Collect all source files
  const files = collectFiles(projectRoot, customSkipDirs);

  // Parse all files for used packages
  const usedPackages = new Set();
  const fileResults = [];

  for (const filePath of files) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const filePackages = parseContent(content);
    for (const pkg of filePackages) {
      usedPackages.add(pkg);
    }

    if (filePackages.size > 0) {
      fileResults.push({
        file: path.relative(projectRoot, filePath),
        packages: [...filePackages].sort(),
      });
    }
  }

  // Determine which deps to check
  const depsToCheck = includeDevDeps
    ? new Set([...dependencies, ...devDependencies])
    : dependencies;

  // Find unused: in package.json but not in source
  const unused = [];
  for (const dep of depsToCheck) {
    if (!usedPackages.has(dep)) {
      unused.push({
        name: dep,
        category: dependencies.has(dep) ? 'dependencies'
          : devDependencies.has(dep) ? 'devDependencies'
          : 'other',
      });
    }
  }

  // Find missing: used in source but not in any dep category
  const missing = [];
  for (const used of usedPackages) {
    if (!all.has(used)) {
      missing.push(used);
    }
  }

  // Peer/optional deps that aren't used (informational)
  const unusedPeer = [];
  for (const dep of peerDependencies) {
    if (!usedPackages.has(dep)) {
      unusedPeer.push(dep);
    }
  }

  return {
    projectRoot,
    packageName: pkg.name || path.basename(projectRoot),
    filesScanned: files.length,
    usedPackages: [...usedPackages].sort(),
    unused: unused.sort((a, b) => a.name.localeCompare(b.name)),
    missing: missing.sort(),
    unusedPeer: unusedPeer.sort(),
    summary: {
      filesScanned: files.length,
      uniquePackagesUsed: usedPackages.size,
      unusedCount: unused.length,
      missingCount: missing.length,
    },
  };
}

module.exports = { scan, collectFiles, readPackageJson };
