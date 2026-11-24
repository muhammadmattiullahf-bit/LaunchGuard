# Rule: `code-quality/build-error-suppression` (LG-COD-R006)

- **Category:** `code-quality`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Configuring `ignoreBuildErrors: true` (TypeScript) or `ignoreDuringBuilds: true` (ESLint) allows broken code with type errors or lint failures to pass compilation and ship directly to users.

## What LaunchGuard Checks

Checks `next.config.*` for `ignoreBuildErrors: true` or `ignoreDuringBuilds: true`.

## How to Fix

Remove these options from `next.config.*` and fix all underlying type and lint errors before building.
