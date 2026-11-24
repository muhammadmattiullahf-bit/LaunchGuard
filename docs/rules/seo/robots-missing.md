# Rule: `seo/robots-missing` (LG-SEO-R005)

- **Category:** `seo`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Robots configuration informs compliant web crawlers which pages they are allowed to index.

## What LaunchGuard Checks

Checks for `public/robots.txt` or an App Router metadata route (`app/robots.ts`, `app/robots.js`, etc.).

## How to Fix

Add `public/robots.txt` or export a default function from `app/robots.ts`:

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```
