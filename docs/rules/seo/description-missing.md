# Rule: `seo/description-missing` (LG-SEO-R002)

- **Category:** `seo`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Meta descriptions are displayed below the page title in search engine results. When omitted, search engines automatically generate snippets from page body content, which may display fragmented or irrelevant copy.

## What LaunchGuard Checks

LaunchGuard statically inspects root layout and page metadata in App Router and Pages Router projects for `description` declarations.

## How to Fix

Add a `description` property to your exported `metadata` object in `app/layout.tsx`:

```typescript
export const metadata = {
  title: 'My Next.js Application',
  description: 'Production-ready Next.js application built with LaunchGuard.',
};
```
