#!/usr/bin/env node
'use strict';

const path = require('path');
const { scan } = require('../src/scanner');
const { format, formatJson, formatSummary } = require('../src/reporter');

const VERSION = '1.0.0';

const HELP = `
dep-check — Find unused and missing dependencies in your Node.js project

USAGE
  dep-check [directory] [options]

ARGUMENTS
  directory     Project root to check (default: current directory)

OPTIONS
  --json          Output results as JSON
  --summary       Output one-line summary (ideal for CI)
  --no-dev        Skip devDependencies (only check dependencies)
  --verbose       Show all used packages and peer dependency info
  --no-color      Disable colored output
  --version, -v   Show version
  --help, -h      Show this help

EXAMPLES
  dep-check                     Check current directory
  dep-check ./my-app            Check a specific project
  dep-check --json              Machine-readable JSON output
  dep-check --no-dev            Only check production dependencies
  dep-check --summary           One-line result (good for CI scripts)

EXIT CODES
  0   No issues found
  1   Issues found (unused or missing dependencies)
  2   Error (package.json not found, invalid arguments)
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    directory: null,
    json: false,
    summary: false,
    noDev: false,
    verbose: false,
    noColor: false,
    help: false,
    version: false,
  };

  for (const arg of args) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--summary') opts.summary = true;
    else if (arg === '--no-dev') opts.noDev = true;
    else if (arg === '--verbose') opts.verbose = true;
    else if (arg === '--no-color') opts.noColor = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--version' || arg === '-v') opts.version = true;
    else if (!arg.startsWith('-')) {
      opts.directory = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      console.error('Run dep-check --help for usage');
      process.exit(2);
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (opts.version) {
    console.log(VERSION);
    process.exit(0);
  }

  const projectRoot = opts.directory
    ? path.resolve(opts.directory)
    : process.cwd();

  let result;
  try {
    result = scan(projectRoot, {
      includeDevDeps: !opts.noDev,
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  if (opts.json) {
    console.log(formatJson(result));
  } else if (opts.summary) {
    console.log(formatSummary(result));
  } else {
    process.stdout.write(format(result, {
      noColor: opts.noColor,
      verbose: opts.verbose,
    }));
  }

  const hasIssues = result.unused.length > 0 || result.missing.length > 0;
  process.exit(hasIssues ? 1 : 0);
}

main();
