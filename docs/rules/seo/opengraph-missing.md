# Rule: `seo/opengraph-missing` (LG-SEO-R009)

- **Category:** `seo`
- **Default Severity:** `low`
- **Default Confidence:** `medium`
- **Release Class:** `mvp`

## Why This Matters

Open Graph tags control preview titles, descriptions, and images when links are shared on social media, messaging platforms, and collaboration tools.

## What LaunchGuard Checks

Checks for `openGraph` properties in root layout metadata.

## How to Fix

```typescript
export const metadata = {
  openGraph: {
    title: 'My Next.js Application',
    description: 'Production-ready Next.js application.',
    url: 'https://example.com',
    siteName: 'Example',
    images: [{ url: 'https://example.com/og.png', width: 1200, height: 630 }],
  },
};
```
