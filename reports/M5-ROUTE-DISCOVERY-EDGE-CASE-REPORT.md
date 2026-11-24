# LaunchGuard — M5 Route Discovery & Edge Case Audit Report

**Document Reference:** LG-QA-M5-002  
**Target:** `src/core/routing/route-manifest.ts`  
**Audit Date:** 2026-11-20  
**Status:** Audit Complete  
**Auditor:** Independent Software QA & Architecture Audit Team  

---

## 1. Scope of Audit

This audit evaluates the route discovery engine in `src/core/routing/route-manifest.ts` across both Next.js App Router and Pages Router architectures, verifying edge-case handling, convention compliance, and route collision detection.

---

## 2. Verified Capabilities

### 2.1 App Router Conventions
- **Root & Nested Pages:** Correctly identifies `app/page.tsx` as `/` and nested paths (e.g. `app/about/page.tsx` as `/about`, `app/dashboard/settings/page.tsx` as `/dashboard/settings`).
- **Convention Boundary Files:** Correctly distinguishes user-facing pages (`page.*`) and route handlers (`route.*`) from layout and feedback boundaries (`layout.*`, `loading.*`, `error.*`, `not-found.*`, `template.*`).
- **Route Groups:** Segments enclosed in parentheses (e.g. `(marketing)`, `(auth)`) are successfully excluded from the public URL path. E.g., `app/(marketing)/pricing/page.tsx` maps to `/pricing`.
- **Parallel Route Slots:** Segments beginning with `@` (e.g. `@modal`, `@analytics`) are excluded from URL pathnames.
- **Private Folders:** Folders prefixed with `_` (e.g. `_components`, `_lib`) cause the entire directory subtree to be excluded from route manifest generation.
- **Dynamic Segments:**
  - Standard: `[id]` -> `:id`
  - Catch-all: `[...slug]` -> `*slug`
  - Optional catch-all: `[[...slug]]` -> `*slug?`
- **`src/` Prefix Support:** Operates identically when routes are located under `src/app/` or `app/`.

### 2.2 Pages Router Conventions
- **Page Resolution:** Correctly maps `pages/index.tsx` to `/`, `pages/contact.tsx` to `/contact`, and `pages/blog/index.tsx` to `/blog`.
- **Dynamic Segments:** Handles `pages/blog/[slug].tsx` and `pages/docs/[...slug].tsx`.
- **API Routes:** Identifies routes located under `pages/api/` as API endpoints (`isApi: true`, `kind: 'api'`).
- **Framework File Exclusion:** Properly excludes special files `pages/_app.tsx`, `pages/_document.tsx`, `pages/_error.tsx`, and `pages/_404.tsx`.

---

## 3. Detailed Edge Case Analysis & Findings

### Finding QA-M5-001: Collocated Dynamic Segments with Differing Parameter Names
- **Severity:** Medium
- **Affected File:** `src/core/routing/route-manifest.ts`, lines 103, 167–187, 248–268
- **Reproduction Scenario:**
  A project defines two dynamic route files at the same folder level with differing parameter names:
  1. `app/posts/[slug]/page.tsx`
  2. `app/posts/[id]/page.tsx`
- **Expected Behavior:**
  Next.js throws a build-time error ("You cannot define multiple slug names for the same dynamic route"). LaunchGuard should ideally report a route conflict.
- **Actual Behavior:**
  `buildRouteManifest` constructs `cleanUrl: '/posts/[slug]'` for the first file and `cleanUrl: '/posts/[id]'` for the second. Because the string keys in `pathToFileMap` differ, no collision is detected in `manifest.conflicts`.
- **Evidence:**
  `route-manifest.ts` groups routes strictly by string equality:
  ```typescript
  const existing = pathToFileMap.get(cleanUrl) || [];
  existing.push(routeDef);
  pathToFileMap.set(cleanUrl, existing);
  ```
- **Recommended Correction (Post-M5 / M7):**
  Normalize dynamic parameter placeholders during conflict evaluation (e.g., convert `[slug]` and `[id]` to a normalized wildcard `[:param]` when computing conflict keys).

---

### Finding QA-M5-002: Next.js Metadata Route Conventions
- **Severity:** Informational
- **Affected File:** `src/core/routing/route-manifest.ts`, line 130–136
- **Reproduction Scenario:**
  Project defines convention metadata files: `app/sitemap.ts`, `app/robots.ts`, or `app/favicon.ico`.
- **Expected Behavior:**
  Next.js serves these as routes (`/sitemap.xml`, `/robots.txt`).
- **Actual Behavior:**
  These files are not registered in `manifest.routes` because `fName !== 'page' && fName !== 'route'`.
- **Evidence:**
  ```typescript
  const isPage = fName === 'page';
  const isRouteHandler = fName === 'route';
  if (!isPage && !isRouteHandler) continue;
  ```
- **Assessment:**
  This is an intentional design boundary. LaunchGuard audits metadata files through dedicated rules (`seo/sitemap-missing`, `seo/robots-missing`). They are not user-facing interactive page routes and should not be targetable by `<Link>` components.

---

### Finding QA-M5-003: Intercepting Route Segments
- **Severity:** Low
- **Affected File:** `src/core/routing/route-manifest.ts`, lines 156–160
- **Reproduction Scenario:**
  App Router contains intercepting route conventions: `app/feed/(..)photo/[id]/page.tsx`.
- **Expected Behavior:**
  The intercepting route segment `(..)photo` represents an overlay route that intercepts `/photo/[id]`.
- **Actual Behavior:**
  The segment `(..)photo` is omitted from `urlSegments`, resolving to `/feed/[id]`.
- **Evidence:**
  ```typescript
  if (segment.startsWith('(.)') || segment.startsWith('(..)') || segment.startsWith('(...)')) {
    continue;
  }
  ```
- **Assessment:**
  Intercepting routes are advanced client-side UI overrides. Omission prevents erroneous path crashes, but does not construct the dual modal/direct URL mapping. This is an acceptable M5 limitation.
