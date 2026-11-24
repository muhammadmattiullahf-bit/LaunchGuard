# LaunchGuard

> **Know what's wrong before you deploy.**
> Local-first, open-source static audit tool for Next.js projects.

---

## Overview

LaunchGuard statically inspects Next.js projects for production-readiness defects before deployment. It checks SEO metadata, security configurations, hardcoded secrets, code quality safeguards, deployment readiness, static asset performance, and dependency hygiene.

### Foundational Principles

- **Local-first (P-01):** Runs entirely on your machine. Zero outbound network activity in default audits. No cloud accounts, subscriptions, or telemetry.
- **Never execute the target (P-02, LG-SEC-001, LG-SEC-002):** Analyzes target files as untrusted data. Never runs package-manager hooks, build scripts, development servers, or evaluates executable project files like `next.config.*`.
- **Explain everything (P-03):** Every finding clearly explains what was detected, where it is located, why it matters, its severity and confidence, concrete remediation steps, and rule documentation links.
- **Honest about uncertainty (P-04, P-05):** Transparent confidence ratings (`high`, `medium`, `low`). The Readiness Score is an informational heuristic, never a security certification.
- **Deterministic (P-06):** Identical inputs produce byte-identical findings and sorting order.
- **Secret Redaction (LG-FR-018, LG-SEC-007):** Strict pre-emission redaction guarantees that raw secret tokens are never leaked into terminal output, JSON reports, SARIF exports, or logs.

---

## Installation & Usage

### Running Locally

```bash
# Audit current directory (terminal report)
node bin/launchguard.js scan .

# Run specific categories
node bin/launchguard.js scan . --only seo,security

# Fail CI pipeline on high or critical issues
node bin/launchguard.js scan . --fail-on high

# Export JSON or OASIS SARIF v2.1.0 report
node bin/launchguard.js scan . --format json --output report.json
node bin/launchguard.js scan . --format sarif --output results.sarif

# List registered rules
node bin/launchguard.js rules list

# Initialize starter configuration
node bin/launchguard.js init
```

---

## CLI Commands and Exit Codes

### Commands

| Command | Description |
|---|---|
| `scan [path]` | Runs static audit against target Next.js directory (default: current directory). |
| `rules list` | Displays all registered audit rules with metadata and documentation URLs. |
| `init [path]` | Generates starter `.launchguardrc.json` configuration file (`--force` to overwrite). |
| `--help` | Displays command line usage and flag options. |
| `--version` | Displays tool version and build information. |

### Exit Status

| Code | Meaning |
|---|---|
| `0` | Scan completed successfully; no finding meets or exceeds the `--fail-on` threshold. |
| `1` | Scan completed; at least one active, non-suppressed finding breached `--fail-on`. |
| `2` | Usage, configuration, or project discovery error (e.g., target is not a Next.js project). |
| `3` | Scan incomplete due to rule timeouts or isolated faults, and no failure threshold was breached. |
| `4` | Unexpected internal fatal error. |
| `130` | Scan cancelled by user interrupt (`SIGINT`). |

---

## Audit Modules and Rules (MVP)

### 1. SEO (`seo`)
- `seo/title-missing` (`LG-SEO-R001`): Missing title metadata in page or root layout.
- `seo/robots-missing` (`LG-SEO-R005`): Missing `robots.txt` or App Router metadata route.
- `seo/sitemap-missing` (`LG-SEO-R007`): Missing `sitemap.xml` or App Router metadata route.
- `seo/site-wide-noindex` (`LG-SEO-R006`): Root layout or robots config sets `index: false` or `Disallow: /`.

### 2. Security (`security`)
- `security/env-not-ignored` (`LG-SEC-R001`): `.env*` files present without matching `.gitignore` patterns.
- `security/secret-token-leak` (`LG-SEC-R002`): Detected API keys, private keys, or tokens in source files (always masked/redacted in reports).
- `security/public-env-leak` (`LG-SEC-R003`): Secret-like identifier exposed with `NEXT_PUBLIC_` client prefix.
- `security/source-maps-enabled` (`LG-SEC-R005`): Browser source maps enabled for production in `next.config.*`.
- `security/powered-by-header` (`LG-SEC-R006`): `poweredByHeader: false` omitted in `next.config.*`.

### 3. Code Quality (`code-quality`)
- `code-quality/typescript-config-missing` (`LG-COD-R001`): Missing `tsconfig.json` in project containing TypeScript files.
- `code-quality/typescript-strict-disabled` (`LG-COD-R002`): TypeScript strict mode (`"strict": true`) disabled.
- `code-quality/eslint-config-missing` (`LG-COD-R003`): Missing ESLint configuration file.
- `code-quality/build-script-missing` (`LG-COD-R004`): Missing `"build"` script in `package.json`.
- `code-quality/build-error-suppression` (`LG-COD-R006`): `ignoreBuildErrors: true` or `ignoreDuringBuilds: true` configured in `next.config.*`.
- `code-quality/node-version-missing` (`LG-COD-R007`): No Node.js runtime constraint specified in `package.json` engines or `.nvmrc`.

### 4. Deployment Readiness (`deployment`)
- `deployment/env-template-missing` (`LG-DPL-R001`): Local `.env` files exist without a corresponding `.env.example` template.
- `deployment/start-script-missing` (`LG-DPL-R003`): Missing `"start"` script in `package.json`.

### 5. Static Performance (`performance`)
- `performance/large-static-asset` (`LG-PRF-R001`): Static asset in `public/` exceeding 500KB (reported strictly as a static indicator, never claiming measured runtime performance).

### 6. Dependency Hygiene (`dependencies`)
- `dependencies/lockfile-missing` (`LG-DEP-R001`): Missing lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`).
- `dependencies/multiple-lockfiles` (`LG-DEP-R002`): Conflicting lockfiles detected from multiple package managers.
- `dependencies/wildcard-version-range` (`LG-DEP-R003`): Wildcard `*` or `latest` version range declared in dependencies.

---

## Architecture

```
LaunchGuard Architecture:
├── CLI (src/cli/)
│   ├── Argument parsing (zero external dependencies)
│   ├── Output formatting (Terminal, JSON, OASIS SARIF v2.1.0)
│   └── Exit code management
├── Core Engine (src/core/)
│   ├── Project Discovery: Next.js validation, router detection (app/pages)
│   ├── Safe File Discovery: canonical containment, symlink escape checks, size limits
│   ├── Data-Only Config Loader: strict JSON schema validation, no JS execution
│   ├── Rule Registry: extensible registry with metadata validation
│   ├── Scan Orchestrator: per-rule fault isolation, timeouts, AbortController
│   ├── Finding Collector: deterministic SHA-256 fingerprinting, suppression, dedup
│   ├── Readiness Scoring: transparent penalty formula with diminishing returns
│   └── Secret Redactor: pre-emission masking for tokens, passwords, and private keys
└── Rules (src/rules/)
    └── Modular audit rules across 6 MVP categories
```

---

## Testing

LaunchGuard includes an extensive test suite verifying functionality against valid and adversarial conditions:

```bash
# Run complete test suite
npm test
```

Tests cover:
- Project discovery and Next.js detection
- Safe file discovery, path containment, and symlink protection
- Configuration loading, schema validation, and `.launchguardrc.json` initialization
- Secret redaction across all output formats
- Readiness score calculation and diminishing returns cap
- Terminal, JSON, and SARIF report generation
- Full CLI execution and exit codes

---

## License

Apache-2.0. See [DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md](file:///c:/Users/AL%20MADINA%20COMPUTER/Desktop/LaunchGuard/DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md) for full project requirements and specifications.
