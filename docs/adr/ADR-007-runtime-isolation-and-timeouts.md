# ADR-007: Runtime Isolation, Timeouts, and Exit Code Precedence

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-FR-016, LG-FR-017, LG-FR-020, LG-SEC-006, LG-NFR-004
- **Related Open Question:** OQ-011, OQ-019

## Context

Untrusted repositories might contain large file trees, deep directories, circular symlinks, or malformed inputs designed to stall scanners or trigger catastrophic memory consumption.
Furthermore, CI runners require deterministic exit codes with unambiguous precedence.

## Decision

1. **Rule Isolation:**
   - Scan orchestrator executes rules with structured error boundaries (`try...catch` at the rule level).
   - Global timeout (default: 60,000ms, configurable via `--timeout <ms>`) using `AbortController` and signals.
   - Per-rule timeout limit (default: 10,000ms). If a rule exceeds its time limit, it is aborted and recorded as a fault in `faults: [{ ruleId, reason: "Rule execution timed out" }]`.
   - The scan status becomes `"incomplete"`. Remaining rules continue unaffected.

2. **Filesystem Containment Limits:**
   - `maxFileSize`: 10MB per file (exceeding files are skipped with a warning note in `skippedFiles`).
   - `maxFileCount`: 10,000 files per scan.
   - `maxDirectoryDepth`: 30 levels.
   - Symlinks pointing outside canonical project root are strictly ignored and logged as skipped.

3. **Exit Code Precedence (OQ-019):**
   - **Code 2 (Usage/Config error):** Path missing, not a Next.js project, invalid arguments, or malformed config.
   - **Code 130 (Interrupted):** Scan cancelled by user (e.g. `SIGINT`).
   - **Code 1 (Threshold breach):** Scan produced at least one active (non-suppressed) finding at or above `--fail-on` threshold. This takes precedence over Code 3 when both occur (e.g., if a critical vulnerability is found before another rule times out, CI should block on the vulnerability).
   - **Code 3 (Incomplete scan):** Incomplete scan (rule faults, timeouts, or skipped analysis) without any `--fail-on` breach determinable.
   - **Code 4 (Internal unhandled error):** Fatal unrecoverable tool crash.
   - **Code 0 (Success):** Scan complete, and no finding exceeds `--fail-on` (or no threshold set).

## Consequences

- Rock-solid CI/CD predictability.
- Adversarial repositories cannot crash the tool or hang indefinitely.
