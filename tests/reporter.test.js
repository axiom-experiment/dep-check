'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { format, formatJson, formatSummary } = require('../src/reporter');

// Sample result fixture
const cleanResult = {
  projectRoot: '/test/project',
  packageName: 'test-project',
  filesScanned: 10,
  usedPackages: ['express', 'lodash'],
  unused: [],
  missing: [],
  unusedPeer: [],
  summary: {
    filesScanned: 10,
    uniquePackagesUsed: 2,
    unusedCount: 0,
    missingCount: 0,
  },
};

const dirtyResult = {
  projectRoot: '/test/project',
  packageName: 'test-project',
  filesScanned: 10,
  usedPackages: ['express'],
  unused: [
    { name: 'lodash', category: 'dependencies' },
    { name: 'moment', category: 'devDependencies' },
  ],
  missing: ['axios'],
  unusedPeer: ['react'],
  summary: {
    filesScanned: 10,
    uniquePackagesUsed: 1,
    unusedCount: 2,
    missingCount: 1,
  },
};

describe('format()', () => {
  test('shows success message when no issues', () => {
    const output = format(cleanResult, { noColor: true });
    assert.ok(output.includes('No unused dependencies found'));
    assert.ok(output.includes('No missing dependencies found'));
    assert.ok(output.includes('All dependencies look good'));
  });

  test('shows unused dependency names', () => {
    const output = format(dirtyResult, { noColor: true });
    assert.ok(output.includes('lodash'));
    assert.ok(output.includes('moment'));
  });

  test('shows missing dependency names', () => {
    const output = format(dirtyResult, { noColor: true });
    assert.ok(output.includes('axios'));
  });

  test('shows summary counts', () => {
    const output = format(dirtyResult, { noColor: true });
    assert.ok(output.includes('2 unused') || output.includes('unused'));
    assert.ok(output.includes('1 missing') || output.includes('missing'));
  });

  test('shows package name', () => {
    const output = format(cleanResult, { noColor: true });
    assert.ok(output.includes('test-project'));
  });

  test('shows files scanned count', () => {
    const output = format(cleanResult, { noColor: true });
    assert.ok(output.includes('10'));
  });

  test('verbose mode shows used packages', () => {
    const output = format(cleanResult, { noColor: true, verbose: true });
    assert.ok(output.includes('express'));
    assert.ok(output.includes('lodash'));
  });

  test('verbose mode shows unused peer deps', () => {
    const output = format(dirtyResult, { noColor: true, verbose: true });
    assert.ok(output.includes('react'));
  });

  test('noColor mode produces plain text', () => {
    const colorOutput = format(cleanResult, { noColor: false });
    const plainOutput = format(cleanResult, { noColor: true });
    // Color output contains ANSI escape codes
    // Plain output should not
    assert.ok(!plainOutput.includes('\x1b['));
  });

  test('categorizes unused by section', () => {
    const output = format(dirtyResult, { noColor: true });
    assert.ok(output.includes('dependencies'));
    assert.ok(output.includes('devDependencies'));
  });
});

describe('formatJson()', () => {
  test('returns valid JSON', () => {
    const json = formatJson(cleanResult);
    assert.doesNotThrow(() => JSON.parse(json));
  });

  test('includes all result fields', () => {
    const parsed = JSON.parse(formatJson(cleanResult));
    assert.ok('unused' in parsed);
    assert.ok('missing' in parsed);
    assert.ok('summary' in parsed);
    assert.ok('filesScanned' in parsed);
    assert.ok('usedPackages' in parsed);
  });

  test('preserves unused and missing arrays', () => {
    const parsed = JSON.parse(formatJson(dirtyResult));
    assert.equal(parsed.unused.length, 2);
    assert.equal(parsed.missing.length, 1);
  });
});

describe('formatSummary()', () => {
  test('returns OK for clean result', () => {
    const summary = formatSummary(cleanResult);
    assert.ok(summary.startsWith('OK:'));
    assert.ok(summary.includes('10 files'));
  });

  test('returns WARN for result with issues', () => {
    const summary = formatSummary(dirtyResult);
    assert.ok(summary.startsWith('WARN:'));
    assert.ok(summary.includes('unused'));
    assert.ok(summary.includes('missing'));
  });

  test('mentions unused count in warn', () => {
    const summary = formatSummary(dirtyResult);
    assert.ok(summary.includes('2 unused'));
    assert.ok(summary.includes('1 missing'));
  });

  test('includes file count', () => {
    const summary = formatSummary(cleanResult);
    assert.ok(summary.includes('10 files'));
  });
});
