'use strict';

/**
 * ANSI color helpers
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function colorize(text, ...codes) {
  return codes.map(c => colors[c] || '').join('') + text + colors.reset;
}

/**
 * Format the scan results as a human-readable string.
 * @param {object} result - Output from scan()
 * @param {object} options
 * @param {boolean} [options.noColor=false]
 * @param {boolean} [options.verbose=false]
 * @returns {string}
 */
function format(result, options = {}) {
  const { noColor = false, verbose = false } = options;
  const c = (text, ...codes) => noColor ? text : colorize(text, ...codes);

  const lines = [];

  lines.push('');
  lines.push(c('dep-check', 'bold', 'cyan') + c(` — ${result.packageName}`, 'dim'));
  lines.push(c('─'.repeat(50), 'gray'));

  // Summary line
  lines.push(
    `Scanned ${c(String(result.filesScanned), 'bold')} files · ` +
    `${c(String(result.summary.uniquePackagesUsed), 'bold')} packages used`
  );
  lines.push('');

  // Unused dependencies
  if (result.unused.length === 0) {
    lines.push(c('✓ No unused dependencies found', 'green'));
  } else {
    lines.push(c(`✗ ${result.unused.length} unused ${result.unused.length === 1 ? 'dependency' : 'dependencies'}:`, 'red', 'bold'));
    lines.push('');

    // Group by category
    const byCategory = {};
    for (const dep of result.unused) {
      if (!byCategory[dep.category]) byCategory[dep.category] = [];
      byCategory[dep.category].push(dep.name);
    }

    for (const [cat, names] of Object.entries(byCategory)) {
      lines.push(c(`  ${cat}:`, 'yellow'));
      for (const name of names) {
        lines.push(c(`    • ${name}`, 'red'));
      }
    }
  }

  lines.push('');

  // Missing dependencies
  if (result.missing.length === 0) {
    lines.push(c('✓ No missing dependencies found', 'green'));
  } else {
    lines.push(c(`⚠ ${result.missing.length} missing ${result.missing.length === 1 ? 'dependency' : 'dependencies'}:`, 'yellow', 'bold'));
    lines.push(c('  (used in source but not listed in package.json)', 'gray'));
    lines.push('');
    for (const name of result.missing) {
      lines.push(c(`    • ${name}`, 'yellow'));
    }
  }

  // Unused peer dependencies (verbose only)
  if (verbose && result.unusedPeer.length > 0) {
    lines.push('');
    lines.push(c(`ℹ ${result.unusedPeer.length} unused peer ${result.unusedPeer.length === 1 ? 'dependency' : 'dependencies'}:`, 'cyan'));
    for (const name of result.unusedPeer) {
      lines.push(c(`    • ${name}`, 'cyan'));
    }
  }

  // Verbose: list all used packages
  if (verbose && result.usedPackages.length > 0) {
    lines.push('');
    lines.push(c(`ℹ All used packages (${result.usedPackages.length}):`, 'dim'));
    for (const name of result.usedPackages) {
      lines.push(c(`    ${name}`, 'dim'));
    }
  }

  lines.push('');
  lines.push(c('─'.repeat(50), 'gray'));

  // Exit status summary
  const hasIssues = result.unused.length > 0 || result.missing.length > 0;
  if (!hasIssues) {
    lines.push(c('✓ All dependencies look good', 'green', 'bold'));
  } else {
    const parts = [];
    if (result.unused.length > 0) parts.push(`${result.unused.length} unused`);
    if (result.missing.length > 0) parts.push(`${result.missing.length} missing`);
    lines.push(c(`Found: ${parts.join(', ')}`, 'red', 'bold'));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format results as JSON.
 * @param {object} result
 * @returns {string}
 */
function formatJson(result) {
  return JSON.stringify(result, null, 2);
}

/**
 * Format a simple one-line summary (for CI/scripting).
 * @param {object} result
 * @returns {string}
 */
function formatSummary(result) {
  const { unusedCount, missingCount, filesScanned } = result.summary;
  if (unusedCount === 0 && missingCount === 0) {
    return `OK: ${filesScanned} files scanned, all dependencies clean`;
  }
  const parts = [];
  if (unusedCount > 0) parts.push(`${unusedCount} unused`);
  if (missingCount > 0) parts.push(`${missingCount} missing`);
  return `WARN: ${filesScanned} files scanned, ${parts.join(', ')}`;
}

module.exports = { format, formatJson, formatSummary };
