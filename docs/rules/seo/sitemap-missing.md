# Rule: `seo/sitemap-missing` (LG-SEO-R007)

- **Category:** `seo`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

A sitemap provides search engines with a comprehensive catalog of pages available for crawling.

## What LaunchGuard Checks

Checks for `public/sitemap.xml` or `app/sitemap.ts` (or `.js`/`.tsx`/`.jsx`).

## How to Fix

Create `public/sitemap.xml` or define an `app/sitemap.ts` metadata route.
