# dep-check

> **Find unused and missing dependencies in your Node.js project.**
> Zero dependencies. Drop-in replacement for the abandoned [depcheck](https://github.com/depcheck/depcheck) (archived June 2025).

[![npm version](https://img.shields.io/npm/v/dep-check.svg)](https://www.npmjs.com/package/dep-check)
[![npm downloads](https://img.shields.io/npm/dw/dep-check.svg)](https://www.npmjs.com/package/dep-check)
[![license](https://img.shields.io/npm/l/dep-check.svg)](./LICENSE)

---

## The Problem

`depcheck` — the widely-used unused dependency checker — was **archived by its maintainers in June 2025**. It has 1.4M+ weekly downloads and no maintained successor for simple projects.

`knip` is the current leader but is TypeScript-heavy, monorepo-focused, and complex to configure.

`dep-check` fills the gap: a **pure Node.js, zero-dependency** tool that does exactly one thing — find the unused and missing packages in your project.

---

## Install

```bash
# Use immediately without installing
npx dep-check

# Install globally
npm install -g dep-check

# Add as dev dependency
npm install --save-dev dep-check
```

---

## Quick Start

```bash
# Check your current project
dep-check

# Check a specific directory
dep-check ./my-app

# Get machine-readable output
dep-check --json

# One-line summary for CI
dep-check --summary
```

### Example output

```
dep-check — my-app
──────────────────────────────────────────────────
Scanned 47 files · 12 packages used

✗ 2 unused dependencies:

  dependencies:
    • moment
    • request

⚠ 1 missing dependency:
  (used in source but not listed in package.json)

    • axios

──────────────────────────────────────────────────
Found: 2 unused, 1 missing
```

---

## Options

```
dep-check [directory] [options]

Arguments:
  directory     Project root to check (default: current directory)

Options:
  --json          Output results as JSON
  --summary       One-line summary (ideal for CI)
  --no-dev        Skip devDependencies (only check dependencies)
  --verbose       Show all used packages and peer dependency info
  --no-color      Disable colored output
  --version, -v   Show version
  --help, -h      Show help
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No issues found |
| `1` | Issues found (unused or missing dependencies) |
| `2` | Error (package.json not found, invalid arguments) |

Exit code `1` on issues makes `dep-check` suitable for CI pipelines.

---

## CI Integration

### GitHub Actions

```yaml
- name: Check dependencies
  run: npx dep-check --summary
```

### npm scripts

```json
{
  "scripts": {
    "check-deps": "dep-check",
    "check-deps:ci": "dep-check --summary"
  }
}
```

### Pre-commit hook

```bash
#!/bin/sh
dep-check --summary || exit 1
```

---

## API

Use `dep-check` programmatically in your own tooling:

```javascript
const { scan, format, formatJson, formatSummary } = require('dep-check');

const result = scan('/path/to/project');

console.log(result.unused);   // [{ name: 'lodash', category: 'dependencies' }, ...]
console.log(result.missing);  // ['axios', ...]
console.log(result.summary);  // { filesScanned: 47, unusedCount: 2, missingCount: 1, ... }

// Format for display
console.log(format(result));                  // Human-readable report
console.log(formatJson(result));              // JSON string
console.log(formatSummary(result));           // One-line summary
```

### `scan(projectRoot, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeDevDeps` | boolean | `true` | Include devDependencies in unused check |
| `skipDirs` | string[] | `[]` | Additional directory names to skip |

Returns:

```typescript
{
  projectRoot: string;
  packageName: string;
  filesScanned: number;
  usedPackages: string[];
  unused: Array<{ name: string; category: string }>;
  missing: string[];
  unusedPeer: string[];
  summary: {
    filesScanned: number;
    uniquePackagesUsed: number;
    unusedCount: number;
    missingCount: number;
  };
}
```

---

## How It Works

`dep-check` performs **static analysis** of your source files:

1. Reads `package.json` to collect all declared dependencies
2. Recursively scans source files (`.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.mts`, `.cts`)
3. Extracts all `require()`, `import`, `export ... from`, `import()`, and `require.resolve()` calls
4. Strips built-in Node.js modules and relative paths
5. Compares used packages against declared dependencies
6. Reports: **unused** (declared but not imported) and **missing** (imported but not declared)

**Skipped directories** (always): `node_modules`, `.git`, `dist`, `build`, `coverage`, `out`

**Limitations of static analysis:**
- Dynamic requires using variables (`require(someVar)`) cannot be detected
- Packages loaded via plugins or configuration (webpack loaders, etc.) may appear as "missing"
- Use `--no-dev` if your test framework appears as "missing" when it shouldn't

---

## Zero Dependencies

`dep-check` uses only Node.js built-in modules:
- `fs` — reading files and directories
- `path` — path manipulation
- `os` — temp directory access (tests only)
- `child_process` — CLI tests only

No npm install beyond `dep-check` itself.

---

## Testing

```bash
npm test
# 69 tests, 0 failures
```

---

## vs depcheck

| Feature | dep-check | depcheck (archived) |
|---------|-----------|---------------------|
| Maintained | ✓ Active | ✗ Archived Jun 2025 |
| Dependencies | 0 | 30+ |
| Node.js support | ≥16 | ≥10 |
| CLI | ✓ | ✓ |
| Programmatic API | ✓ | ✓ |
| JSON output | ✓ | ✓ |
| Missing deps check | ✓ | ✓ |
| TypeScript files | ✓ | ✓ |
| ESM imports | ✓ | Partial |

---

## Support the Project

`dep-check` is part of the [AXIOM experiment](https://axiom-experiment.github.io) — an autonomous AI agent building a zero-to-revenue business from scratch.

- ⭐ [Star on GitHub](https://github.com/axiom-experiment/dep-check)
- 💖 [Sponsor the experiment](https://github.com/sponsors/axiom-experiment)

---

## License

MIT © [Yonder Zenith LLC](https://github.com/axiom-experiment)
