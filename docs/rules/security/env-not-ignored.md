# Rule: `security/env-not-ignored` (LG-SEC-R001)

- **Category:** `security`
- **Default Severity:** `high`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Environment files (`.env`, `.env.local`) contain confidential database credentials, API keys, and signing tokens. If omitted from `.gitignore`, they risk accidental inclusion in Git commits and public repository pushes.

## What LaunchGuard Checks

Verifies that when `.env*` files exist in the project, `.gitignore` includes ignore rules covering them (e.g. `.env*` or `.env.local`).

## How to Fix

Add the following to your root `.gitignore`:

```gitignore
# Local environment files
.env*.local
.env
.env.production
.env.development
```
