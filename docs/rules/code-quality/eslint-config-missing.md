# Rule: `code-quality/eslint-config-missing` (LG-COD-R003)

- **Category:** `code-quality`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Next.js includes custom ESLint rules (such as React Hooks rules, font optimization, and Next.js Image checks) that prevent runtime bugs and performance regressions.

## What LaunchGuard Checks

Checks for `.eslintrc.*` or `eslint.config.*` at the project root.

## How to Fix

Add a `.eslintrc.json` extending `next/core-web-vitals`:

```json
{
  "extends": "next/core-web-vitals"
}
```
