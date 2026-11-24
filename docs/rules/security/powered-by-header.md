# Rule: `security/powered-by-header` (LG-SEC-R006)

- **Category:** `security`
- **Default Severity:** `informational`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

By default, Next.js adds `X-Powered-By: Next.js` to response headers. While not a direct exploit, broadcasting server technology aids reconnaissance by automated scanners seeking version-specific vulnerabilities.

## What LaunchGuard Checks

Checks `next.config.*` for `poweredByHeader: false`.

## How to Fix

In `next.config.js`:

```javascript
module.exports = {
  poweredByHeader: false,
};
```
