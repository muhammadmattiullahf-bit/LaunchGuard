# Rule: `code-quality/node-version-missing` (LG-COD-R007)

- **Category:** `code-quality`
- **Default Severity:** `informational`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Different Node.js runtime versions introduce breaking changes or subtle API differences. Declaring an explicit version ensures local and CI environments stay aligned.

## What LaunchGuard Checks

Checks `package.json` for `engines.node` and checks for `.nvmrc` or `.node-version`.

## How to Fix

Add `"engines": { "node": ">=18.0.0" }` to `package.json` or create an `.nvmrc` file specifying your target Node.js version.
