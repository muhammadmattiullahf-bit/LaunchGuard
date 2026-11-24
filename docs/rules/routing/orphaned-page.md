# Rule: `routing/orphaned-page` (LG-RTE-R005)

- **Category:** `routing`
- **Default Severity:** `low`
- **Default Confidence:** `medium`
- **Release Class:** `post-mvp`

## Why This Matters

Orphaned pages are routes that exist in your codebase but have no internal links pointing to them. While not necessarily broken, orphaned pages can indicate obsolete landing pages, forgotten draft features, or navigation oversights. Furthermore, search engine crawlers struggle to discover and index orphaned pages without external inbound links or sitemap references.

## What LaunchGuard Checks

LaunchGuard builds a static internal navigation graph connecting source files to route destinations. It identifies page routes that have zero detected inbound links from any `<Link>`, `<a>`, or `router.push()` expressions within the repository.

Exclusions applied to avoid false positives:
- The root page `/` (which is naturally an entry point).
- API routes and Route Handlers (`route.ts`, `pages/api/*`).
- Framework convention routes (`not-found`, `error`, `404`).

*Note on Confidence:* Confidence is `medium` because pages may legitimately be linked externally, accessed via dynamic runtime menus, or reached via sitemaps.

## How to Fix

1. If the page is intended to be accessible to users, link to it from your navigation bar, footer, or parent overview pages.
2. If the page is a public landing page indexed only via search engines or ads, ensure it is included in `public/sitemap.xml` or `app/sitemap.ts`.
3. If the page is obsolete or deprecated, consider deleting it or archiving it outside the route directory.
