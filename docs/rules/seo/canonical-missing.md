# Rule: `seo/canonical-missing` (LG-SEO-R004)

- **Category:** `seo`
- **Default Severity:** `low`
- **Default Confidence:** `medium`
- **Release Class:** `mvp`

## Why This Matters

Canonical URLs instruct search engine crawlers which URL represents the master copy of a page, preventing duplicate content penalties when queries or tracking parameters vary.

## What LaunchGuard Checks

Checks for `alternates: { canonical: "..." }` in App Router metadata exports.

## How to Fix

```typescript
export const metadata = {
  metadataBase: new URL('https://example.com'),
  alternates: {
    canonical: '/',
  },
};
```
