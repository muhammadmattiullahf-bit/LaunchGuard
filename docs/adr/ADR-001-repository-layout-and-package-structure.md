# ADR-001: Repository Layout and Package Structure

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-FR-001, LG-FR-002, LG-FR-003, LG-FR-004, LG-NFR-010, LG-NFR-019, LG-RISK-010
- **Related Open Question:** OQ-005

## Context

DOC-001 Section 13.2 defines three primary logical layers:
1. **CLI:** User interface, terminal rendering, argument parsing, JSON/SARIF file output, exit codes.
2. **Core Engine:** Scanning orchestration, safe file discovery, rule registry, rule execution, findings collection, deduplication, confidence assignment, scoring.
3. **Web:** Product documentation and future client-side report viewer.

DOC-001 directives mandate:
- "The Core Engine must not import dependencies from the CLI or Web application."
- "The Web application must not become a dependency of local scanning."
- "Do not split the system into multiple independently published npm packages without an approved decision (LG-RISK-010)."

Publishing multiple separate npm packages (`@launchguard/cli`, `@launchguard/core`, etc.) prematurely introduces heavy operational overhead: monorepo tooling churn, complex version synchronization, multiple publishing credentials, and high maintenance burden.

## Decision

For the MVP:
1. **Single Repository, Single Package with Strict Internal Modular Boundaries**:
   - The project is structured as a unified TypeScript repository under a single `package.json`.
   - Source code is strictly partitioned by directory:
     - `src/core/`: Reusable scanning engine, safe filesystem operations, rule registry, scoring, redaction, data models. Has zero dependencies on `src/cli` or web layers.
     - `src/cli/`: CLI entrypoint and commands (`scan`, `rules list`, `init`), argument parsing, formatting stdout/stderr, setting exit status.
     - `src/reporters/`: Terminal, JSON, and SARIF formatters consuming only the report data model.
     - `src/rules/`: Audit modules partitioned into `seo`, `security`, `code-quality`, `performance`, `dependencies`, and `deployment`.
     - `tests/`: Comprehensive unit, fixture, and adversarial tests.
     - `docs/`: Product documentation, ADRs, and rule specifications.
2. **Package Entrypoints**:
   - `package.json` specifies `"bin": { "launchguard": "./bin/launchguard.js" }` for CLI execution.
   - Core API will be exported via `src/core/index.ts` (exporting only clean types and engine orchestrators) so that future library consumers can use the engine programmatically without CLI dependencies.
3. **Zero Incompatible Cross-Imports**:
   - Enforce architectural purity: `src/core/` will NEVER import from `src/cli/` or future web applications.

## Consequences

### Positive
- Minimal operational and maintenance friction.
- Zero premature version sync problems.
- Fast local development and testing loop.
- Easy to extract `@launchguard/core` into a standalone published package in the future if approved, because boundary isolation is strictly enforced from day one.

### Negative
- Library consumers currently install the single `launchguard` package rather than a standalone stripped-down `@launchguard/core` package. This is acceptable for MVP and documented in OQ-005.
