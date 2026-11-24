# LaunchGuard — M5 Link Detection & Matching Test Report

**Document Reference:** LG-M5-REP-003  
**Target:** LaunchGuard v0.1.0  
**Milestone:** M5 — Routing & Navigation Audit  
**Date:** 2026-11-20  
**Status:** Verification Passed  
**Author:** Software Architecture & QA Team  

---

## 1. Scope & Objective

This report validates the static link extraction (`src/core/routing/link-extractor.ts`), classification, and route matching (`src/core/routing/route-matcher.ts`) subsystems. The verification ensures that internal navigation targets are discovered accurately without executing code and that link targets are matched against the route manifest without false positives.

---

## 2. Test Cases & Verification Results

### 2.1 Safe Static Link Extraction
- **Test Target:** `tests/unit/routing.test.ts` ("Link Extractor: Extracts JSX <Link>, anchor tags, and router calls")
- **Syntax Variants Tested:**
  1. `<Link href="/about">About Us</Link>` -> Target: `/about`, Kind: `link-component`, Classification: `literal`
  2. `<Link href={'/contact'}>Contact</Link>` -> Target: `/contact`, Kind: `link-component`, Classification: `literal`
  3. `<Link href={`/products/${id}`}>Product</Link>` -> Kind: `link-component`, Classification: `dynamic-template`, Prefix: `/products/`
  4. `<Link href={userUrl}>User</Link>` -> Kind: `link-component`, Classification: `indeterminate`
  5. `<a href="/pricing">Pricing</a>` -> Target: `/pricing`, Kind: `anchor-tag`, Classification: `literal`
  6. `<a href="https://external.com">External</a>` -> Classification: `external`
  7. `<a href="mailto:support@test.com">Email</a>` -> Classification: `ignored`
  8. `router.push('/dashboard')` -> Target: `/dashboard`, Kind: `router-call`, Classification: `literal`
  9. `router.replace('/logout')` -> Target: `/logout`, Kind: `router-call`, Classification: `literal`
- **Result:** **PASS**. 9/9 targets extracted with exact line, column, and kind metadata.

### 2.2 Link Target Classification
- **Test Target:** `tests/unit/routing.test.ts` ("Link Classification: Correctly categorizes external, ignored, and internal targets")
- **Scenarios Evaluated:**
  - `https://external.com` -> `external`
  - `mailto:test@example.com` -> `ignored`
  - `#section` -> `ignored`
  - `/dashboard` -> `literal`
- **Result:** **PASS**. Classification operates cleanly and avoids false positives on non-internal URLs.

### 2.3 URL Normalization
- **Test Target:** `tests/unit/routing.test.ts` ("Route Matcher: Normalizes targets with query strings, hashes, and trailing slashes")
- **Scenarios Evaluated:**
  - Query Strings: `/about?ref=nav#top` -> Normalized to `/about`
  - Trailing Slash: `/pricing/` -> Normalized to `/pricing`
  - Root: `/` -> Preserved as `/`
  - Bare Path: `about` -> Normalized to `/about`
  - Relative Path Resolution: `./contact` from `app/team/page.tsx` -> Normalized to `/team/contact`
- **Result:** **PASS**. Normalization guarantees uniform path comparisons.

### 2.4 Route Matching Engine
- **Test Target:** `tests/unit/routing.test.ts` ("Route Matcher: Matches static and dynamic routes accurately")
- **Scenarios Evaluated:**
  - Exact static match: `/about` against `app/about/page.tsx` -> `matched: true`
  - Standard dynamic parameter: `/products/widget-42` against `app/products/[id]/page.tsx` -> `matched: true`
  - Catch-all multi-segment: `/blog/2026/11/release-notes` against `app/blog/[...slug]/page.tsx` -> `matched: true`
  - Optional catch-all zero-segment: `/shop` against `app/shop/[[...slug]]/page.tsx` -> `matched: true`
  - Broken link target: `/does-not-exist` against manifest -> `matched: false`, `isIndeterminate: false`
- **Result:** **PASS**. Correctly resolves both static and dynamic routes.

### 2.5 Indeterminate & Template Literal Handling
- **Test Target:** `tests/unit/routing.test.ts` ("Route Matcher: Handles dynamic template literals and edge cases")
- **Scenarios Evaluated:**
  - Dynamic template literal with known prefix matching dynamic route (`/products/${id}`) -> Matched safely to `/products/[id]`.
  - Dynamic template literal with unknown prefix -> Flagged as indeterminate (`isIndeterminate: true`) rather than emitting a false positive broken link finding.
  - Variable expression (`<Link href={dynamicUrl}>`) -> Flagged as indeterminate.
  - External and ignored links -> Automatically resolved as non-broken.
- **Result:** **PASS**. Eliminates false positive alerts for dynamic code patterns.

---

## 3. Summary

The link extraction and matching engines achieve **97.13% line coverage** for `link-extractor.ts` and **97.02% line coverage** for `route-matcher.ts`. Static link verification operates with zero runtime dependencies.
