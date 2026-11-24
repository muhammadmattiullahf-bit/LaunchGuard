# Rule: `code-quality/typescript-strict-disabled` (LG-COD-R002)

- **Category:** `code-quality`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Disabling TypeScript strict mode permits implicit `any`, loose null/undefined checks, and untyped parameters, significantly increasing runtime `TypeError` risks in production.

## What LaunchGuard Checks

Checks `tsconfig.json` compilerOptions for `"strict": true`.

## How to Fix

Enable `"strict": true` under `compilerOptions` in `tsconfig.json`.
