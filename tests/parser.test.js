'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseContent, isBuiltin, isLocalPath, extractPackageName } = require('../src/parser');

describe('isBuiltin()', () => {
  test('identifies core Node.js modules', () => {
    assert.equal(isBuiltin('fs'), true);
    assert.equal(isBuiltin('path'), true);
    assert.equal(isBuiltin('os'), true);
    assert.equal(isBuiltin('crypto'), true);
    assert.equal(isBuiltin('http'), true);
    assert.equal(isBuiltin('https'), true);
    assert.equal(isBuiltin('stream'), true);
    assert.equal(isBuiltin('events'), true);
    assert.equal(isBuiltin('child_process'), true);
    assert.equal(isBuiltin('util'), true);
    assert.equal(isBuiltin('url'), true);
    assert.equal(isBuiltin('buffer'), true);
    assert.equal(isBuiltin('assert'), true);
  });

  test('handles node: prefix', () => {
    assert.equal(isBuiltin('node:fs'), true);
    assert.equal(isBuiltin('node:path'), true);
    assert.equal(isBuiltin('node:stream'), true);
    assert.equal(isBuiltin('node:stream/promises'), true);
  });

  test('handles sub-path builtins', () => {
    assert.equal(isBuiltin('fs/promises'), true);
    assert.equal(isBuiltin('stream/consumers'), true);
    assert.equal(isBuiltin('timers/promises'), true);
  });

  test('returns false for npm packages', () => {
    assert.equal(isBuiltin('lodash'), false);
    assert.equal(isBuiltin('express'), false);
    assert.equal(isBuiltin('react'), false);
    assert.equal(isBuiltin('axios'), false);
  });
});

describe('isLocalPath()', () => {
  test('identifies relative paths', () => {
    assert.equal(isLocalPath('./utils'), true);
    assert.equal(isLocalPath('../config'), true);
    assert.equal(isLocalPath('./foo/bar'), true);
  });

  test('identifies absolute paths', () => {
    assert.equal(isLocalPath('/usr/local/lib'), true);
    assert.equal(isLocalPath('/absolute/path'), true);
  });

  test('returns false for package names', () => {
    assert.equal(isLocalPath('lodash'), false);
    assert.equal(isLocalPath('@scope/pkg'), false);
  });
});

describe('extractPackageName()', () => {
  test('extracts simple package name', () => {
    assert.equal(extractPackageName('lodash'), 'lodash');
    assert.equal(extractPackageName('express'), 'express');
  });

  test('extracts root from sub-path imports', () => {
    assert.equal(extractPackageName('lodash/fp'), 'lodash');
    assert.equal(extractPackageName('lodash/merge'), 'lodash');
    assert.equal(extractPackageName('rxjs/operators'), 'rxjs');
  });

  test('handles scoped packages', () => {
    assert.equal(extractPackageName('@scope/package'), '@scope/package');
    assert.equal(extractPackageName('@babel/core'), '@babel/core');
    assert.equal(extractPackageName('@types/node'), '@types/node');
  });

  test('extracts scoped root from sub-path', () => {
    assert.equal(extractPackageName('@scope/package/sub'), '@scope/package');
    assert.equal(extractPackageName('@babel/core/lib/index'), '@babel/core');
  });
});

describe('parseContent()', () => {
  test('parses CommonJS require()', () => {
    const content = `
      const fs = require('fs');
      const lodash = require('lodash');
      const express = require('express');
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('lodash'), true);
    assert.equal(packages.has('express'), true);
    // Built-ins not included
    assert.equal(packages.has('fs'), false);
  });

  test('parses ES module imports', () => {
    const content = `
      import React from 'react';
      import { useState } from 'react';
      import path from 'path';
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('react'), true);
    assert.equal(packages.has('path'), false); // builtin
  });

  test('parses dynamic imports', () => {
    const content = `
      const mod = await import('some-module');
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('some-module'), true);
  });

  test('parses re-exports', () => {
    const content = `
      export { foo } from 'some-lib';
      export * from 'other-lib';
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('some-lib'), true);
    assert.equal(packages.has('other-lib'), true);
  });

  test('parses require.resolve()', () => {
    const content = `
      const resolved = require.resolve('some-tool');
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('some-tool'), true);
  });

  test('excludes local paths', () => {
    const content = `
      const local = require('./utils');
      const parent = require('../config');
      const pkg = require('real-package');
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('./utils'), false);
    assert.equal(packages.has('../config'), false);
    assert.equal(packages.has('real-package'), true);
  });

  test('deduplicates packages', () => {
    const content = `
      const a = require('lodash');
      const b = require('lodash');
      import _ from 'lodash';
    `;
    const packages = parseContent(content);
    // Should be a Set with lodash appearing once
    assert.equal(packages.has('lodash'), true);
    assert.equal(packages.size, 1);
  });

  test('handles sub-path imports correctly', () => {
    const content = `
      const merge = require('lodash/merge');
      import { tap } from 'rxjs/operators';
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('lodash'), true);
    assert.equal(packages.has('rxjs'), true);
    assert.equal(packages.has('lodash/merge'), false);
  });

  test('handles double and single quotes', () => {
    const content = `
      const a = require("double-quote-pkg");
      const b = require('single-quote-pkg');
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('double-quote-pkg'), true);
    assert.equal(packages.has('single-quote-pkg'), true);
  });

  test('handles scoped package imports', () => {
    const content = `
      import { render } from '@testing-library/react';
      const core = require('@babel/core');
    `;
    const packages = parseContent(content);
    assert.equal(packages.has('@testing-library/react'), true);
    assert.equal(packages.has('@babel/core'), true);
  });

  test('returns empty set for content with no external imports', () => {
    const content = `
      const fs = require('fs');
      const path = require('path');
      const local = require('./utils');
    `;
    const packages = parseContent(content);
    assert.equal(packages.size, 0);
  });

  test('handles empty/whitespace content', () => {
    const packages = parseContent('');
    assert.equal(packages.size, 0);

    const packages2 = parseContent('   \n\n  ');
    assert.equal(packages2.size, 0);
  });

  test('handles comments with require-like patterns', () => {
    // Comments won't be caught differently — regex-based
    // But ensure the basic case works
    const content = `
      // const commented = require('commented-out');
      const real = require('real-package');
    `;
    const packages = parseContent(content);
    // regex will catch both — this is acceptable behavior for static analysis
    assert.equal(packages.has('real-package'), true);
  });
});
