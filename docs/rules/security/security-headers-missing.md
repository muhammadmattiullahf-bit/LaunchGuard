# Rule: `security/security-headers-missing` (LG-SEC-R004)

- **Category:** `security`
- **Default Severity:** `medium`
- **Default Confidence:** `low`
- **Release Class:** `mvp`

## Why This Matters

Standard HTTP security headers protect modern web applications from framing/clickjacking attacks, Cross-Site Scripting (XSS), MIME confusion, and referrer leaks.

## What LaunchGuard Checks

Checks `next.config.*` for the presence of a `headers()` configuration returning security headers such as `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.

## Limitations Note

Confidence is `low` because security headers may be injected by edge CDNs, Cloudflare, or reverse proxies outside the repository.

## How to Fix

Add a `headers()` function in `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```
