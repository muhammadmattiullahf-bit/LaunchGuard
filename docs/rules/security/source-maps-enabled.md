# Rule: `security/source-maps-enabled` (LG-SEC-R005)

- **Category:** `security`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

When `productionBrowserSourceMaps: true` is configured in `next.config.*`, Next.js outputs full original source code maps to client browsers in production, exposing proprietary code, internal architecture, comments, and unredacted endpoints.

## What LaunchGuard Checks

Checks `next.config.*` for `productionBrowserSourceMaps: true`.

## How to Fix

Remove `productionBrowserSourceMaps: true` or set it to `false` in production configurations.
