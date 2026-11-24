# Rule: `deployment/env-var-untracked` (LG-DPL-R002)

- **Category:** `deployment`
- **Default Severity:** `low`
- **Default Confidence:** `medium`
- **Release Class:** `mvp`

## Why This Matters

Referencing `process.env.<VAR>` in code without documenting the key in `.env.example` leads to missing configuration errors when deploying to new environments.

## What LaunchGuard Checks

Scans source code for `process.env.<NAME>` references and flags any key not listed in `.env.example`.

## Limitations Note

Pattern-based extraction catches statically referenced `process.env` properties only.

## How to Fix

Add the referenced variable with an explanatory comment to `.env.example`:

```env
# Database connection string
DATABASE_URL=
```
