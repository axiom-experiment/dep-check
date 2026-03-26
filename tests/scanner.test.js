'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scan, collectFiles, readPackageJson } = require('../src/scanner');

// --- Test Fixture Helpers ---

function createTempProject(files, pkgJson) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-check-test-'));

  // Write package.json
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(pkgJson, null, 2)
  );

  // Write source files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return dir;
}

function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- Tests ---

describe('collectFiles()', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-check-collect-'));
    // Create a structure
    fs.writeFileSync(path.join(tmpDir, 'index.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'utils.mjs'), '');
    fs.writeFileSync(path.join(tmpDir, 'style.css'), '');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '');
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'helper.ts'), '');
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), '');
  });

  after(() => cleanupTempDir(tmpDir));

  test('finds JS and TS files', () => {
    const files = collectFiles(tmpDir);
    const names = files.map(f => path.basename(f));
    assert.ok(names.includes('index.js'));
    assert.ok(names.includes('utils.mjs'));
    assert.ok(names.includes('helper.ts'));
  });

  test('excludes non-JS/TS files', () => {
    const files = collectFiles(tmpDir);
    const names = files.map(f => path.basename(f));
    assert.ok(!names.includes('style.css'));
    assert.ok(!names.includes('README.md'));
  });

  test('skips node_modules', () => {
    const files = collectFiles(tmpDir);
    const inNodeModules = files.some(f => f.includes('node_modules'));
    assert.equal(inNodeModules, false);
  });
});

describe('readPackageJson()', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-check-pkg-'));
    const pkg = {
      name: 'test-project',
      dependencies: { express: '^4.0.0', lodash: '^4.0.0' },
      devDependencies: { jest: '^29.0.0', typescript: '^5.0.0' },
      peerDependencies: { react: '>=17' },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));
  });

  after(() => cleanupTempDir(tmpDir));

  test('reads all dependency categories', () => {
    const result = readPackageJson(tmpDir);
    assert.ok(result.dependencies.has('express'));
    assert.ok(result.dependencies.has('lodash'));
    assert.ok(result.devDependencies.has('jest'));
    assert.ok(result.devDependencies.has('typescript'));
    assert.ok(result.peerDependencies.has('react'));
  });

  test('builds unified all set', () => {
    const result = readPackageJson(tmpDir);
    assert.ok(result.all.has('express'));
    assert.ok(result.all.has('jest'));
    assert.ok(result.all.has('react'));
  });

  test('throws if package.json missing', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-check-empty-'));
    try {
      assert.throws(() => readPackageJson(emptyDir), /Cannot read package.json/);
    } finally {
      cleanupTempDir(emptyDir);
    }
  });
});

describe('scan() — unused dependencies', () => {
  test('detects unused production dependency', () => {
    const tmpDir = createTempProject(
      { 'index.js': `const express = require('express');` },
      {
        name: 'my-app',
        dependencies: { express: '*', lodash: '*' }, // lodash unused
      }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.unused.length, 1);
      assert.equal(result.unused[0].name, 'lodash');
      assert.equal(result.unused[0].category, 'dependencies');
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test('detects unused devDependency', () => {
    const tmpDir = createTempProject(
      { 'index.js': `const a = require('actual-dep');` },
      {
        name: 'my-app',
        dependencies: { 'actual-dep': '*' },
        devDependencies: { jest: '*', eslint: '*' }, // both unused
      }
    );
    try {
      const result = scan(tmpDir);
      const unusedNames = result.unused.map(u => u.name).sort();
      assert.ok(unusedNames.includes('jest'));
      assert.ok(unusedNames.includes('eslint'));
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test('no unused when all deps are used', () => {
    const tmpDir = createTempProject(
      { 'index.js': `
        const express = require('express');
        const _ = require('lodash');
      ` },
      {
        name: 'my-app',
        dependencies: { express: '*', lodash: '*' },
      }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.unused.length, 0);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});

describe('scan() — missing dependencies', () => {
  test('detects missing dependency', () => {
    const tmpDir = createTempProject(
      { 'index.js': `
        const express = require('express');
        const axios = require('axios'); // not in package.json
      ` },
      {
        name: 'my-app',
        dependencies: { express: '*' },
      }
    );
    try {
      const result = scan(tmpDir);
      assert.ok(result.missing.includes('axios'));
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test('no missing when all used packages are declared', () => {
    const tmpDir = createTempProject(
      { 'index.js': `const express = require('express');` },
      {
        name: 'my-app',
        dependencies: { express: '*' },
      }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.missing.length, 0);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});

describe('scan() — options', () => {
  test('--no-dev skips devDependencies check', () => {
    const tmpDir = createTempProject(
      { 'index.js': `const a = require('actual-dep');` },
      {
        name: 'my-app',
        dependencies: { 'actual-dep': '*' },
        devDependencies: { jest: '*' }, // unused dev dep
      }
    );
    try {
      const result = scan(tmpDir, { includeDevDeps: false });
      const unusedNames = result.unused.map(u => u.name);
      // jest should NOT appear as unused when dev deps excluded
      assert.ok(!unusedNames.includes('jest'));
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test('scans multiple files', () => {
    const tmpDir = createTempProject(
      {
        'index.js': `const express = require('express');`,
        'utils.js': `const _ = require('lodash');`,
        'src/helper.js': `const axios = require('axios');`,
      },
      {
        name: 'my-app',
        dependencies: { express: '*', lodash: '*', axios: '*' },
      }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.unused.length, 0);
      assert.equal(result.filesScanned, 3);
      assert.equal(result.usedPackages.length, 3);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test('returns correct summary stats', () => {
    const tmpDir = createTempProject(
      {
        'a.js': `require('pkg-a');`,
        'b.js': `require('pkg-b');`,
      },
      {
        name: 'my-app',
        dependencies: { 'pkg-a': '*', 'pkg-b': '*', 'pkg-c': '*' }, // pkg-c unused
      }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.summary.filesScanned, 2);
      assert.equal(result.summary.uniquePackagesUsed, 2);
      assert.equal(result.summary.unusedCount, 1);
      assert.equal(result.summary.missingCount, 0);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});

describe('scan() — edge cases', () => {
  test('handles project with no dependencies', () => {
    const tmpDir = createTempProject(
      { 'index.js': `const fs = require('fs'); // builtin only` },
      { name: 'minimal-app' }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.unused.length, 0);
      assert.equal(result.missing.length, 0);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test('handles project with no source files', () => {
    const tmpDir = createTempProject(
      {},
      { name: 'empty-app', dependencies: { lodash: '*' } }
    );
    try {
      const result = scan(tmpDir);
      assert.equal(result.filesScanned, 0);
      // lodash listed but no files to check against, so it's "unused"
      assert.equal(result.unused.length, 1);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});
