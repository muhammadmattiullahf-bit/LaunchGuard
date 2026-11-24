# Rule: `seo/title-missing` (LG-SEO-R001)

- **Category:** `seo`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Page titles are the single most prominent element displayed in search engine results pages (SERPs) and browser tab titles. Next.js App Router relies on root or nested layout and page `metadata` exports to supply document `<title>` tags. When a layout or page omits a title, search engine crawlers either display fallback URLs or infer arbitrary titles from page body text, significantly hurting click-through rates.

## What LaunchGuard Checks

LaunchGuard statically inspects root layout and page files in `app/` and `src/app/` for:
1. Static export `export const metadata = { title: "..." }`
2. Dynamic export `export async function generateMetadata(...)`
3. Fallback `<title>` tags

If the root layout does not declare or template title metadata, a `medium` severity finding is reported.

## How to Fix

In `app/layout.tsx` (or `src/app/layout.tsx`), export a metadata object with a title template:

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'My Application',
    template: '%s | My Application',
  },
  description: 'Production-ready Next.js application.',
};
```

## Static Analysis Limitations

Dynamic CMS-driven titles loaded exclusively at runtime through custom database queries or dynamic fetch calls in deeply nested components without `generateMetadata` cannot be resolved statically.
