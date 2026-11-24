# Rule: `dependencies/multiple-lockfiles` (LG-DEP-R002)

- **Category:** `dependencies`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Having multiple lockfiles (for instance, both `package-lock.json` and `pnpm-lock.yaml`) in the same repository creates ambiguity for CI/CD runners and contributors, risking out-of-sync dependency trees.

## What LaunchGuard Checks

Checks if more than one distinct lockfile format is present at the project root.

## How to Fix

Standardize on a single package manager for the project and delete the unused lockfiles.
