'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'dep-check.js');

function runCli(args = [], cwd = process.cwd()) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

function createTempProject(files, pkgJson) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-check-cli-test-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

describe('CLI — basic functionality', () => {
  test('--help shows usage', () => {
    const result = runCli(['--help']);
    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('dep-check'));
    assert.ok(result.stdout.includes('USAGE'));
    assert.ok(result.stdout.includes('OPTIONS'));
  });

  test('-h shows help', () => {
    const result = runCli(['-h']);
    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('USAGE'));
  });

  test('--version shows version', () => {
    const result = runCli(['--version']);
    assert.equal(result.code, 0);
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  test('-v shows version', () => {
    const result = runCli(['-v']);
    assert.equal(result.code, 0);
    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
  });
});

describe('CLI — exit codes', () => {
  test('exits 0 when no issues', () => {
    const dir = createTempProject(
      { 'index.js': `require('express');` },
      { name: 'ok-proj', dependencies: { express: '*' } }
    );
    try {
      const result = runCli([dir, '--no-color']);
      assert.equal(result.code, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits 1 when unused deps found', () => {
    const dir = createTempProject(
      { 'index.js': `require('express');` },
      { name: 'issues-proj', dependencies: { express: '*', lodash: '*' } }
    );
    try {
      const result = runCli([dir, '--no-color']);
      assert.equal(result.code, 1);
      assert.ok(result.stdout.includes('lodash'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits 2 for missing package.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-check-nopkg-'));
    try {
      const result = runCli([dir]);
      assert.equal(result.code, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits 2 for unknown option', () => {
    const result = runCli(['--unknown-option']);
    assert.equal(result.code, 2);
  });
});

describe('CLI — output modes', () => {
  test('--json outputs valid JSON', () => {
    const dir = createTempProject(
      { 'index.js': `require('express');` },
      { name: 'json-proj', dependencies: { express: '*' } }
    );
    try {
      const result = runCli([dir, '--json']);
      assert.equal(result.code, 0);
      const parsed = JSON.parse(result.stdout);
      assert.ok('unused' in parsed);
      assert.ok('missing' in parsed);
      assert.ok('summary' in parsed);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--summary outputs one line', () => {
    const dir = createTempProject(
      { 'index.js': `require('express');` },
      { name: 'summary-proj', dependencies: { express: '*' } }
    );
    try {
      const result = runCli([dir, '--summary']);
      assert.equal(result.code, 0);
      const lines = result.stdout.trim().split('\n');
      assert.equal(lines.length, 1);
      assert.ok(result.stdout.includes('OK:'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--no-color removes ANSI codes', () => {
    const dir = createTempProject(
      { 'index.js': `require('express');` },
      { name: 'nocolor-proj', dependencies: { express: '*' } }
    );
    try {
      const result = runCli([dir, '--no-color']);
      assert.ok(!result.stdout.includes('\x1b['));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('CLI — directory argument', () => {
  test('scans specified directory', () => {
    const dir = createTempProject(
      { 'index.js': `require('express');` },
      { name: 'dir-proj', dependencies: { express: '*' } }
    );
    try {
      // Run from a different directory, pass target as arg
      const result = runCli([dir, '--summary']);
      assert.equal(result.code, 0);
      assert.ok(result.stdout.includes('OK:'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
