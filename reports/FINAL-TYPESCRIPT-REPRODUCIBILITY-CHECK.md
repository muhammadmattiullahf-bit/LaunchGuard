# LaunchGuard — Final TypeScript Reproducibility Check

**Document Reference:** LG-REP-001  
**Target:** LaunchGuard v0.1.0  
**Date:** 2026-11-20  
**Status:** Verification Complete (Read-Only)  
**Author:** Software Architecture & QA Team  

---

## 1. Executive Summary

This report documents the final read-only reproducibility check on LaunchGuard v0.1.0, specifically addressing package scripts, local TypeScript availability, exact command executions, and network access requirements.

### Key Conclusions:
1. **CLI Nature & Scripts:** LaunchGuard is a command-line interface tool. Its `package.json` correctly defines test and CLI execution scripts (`test`, `test:unit`, `test:adversarial`, `test:fixtures`, `launchguard`). It does not define a `dev` script, which is why `npm run dev` produces an expected `missing script: dev` error.
2. **Local TypeScript Availability:** The TypeScript compiler (`typescript`) is **not installed locally** in `node_modules` or listed in `package.json`. Only `@types/node` is installed in `devDependencies`.
3. **Execution of `npx --no-install tsc --version` & `npx --no-install tsc --noEmit`:** Both commands fail with `exit code 1` and error `npm error npx canceled due to missing packages and no YES option: ["tsc@2.0.4"]`.
4. **Execution of `npm test`:** **PASS (67/67 tests passing)** in ~1.15 seconds with **zero failures** and **zero network access**.
5. **Antigravity-Bundled Compiler Status:** **PASS (0 errors, 0 warnings)** using compiler version **`6.0.0-dev.20260115`** with **zero network access**.
6. **Network Access Confirmation:** `npm test` and the Antigravity-bundled compiler require **no network access**. `npx --no-install` attempts network lookups when searching for uninstalled packages unless network access is restricted.

---

## 2. Inspection of `package.json` Scripts

The `scripts` object in `package.json` is:
```json
  "scripts": {
    "test": "node --test tests/**/*.test.ts",
    "test:unit": "node --test tests/unit/**/*.test.ts",
    "test:adversarial": "node --test tests/adversarial/**/*.test.ts",
    "test:fixtures": "node --test tests/fixtures/**/*.test.ts",
    "launchguard": "node bin/launchguard.js"
  }
```

### Analysis:
- LaunchGuard is a static CLI analysis utility invoked as `launchguard <command>` or `node bin/launchguard.js`.
- It is not a continuous development server (e.g. Next.js or Vite web app).
- As directed, **no `dev` script has been added** to `package.json`. The failure of `npm run dev` is expected because `dev` is undefined and unneeded.

---

## 3. Local TypeScript Availability Check

A filesystem check confirms:
- `Test-Path "node_modules/typescript"` -> **`False`**
- `Test-Path "node_modules/.bin/tsc"` -> **`False`**
- `Get-Command tsc` -> **Not found on system PATH**

`package.json` and `package-lock.json` confirm:
- `"dependencies": {}` (Completely empty).
- `"devDependencies": { "@types/node": "^24.0.0" }`.
- `typescript` is not a project dependency.

---

## 4. Exact Commands & Reproducibility Results

### 4.1 Command: `npx --no-install tsc --version`
- **Exit Code:** `1`
- **Output:**
  ```text
  npm error npx canceled due to missing packages and no YES option: ["tsc@2.0.4"]
  npm error A complete log of this run can be found in: ...\npm-cache\_logs\2026-11-20T...-debug-0.log
  ```
- **Network Requirement:**
  - In a network-isolated environment (standard sandbox), `npx` attempts a socket connection to query the npm registry and blocks until timed out.
  - With network access, `npx` queries npm cache/registry, confirms `tsc` is not installed locally, and exits immediately with code 1 without downloading packages (due to `--no-install`).

### 4.2 Command: `npx --no-install tsc --noEmit`
- **Exit Code:** `1`
- **Output:**
  ```text
  npm error npx canceled due to missing packages and no YES option: ["tsc@2.0.4"]
  npm error A complete log of this run can be found in: ...\npm-cache\_logs\2026-11-20T...-debug-0.log
  ```
- **Network Requirement:** Same as above. `npx` aborts before executing any compiler.

### 4.3 Command: `npm test`
- **Exit Code:** `0`
- **Output Summary:**
  ```text
  > launchguard@0.1.0 test
  > node --test tests/**/*.test.ts

  ✔ Filesystem Deep: Hard Links within repository root (8.1ms)
  ✔ Filesystem Deep: Windows Directory Junctions and External Reparse Points (9.0ms)
  ✔ Filesystem Deep: Unicode Normalization (NFC and NFD characters in filenames) (45.9ms)
  ✔ Filesystem Deep: Case Sensitivity and Router layout detection (27.7ms)
  ✔ Filesystem Deep: Complex Path Traversal Attempts in safeReadFile (143.5ms)
  ✔ Filesystem Deep: Cancellation and AbortSignal Timeout during scanning (99.6ms)
  ...
  ✔ Reproducibility: Exit codes are consistent across repeated CLI invocations (64.1ms)
  ✔ Rule Registry: All MVP rules have required metadata fields (DOC-001 LG-FR-004) (1.6ms)
  ✔ Rule Documentation Check: Every registered rule has corresponding docs (LG-FR-028) (30.4ms)
  ✔ Rule Registry: Error handling on invalid rule registration and lookup (1.4ms)
  ✔ Fingerprint: Deterministic and insensitive to line changes (4.3ms)
  ✔ Finding Collector: Deduplicates identical findings (1.2ms)
  ✔ Finding Collector: Handles suppression with reason (0.5ms)
  ✔ Readiness Score: Clean project scores 100 with mandatory disclaimer (0.6ms)
  ✔ Readiness Score: Applies penalty and diminishing returns cap per rule (0.6ms)
  ℹ tests 67
  ℹ suites 0
  ℹ pass 67
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 1145.06
  ```
- **Network Requirement:** **Zero network access.** Executed entirely within standard sandbox mode with full network isolation.

### 4.4 Antigravity-Bundled Compiler Check
- **Command:**
  ```powershell
  node "C:\Users\AL MADINA COMPUTER\AppData\Local\Programs\Antigravity IDE\resources\app\node_modules\typescript\lib\_tsc.js" --noEmit
  ```
- **Compiler Version:** `Version 6.0.0-dev.20260115`
- **Exit Code:** `0`
- **Output:** *(None — zero errors, zero warnings)*
- **Network Requirement:** **Zero network access.** Fully offline and reproducible within the Antigravity IDE environment.

---

## 5. Network Access Summary Table

| Operation | Exit Code | Result | Network Access Required? |
| :--- | :--- | :--- | :--- |
| `npm run dev` | `1` | `missing script: dev` (Expected for CLI) | **No** |
| `npx --no-install tsc --version` | `1` | Missing package error (`tsc@2.0.4`) | **Yes** (to check registry without local binary) |
| `npx --no-install tsc --noEmit` | `1` | Missing package error (`tsc@2.0.4`) | **Yes** (to check registry without local binary) |
| `npm test` | `0` | **67 / 67 PASS** | **No** (100% offline, fully sandboxed) |
| Antigravity Compiler Check | `0` | **0 errors, 0 warnings** | **No** (100% offline, fully sandboxed) |

---

## 6. Smallest Appropriate Solution (If Authorized)

If full CLI-level offline reproducibility is desired for `npx --no-install tsc --noEmit` and `npm run typecheck`:
1. Add `"typescript": "^5.8.2"` strictly under `"devDependencies"` in `package.json`.
2. Add `"typecheck": "tsc --noEmit"` under `"scripts"` in `package.json`.
3. Run `npm install` once outside sandbox to populate `node_modules/.bin/tsc`.

*Status: In accordance with project instructions, this change has not been made. The project remains in a clean, read-only state.*

---

## 7. Compliance Statement

- Source code: **Unmodified**
- `package.json`: **Unmodified**
- `package-lock.json`: **Unmodified**
- DOC-001: **Unmodified**
- Approved ADRs (ADR-001, ADR-002, ADR-006): **Preserved**
- Milestone M5: **Not started**
