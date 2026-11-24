# Rule: `dependencies/wildcard-version-range` (LG-DEP-R003)

- **Category:** `dependencies`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Declaring `*` or `latest` as a dependency version in `package.json` allows unpinned upstream packages to be updated automatically on install, risking unexpected breaking changes or immediate compromise from malicious package updates.

## What LaunchGuard Checks

Checks `dependencies` and `devDependencies` in `package.json` for `*`, `latest`, or empty version strings.

## How to Fix

Pin all dependencies to semantic version ranges (e.g. `^18.2.0` or exact `18.2.0`).
