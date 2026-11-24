# Rule: `code-quality/typescript-config-missing` (LG-COD-R001)

- **Category:** `code-quality`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

TypeScript source files require a valid `tsconfig.json` at the project root to ensure standard compilation flags, path mappings, and type checking.

## What LaunchGuard Checks

Checks if `.ts` or `.tsx` source files exist without a corresponding `tsconfig.json`.

## How to Fix

Generate a `tsconfig.json` with `npx tsc --init` or add a standard Next.js TypeScript configuration.
