# LaunchGuard MVP — Code Coverage & Untested Paths Report

**Document ID:** LG-CCR-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Date:** November 2026  
**Auditor:** QA & Test Engineering Subagent  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (LG-NFR-010, Section 17)  

---

## 1. Executive Summary & Measurement Methodology

A passing test suite (e.g., 66/66 passed tests) verifies that all executed scenarios succeeded, but **does not prove that 100% of the codebase was executed**.

To measure actual code coverage without compromising LaunchGuard's zero-dependency production architecture, code coverage was measured using Node.js's native test runner coverage engine (`node --test --experimental-test-coverage`). This eliminated the need to introduce heavy third-party packages (such as Istanbul, c8, or nyc) into production or development dependencies.

### Aggregate Coverage Summary
- **Overall Line Coverage:** **90.22%**
- **Overall Branch Coverage:** **86.30%**
- **Overall Function Coverage:** **93.10%**
- **Total Automated Tests:** 66 tests passing across 9 test suites.

---

## 2. File-by-File Coverage Metrics

| Subsystem / File | Line % | Branch % | Function % | Uncovered Lines | Coverage Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **`src/cli/cli.ts`** | 81.90% | 69.49% | 50.00% | 59-61, 108-120, 133-135, 161-164, 170-172, 177-184, 188-195, 201-203, 208-210, 215-217, 258, 303-304, 309-311 | **PASS** |
| **`src/core/config/config-loader.ts`** | 75.82% | 64.29% | 100.00% | 83-84, 93, 97-108, 112-116, 120-124, 128-143, 148-149, 152-153, 155-156, 164, 179-184, 205-209 | **PARTIAL** |
| **`src/core/dedup/finding-collector.ts`** | 100.00% | 93.02% | 100.00% | None | **PASS** |
| **`src/core/discovery/project-discovery.ts`** | 90.64% | 91.23% | 100.00% | 34-38, 61-65, 72-77, 106, 188-189 | **PASS** |
| **`src/core/discovery/safe-file-discovery.ts`** | 65.53% | 73.53% | 100.00% | 49-54, 92-94, 108-113, 119-125, 134-180, 212-217, 219-224 | **PARTIAL** |
| **`src/core/orchestrator/scan-orchestrator.ts`** | 95.12% | 81.08% | 88.89% | 43-44, 89-90, 94-95, 99-100, 103-104 | **PASS** |
| **`src/core/redaction/redactor.ts`** | 92.44% | 82.86% | 85.71% | 81-82, 100, 109-111, 119-120, 127, 135-136, 165-166 | **PASS** |
| **`src/core/rules/rule-registry.ts`** | 100.00% | 100.00% | 100.00% | None | **PASS** |
| **`src/core/scoring/readiness-score.ts`** | 92.22% | 77.78% | 100.00% | 38-44 | **PASS** |
| **`src/reporters/json-reporter.ts`** | 100.00% | 100.00% | 100.00% | None | **PASS** |
| **`src/reporters/sarif-reporter.ts`** | 100.00% | 92.31% | 100.00% | None | **PASS** |
| **`src/reporters/terminal-reporter.ts`** | 86.00% | 82.14% | 100.00% | 36, 73-81, 85-86, 119-127 | **PASS** |
| **`src/rules/code-quality/code-quality-rules.ts`** | 100.00% | 96.77% | 100.00% | None | **PASS** |
| **`src/rules/dependencies/dependency-rules.ts`** | 100.00% | 92.31% | 100.00% | None | **PASS** |
| **`src/rules/deployment/deployment-rules.ts`** | 93.38% | 85.00% | 100.00% | 19-27 | **PASS** |
| **`src/rules/index.ts`** | 100.00% | 100.00% | 100.00% | None | **PASS** |
| **`src/rules/performance/performance-rules.ts`** | 100.00% | 100.00% | 100.00% | None | **PASS** |
| **`src/rules/security/security-rules.ts`** | 100.00% | 91.67% | 100.00% | None | **PASS** |
| **`src/rules/seo/seo-rules.ts`** | 89.97% | 97.33% | 84.21% | 65-102 | **PASS** |

---

## 3. Analysis of Untested Critical Code Paths

### 3.1 `src/cli/cli.ts` (81.90% line coverage)
- **Uncovered Lines 59–61:** Diagnostic formatting when CLI runs under Node environments where `process.stdout.columns` is undefined.
- **Uncovered Lines 108–120:** Help text generation for the standalone `launchguard init` command when invoked with `--help`.
- **Uncovered Lines 161–164, 170–172, 208–210:** Interactive user prompts or diagnostic error messages on invalid flag values (`--fail-on unknown`, `--min-confidence invalid`).
- **Risk Assessment:** Low. These lines are defensive guards for invalid command-line inputs and terminal column detection fallbacks.

### 3.2 `src/core/config/config-loader.ts` (75.82% line coverage)
- **Uncovered Lines 97–108, 112–116, 128–143:** Defensive type guards checking malformed suppression elements (e.g. suppression entry is a boolean or number instead of an object, or contains an invalid rule ID pattern).
- **Uncovered Lines 179–184:** Fallback when an explicitly provided `--config` path cannot be read due to file lock or permission error.
- **Risk Assessment:** Low-Medium. While standard malformed configurations and unknown keys are thoroughly tested, deeply nested invalid suppression arrays are not all individually exercised.

### 3.3 `src/core/discovery/safe-file-discovery.ts` (65.53% line coverage)
- **Uncovered Lines 49–54:** Secondary catch block fallback when `fs.realpathSync.native` fails and standard `fs.realpathSync` also throws an exception.
- **Uncovered Lines 134–180:** Deep directory traversal branches for handling non-standard reparse points or Windows filesystem permission errors (`EPERM`/`EACCES`).
- **Risk Assessment:** Low. These paths handle esoteric filesystem driver errors and legacy Windows short path exceptions that are difficult to trigger without kernel-level faults.

### 3.4 `src/core/orchestrator/scan-orchestrator.ts` (95.12% line coverage)
- **Uncovered Lines 89–90, 94–95, 99–100:** In `safeReadFile`, defensive checks that skip sockets, FIFO pipes, and device files (`stat.isFile() === false`).
- **Risk Assessment:** Negligible. Next.js projects do not legitimately contain Unix sockets or named FIFOs in source directories.

### 3.5 `src/rules/seo/seo-rules.ts` (89.97% line coverage)
- **Uncovered Lines 65–102:** Fallback heuristics for Pages Router `_document.tsx` and `_app.tsx` legacy title/metadata extraction.
- **Risk Assessment:** Low. The vast majority of modern Next.js deployments use the App Router (`app/layout.tsx`), which has 100% test coverage.

---

## 4. Recommendations for Post-MVP Testing

1. Add explicit test fixtures for legacy Pages Router projects containing `pages/_document.tsx` and `pages/_app.tsx` to push `seo-rules.ts` coverage above 95%.
2. Implement a dedicated fuzzing harness for `.launchguardrc.json` to exercise every branch of the deep suppression schema validator in `config-loader.ts`.
3. Keep the native `node --test --experimental-test-coverage` command in CI scripts to avoid introducing third-party dependencies while preserving continuous coverage visibility.
