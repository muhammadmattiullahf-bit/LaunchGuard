# Rule: `code-quality/build-script-missing` (LG-COD-R004)

- **Category:** `code-quality`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Production deployment targets (Vercel, AWS Amplify, Netlify, Docker containers) rely on `npm run build` to compile pages and optimize bundles.

## What LaunchGuard Checks

Checks `package.json` `scripts.build`.

## How to Fix

Add `"build": "next build"` to `scripts` in `package.json`.
