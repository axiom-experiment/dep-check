'use strict';

/**
 * Extract module names from source file content.
 * Handles: require(), import ... from, import(), export ... from, require.resolve()
 */

// Patterns for detecting module usage
const REQUIRE_PATTERNS = [
  // require('module') or require("module")
  /\brequire\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)/g,
  // require.resolve('module')
  /\brequire\.resolve\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)/g,
];

const IMPORT_PATTERNS = [
  // import ... from 'module'
  /\bimport\b[^'"`]*from\s*['"`]([^'"`\s]+)['"`]/g,
  // import('module') - dynamic imports
  /\bimport\s*\(\s*['"`]([^'"`\s]+)['"`]\s*\)/g,
  // export ... from 'module'
  /\bexport\b[^'"`]*from\s*['"`]([^'"`\s]+)['"`]/g,
];

/**
 * Check if a module specifier is a built-in Node.js module.
 * @param {string} name
 * @returns {boolean}
 */
function isBuiltin(name) {
  const builtins = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
    'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
    'dns', 'domain', 'events', 'fs', 'fs/promises', 'http', 'http2',
    'https', 'inspector', 'module', 'net', 'os', 'path', 'path/posix',
    'path/win32', 'perf_hooks', 'process', 'punycode', 'querystring',
    'readline', 'repl', 'stream', 'stream/consumers', 'stream/promises',
    'stream/web', 'string_decoder', 'sys', 'timers', 'timers/promises',
    'tls', 'trace_events', 'tty', 'url', 'util', 'util/types', 'v8',
    'vm', 'wasi', 'worker_threads', 'zlib',
  ]);
  // Strip leading 'node:' prefix
  const stripped = name.startsWith('node:') ? name.slice(5) : name;
  // For paths like 'fs/promises', check root
  const root = stripped.split('/')[0];
  return builtins.has(stripped) || builtins.has(root);
}

/**
 * Check if a specifier is a relative or absolute path (not a package).
 * @param {string} name
 * @returns {boolean}
 */
function isLocalPath(name) {
  return name.startsWith('.') || name.startsWith('/');
}

/**
 * Extract the root package name from a module specifier.
 * 'lodash/fp' -> 'lodash'
 * '@scope/package/sub' -> '@scope/package'
 * 'package' -> 'package'
 * @param {string} specifier
 * @returns {string}
 */
function extractPackageName(specifier) {
  if (specifier.startsWith('@')) {
    // Scoped package: take first two parts
    const parts = specifier.split('/');
    return parts.slice(0, 2).join('/');
  }
  // Regular package: take first part
  return specifier.split('/')[0];
}

/**
 * Parse all module specifiers used in a file's content.
 * @param {string} content - Source file content
 * @returns {Set<string>} Set of package names used
 */
function parseContent(content) {
  const packages = new Set();
  const allPatterns = [...REQUIRE_PATTERNS, ...IMPORT_PATTERNS];

  for (const pattern of allPatterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const specifier = match[1];
      if (!isLocalPath(specifier) && !isBuiltin(specifier)) {
        packages.add(extractPackageName(specifier));
      }
    }
  }

  return packages;
}

module.exports = { parseContent, isBuiltin, isLocalPath, extractPackageName };
