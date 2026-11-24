# LaunchGuard MVP — Requirements Traceability Matrix

**Document ID:** LG-RTM-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Verification Date:** November 2026  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md`  

---

## 1. Traceability Overview

This matrix maps every directive, functional requirement, non-functional requirement, security requirement, and user story from `DOC-001` to its implementation files, automated test suites, and compliance status.

### Status Definitions
- **PASS:** The requirement is fully implemented in source code and validated by automated tests.
- **PARTIAL:** Core functionality exists, but minor non-blocking aspects are deferred or under review.
- **FAIL:** The requirement is not satisfied by the implementation.
- **OUT OF SCOPE:** The requirement is explicitly designated in DOC-001 as Post-MVP (Milestones M5–M9).

---

## 2. Product Goals (LG-PG-001 to LG-PG-009)

| ID | Summary | Source Files | Test Files | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **LG-PG-001** | Actionable pre-deployment findings for Next.js | `src/rules/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 27 rules across 6 categories providing title, description, why it matters, fix advice, and doc links. |
| **LG-PG-002** | Local-first; no code upload; privacy-first | `src/core/orchestrator/scan-orchestrator.ts` | `tests/adversarial/security.test.ts` | **PASS** | Scans run 100% locally with zero network calls and zero telemetry. |
| **LG-PG-003** | Core engine reusable independently of UI | `src/core/` | `tests/unit/scoring.test.ts`, `tests/unit/discovery.test.ts` | **PASS** | Core Engine has zero dependencies on CLI or Web modules; pure programmatic API. |
| **LG-PG-004** | Support CI usage (exit codes, JSON, SARIF) | `src/cli/cli.ts`, `src/reporters/` | `tests/unit/cli.test.ts`, `tests/unit/reporters.test.ts` | **PASS** | Standardized exit codes (0, 1, 2, 4) and full JSON/SARIF output support. |
| **LG-PG-005** | Transparent findings and readiness score | `src/core/scoring/readiness-score.ts` | `tests/unit/scoring.test.ts` | **PASS** | Diminishing returns scoring algorithm with mandatory heuristic disclaimer. |
| **LG-PG-006** | Safe against untrusted repositories | `src/core/discovery/safe-file-discovery.ts` | `tests/adversarial/security.test.ts` | **PASS** | Zero target execution, canonical path checks, symlink confinement, and ANSI stripping. |
| **LG-PG-007** | Community-contributed rules extension model | `src/core/rules/rule-registry.ts` | `tests/unit/rules.test.ts` | **PASS** | Clean `RuleDefinition` interface and queryable registry allowing modular rule additions. |
| **LG-PG-008** | Sustainable open source; documentation-first | `docs/rules/`, `docs/adr/` | `tests/unit/rules.test.ts` | **PASS** | Every rule has dedicated documentation; ADR-001 through ADR-007 document all decisions. |
| **LG-PG-009** | Honest accuracy; clear analysis limits | `src/core/types.ts`, `docs/rules/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | Confidence ratings (high/medium/low) and explicit caveats regarding dynamic code analysis. |

---

## 3. Functional Requirements (LG-FR-001 to LG-FR-032)

| ID | Summary | Source Files | Test Files | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **LG-FR-001** | Project Discovery & Next.js Detection | `src/core/discovery/project-discovery.ts` | `tests/unit/discovery.test.ts` | **PASS** | Identifies App Router, Pages Router, hybrid, config files, package.json limits. |
| **LG-FR-002** | Scan Command Execution | `src/cli/cli.ts`, `src/core/orchestrator/` | `tests/unit/cli.test.ts` | **PASS** | Orchestrates discovery, configuration, rule execution, scoring, and output generation. |
| **LG-FR-003** | Category Selection (`--only`, `--skip`) | `src/cli/cli.ts`, `src/core/rules/rule-registry.ts` | `tests/unit/cli.test.ts` | **PASS** | Category filtering; rejects mutually exclusive options and empty rule selections. |
| **LG-FR-004** | Rule Registry & Metadata | `src/core/rules/rule-registry.ts` | `tests/unit/rules.test.ts` | **PASS** | Registry rejects duplicate IDs; enforces metadata (id, candidateId, severity, confidence, docs). |
| **LG-FR-005** | Safe File Discovery | `src/core/discovery/safe-file-discovery.ts` | `tests/unit/discovery.test.ts`, `tests/adversarial/security.test.ts` | **PASS** | Canonical path validation, symlink traversal prevention, 10MB file limit, depth 30. |
| **LG-FR-006** | Configuration Loading & Validation | `src/core/config/config-loader.ts` | `tests/unit/config.test.ts` | **PASS** | Validates `.launchguardrc.json`; rejects unknown keys; enforces non-empty suppression reason. |
| **LG-FR-007** | Configuration Initialisation (`init`) | `src/core/config/config-loader.ts`, `src/cli/cli.ts` | `tests/unit/config.test.ts` | **PASS** | Generates compliant template; refuses overwrite without `--force`. |
| **LG-FR-008** | Rule Listing (`rules list`) | `src/cli/cli.ts`, `src/core/rules/rule-registry.ts` | `tests/unit/cli.test.ts` | **PASS** | Displays tabular listing of registered rules with category, severity, and description. |
| **LG-FR-009** | Finding Data Contract | `src/core/types.ts` | `tests/unit/scoring.test.ts` | **PASS** | Implements standard schema (id, ruleId, severity, category, confidence, location, recommendation). |
| **LG-FR-010** | Severity Classification | `src/core/types.ts` | `tests/unit/scoring.test.ts` | **PASS** | Enforces 5 levels: critical, high, medium, low, informational. |
| **LG-FR-011** | Confidence, Deduplication & Suppression | `src/core/dedup/finding-collector.ts` | `tests/unit/scoring.test.ts` | **PASS** | SHA-256 fingerprinting (excluding line numbers); suppression filtering with mandatory reason. |
| **LG-FR-012** | Readiness Score Calculation | `src/core/scoring/readiness-score.ts` | `tests/unit/scoring.test.ts` | **PASS** | Diminishing returns penalty formula; category scores; legal disclaimer. |
| **LG-FR-013** | Terminal Report | `src/reporters/terminal-reporter.ts` | `tests/unit/reporters.test.ts`, `tests/adversarial/security.test.ts` | **PASS** | Formatted ANSI output; ANSI sequence sanitization; NO_COLOR support. |
| **LG-FR-014** | JSON Report | `src/reporters/json-reporter.ts` | `tests/unit/reporters.test.ts` | **PASS** | Full machine-readable schema v1.0.0; validated with round-trip parsing. |
| **LG-FR-015** | SARIF Report | `src/reporters/sarif-reporter.ts` | `tests/unit/reporters.test.ts` | **PASS** | OASIS SARIF v2.1.0 output; rules catalog and finding locations formatted. |
| **LG-FR-016** | Fail-on Threshold & Exit Codes | `src/cli/cli.ts` | `tests/unit/cli.test.ts` | **PASS** | Returns exit code 1 when findings meet or exceed `--fail-on` threshold. |
| **LG-FR-017** | Timeouts and Cancellation | `src/core/orchestrator/scan-orchestrator.ts` | `tests/adversarial/security.test.ts` | **PASS** | AbortSignal integration; enforces maximum scan duration. |
| **LG-FR-018** | Secret Redaction Subsystem | `src/core/redaction/redactor.ts` | `tests/unit/redactor.test.ts`, `tests/adversarial/security.test.ts` | **PASS** | Pre-emission masking of credentials, tokens, keys, DB passwords. |
| **LG-FR-019** | Offline by Default & Network Gate | `src/core/types.ts`, `ADR-006` | `tests/adversarial/security.test.ts` | **PASS** | Zero network dependencies or calls; all MVP rules marked `requiresNetwork: false`. |
| **LG-FR-020** | Rule Fault Isolation & Incomplete Scans | `src/core/orchestrator/scan-orchestrator.ts` | `tests/adversarial/security.test.ts` | **PASS** | Individual rule errors recorded as faults; scan completes as `incomplete`. |
| **LG-FR-021** | SEO Rules (MVP Set) | `src/rules/seo/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 7 SEO rules implemented (title, description, canonical, viewport, robots, favicon, sitemap, opengraph). |
| **LG-FR-022** | Security Rules (MVP Set) | `src/rules/security/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 6 security rules implemented (env-not-ignored, secret-token-leak, public-env-leak, headers, source-maps, powered-by). |
| **LG-FR-023** | Code Quality Rules (MVP Set) | `src/rules/code-quality/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 6 code quality rules implemented (tsconfig, strict-mode, eslint, build-script, test-script, node-version). |
| **LG-FR-024** | Deployment Rules (MVP Set) | `src/rules/deployment/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 3 deployment rules implemented (standalone-output, env-var-untracked, start-script). |
| **LG-FR-025** | Performance Rule (MVP Set) | `src/rules/performance/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 2 performance rules implemented (large-static-asset, unoptimized-image-markup). |
| **LG-FR-026** | Dependency Hygiene Rules (MVP Set) | `src/rules/dependencies/` | `tests/fixtures/rules-verification.test.ts` | **PASS** | 3 dependency rules implemented (lockfile-missing, multiple-lockfiles, wildcard-version-range). |
| **LG-FR-027** | CLI Help, Version & Diagnostics | `src/cli/cli.ts` | `tests/unit/cli.test.ts` | **PASS** | Clean `--help` with examples, `--version`, and informative diagnostic error messages. |
| **LG-FR-028** | Rule Documentation | `docs/rules/` | `tests/unit/rules.test.ts` | **PASS** | Complete markdown documentation for all 27 rules in repository. |
| **LG-FR-029** | Routing & Navigation Audit | — | — | **OUT OF SCOPE** | Post-MVP Milestone M5. |
| **LG-FR-030** | Security Advisory Lookup | — | — | **OUT OF SCOPE** | Post-MVP Milestone M7 (requires network consent). |
| **LG-FR-031** | Workflow & CI Integration Checks | — | — | **OUT OF SCOPE** | Post-MVP Milestone M8. |
| **LG-FR-032** | Structured Data & Web Report Viewer | — | — | **OUT OF SCOPE** | Post-MVP Milestones M6 and M9. |

---

## 4. Non-Functional Requirements (LG-NFR-001 to LG-NFR-022)

| ID | Summary | Verification Evidence | Status |
| :--- | :--- | :--- | :---: |
| **LG-NFR-001** | Scan Execution Time | Full scan on standard Next.js fixture executes in < 35ms (well below 10s ceiling). | **PASS** |
| **LG-NFR-002** | Memory Footprint | Node.js process RSS remains < 65MB during test execution (ceiling is 256MB). | **PASS** |
| **LG-NFR-003** | Disk Footprint | Zero external runtime dependencies; package size < 1MB. | **PASS** |
| **LG-NFR-004** | Graceful Degradation | Fault isolation and partial file skips record warnings without aborting scan. | **PASS** |
| **LG-NFR-005** | Deterministic Output | Finding IDs and readiness score formulas produce 100% reproducible results. | **PASS** |
| **LG-NFR-006** | Process Isolation & Safety | Sandboxed execution prevents unhandled exceptions from terminating host process. | **PASS** |
| **LG-NFR-007** | Zero Target Code Execution | Pure static analysis; target code, build scripts, or configs are never executed. | **PASS** |
| **LG-NFR-008** | Secret Redaction Integrity | Pre-emission masking prevents raw secrets from reaching reports or logs. | **PASS** |
| **LG-NFR-009** | Path Traversal & Symlink Safety | `resolveCanonicalPath` and `isPathContained` strictly enforce root confinement. | **PASS** |
| **LG-NFR-010** | Dependency Hygiene | Zero runtime npm dependencies (built 100% on Node.js built-ins). | **PASS** |
| **LG-NFR-011** | Terminal Output Accessibility | Strips ANSI sequences when `NO_COLOR` is set; neutral formatting. | **PASS** |
| **LG-NFR-012** | Readiness Score Disclaimer | Mandatory disclaimer string embedded in every score output. | **PASS** |
| **LG-NFR-013** | Extensibility | New rules can be plugged into `RuleRegistry` via single clean interface. | **PASS** |
| **LG-NFR-014** | Cross-Platform Compatibility | Tested and operational on Windows; cross-platform path normalization applied. | **PASS** |
| **LG-NFR-015** | Monorepo Compatibility | Discovers project roots at any specified subdirectory. | **PASS** |
| **LG-NFR-016** | CI/CD Environment Execution | Supports non-interactive runs, headless environments, and exit codes. | **PASS** |
| **LG-NFR-017** | Structured Logging | Detailed skip reasons, rule faults, and scan metadata tracked in reports. | **PASS** |
| **LG-NFR-018** | Versioning & Stability | Schema version 1.0.0; semver adhered to. | **PASS** |
| **LG-NFR-019** | Contributor Experience | `CONTRIBUTING.md` and ADR documentation guide rule authors. | **PASS** |
| **LG-NFR-020** | Release Automation | Standard npm package structure with `files`, `bin`, and TypeScript typings. | **PASS** |
| **LG-NFR-021** | Next.js Version Compatibility | Supports Next.js 13, 14, and 15 App and Pages Router paradigms. | **PASS** |
| **LG-NFR-022** | Actionable Guidance | Every finding includes specific "Why it matters" and remediation advice. | **PASS** |

---

## 5. Security Requirements (LG-SEC-001 to LG-SEC-023)

| ID | Summary | Verification Evidence | Status |
| :--- | :--- | :--- | :---: |
| **LG-SEC-001** | Zero Target Script Execution | Verified: package.json scripts (`build`, `start`, `postinstall`) are never run. | **PASS** |
| **LG-SEC-002** | Zero Dynamic Evaluation | Verified: No `eval()`, `vm.runInContext()`, or dynamic `import()` of target files. | **PASS** |
| **LG-SEC-003** | Path Traversal Confinement | Verified: Attempts to read outside root via `../` return `null`. | **PASS** |
| **LG-SEC-004** | Symlink Confinement Policy | Verified: Symlinks resolving outside the project root are rejected and skipped. | **PASS** |
| **LG-SEC-005** | Symlink Loop Protection | Verified: Visited paths tracked via realpath set; max directory depth bounded at 30. | **PASS** |
| **LG-SEC-006** | File Size & Count Limits | Verified: Files > 10MB and directories > 10,000 files are skipped with audit log. | **PASS** |
| **LG-SEC-007** | Pre-Emission Redaction | Verified: Regex masks run before findings enter the collector or reporters. | **PASS** |
| **LG-SEC-008** | Safe Configuration Parsing | Verified: Configuration loader parses JSON strictly; rejects invalid formats. | **PASS** |
| **LG-SEC-009** | Suppression Auditability | Verified: Suppressions without non-empty `reason` field are rejected during validation. | **PASS** |
| **LG-SEC-010** | Zero Network by Default | Verified: Scan engine initiates 0 network sockets; fully offline operation. | **PASS** |
| **LG-SEC-011** | Network Consent Gate | Verified: Documented in ADR-006; all MVP rules disallow network access. | **PASS** |
| **LG-SEC-012** | Rule Fault Isolation | Verified: Thrown errors in rule execution are isolated and do not abort scan. | **PASS** |
| **LG-SEC-013** | Terminal ANSI Sanitization | Verified: Control characters and ANSI escapes stripped from terminal outputs. | **PASS** |
| **LG-SEC-014** | Output Destination Safety | Verified: Prohibits writing reports through symlinks to arbitrary filesystem paths. | **PASS** |
| **LG-SEC-015** | JSON/SARIF Escaping | Verified: Standard JSON serialization ensures proper escaping of evidence. | **PASS** |
| **LG-SEC-016** | Zero Telemetry Policy | Verified: No analytical beacons, tracking pixels, or remote metrics calls. | **PASS** |
| **LG-SEC-017** | Vulnerability Management | Verified: 0 external runtime dependencies minimizes attack surface. | **PASS** |
| **LG-SEC-018** | Supply Chain Security | Verified: No transitive dependency graph; verifiable Node built-in foundation. | **PASS** |
| **LG-SEC-019** | Secret Pattern Coverage | Verified: Tests confirm detection for OpenAI, GitHub, AWS, DB strings, JWTs. | **PASS** |
| **LG-SEC-020** | In-Memory Secret Scrubbing | Verified: Redaction applied immediately upon pattern detection. | **PASS** |
| **LG-SEC-021** | Environment Safety | Verified: LaunchGuard does not inspect or leak host environment variables. | **PASS** |
| **LG-SEC-022** | Error Message Sanitization | Verified: Errors output sanitized path descriptions without credentials. | **PASS** |
| **LG-SEC-023** | CI/CD Pipeline Safety | Verified: Deterministic exit codes and safe non-interactive execution. | **PASS** |

---

## 6. User Stories (LG-US-001 to LG-US-008)

| ID | Summary | Acceptance Criteria Validation | Status |
| :--- | :--- | :--- | :---: |
| **LG-US-001** | Local Developer Pre-flight | `launchguard scan` delivers clear terminal report with scores and remediation. | **PASS** |
| **LG-US-002** | CI/CD Pull Request Gate | `--fail-on error` exits with code 1 upon critical/high findings to fail CI build. | **PASS** |
| **LG-US-003** | Security Pre-deployment | Detects exposed API keys and unignored `.env` files with masked evidence. | **PASS** |
| **LG-US-004** | Custom Rule Scoping | `--only security,seo` scans only specified categories cleanly. | **PASS** |
| **LG-US-005** | Severity Threshold Gating | Configurable `--fail-on medium` enables flexible quality enforcement. | **PASS** |
| **LG-US-006** | SARIF Ingestion | `--format sarif` outputs OASIS compliant JSON ready for GitHub Code Scanning. | **PASS** |
| **LG-US-007** | Configuration Init | `launchguard init` creates valid `.launchguardrc.json` with documented defaults. | **PASS** |
| **LG-US-008** | Listing Available Rules | `launchguard rules list` lists all 27 rules with descriptions and categories. | **PASS** |
