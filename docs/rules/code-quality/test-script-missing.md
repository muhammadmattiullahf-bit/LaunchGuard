# Rule: `code-quality/test-script-missing` (LG-COD-R005)

- **Category:** `code-quality`
- **Default Severity:** `informational`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Automated testing catches regressions before code is merged or deployed.

## What LaunchGuard Checks

Checks `package.json` for a functional `test` script (flags missing scripts or default `echo "Error: no test specified" && exit 1`).

## How to Fix

Add a real test runner (e.g. `node --test`, `vitest`, or `jest`) under `scripts.test` in `package.json`.
