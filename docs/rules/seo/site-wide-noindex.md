# Rule: `seo/site-wide-noindex` (LG-SEO-R006)

- **Category:** `seo`
- **Default Severity:** `high`
- **Default Confidence:** `medium`
- **Release Class:** `mvp`

## Why This Matters

Site-wide `noindex` or `Disallow: /` prevents all compliant search engines from indexing the site, causing complete loss of organic traffic.

## What LaunchGuard Checks

Checks `public/robots.txt` for `Disallow: /` with `User-agent: *`, and root layout metadata for `robots: { index: false }`.

## How to Fix

Remove `index: false` from root layout metadata and ensure `robots.txt` allows public routes before deploying to production.
