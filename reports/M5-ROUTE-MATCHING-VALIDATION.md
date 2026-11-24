# LaunchGuard — M5 Route Matching & Navigation Graph Validation Report

**Document Reference:** LG-QA-M5-004  
**Target:** `src/core/routing/route-matcher.ts` & `src/core/routing/navigation-graph.ts`  
**Audit Date:** 2026-11-20  
**Status:** Audit Complete  
**Auditor:** Independent Software QA & Architecture Audit Team  

---

## 1. Scope of Audit

This report validates the route matching engine (`src/core/routing/route-matcher.ts`) and static navigation graph builder (`src/core/routing/navigation-graph.ts`). The verification covers URL normalization, dynamic parameter matching, conservative handling of indeterminate targets, and orphan detection.

---

## 2. Verified Capabilities

### 2.1 URL Normalization
- **Query Strings:** Strips query strings cleanly (e.g. `/products?category=books` -> `/products`).
- **Fragments:** Strips hash fragments (e.g. `/docs#installation` -> `/docs`).
- **Trailing Slashes:** Strips trailing slashes from all non-root paths (e.g. `/about/` -> `/about`), while preserving `/` for root.
- **Relative Paths:** Correctly resolves relative paths (e.g. `./contact` in `app/team/page.tsx` resolves to `/team/contact`).

### 2.2 Route Matching Precedence
- **Static Match:** Direct exact match takes precedence over dynamic matching.
- **Dynamic Segment Match:** Single parameter `[id]` matches any single segment (e.g. `/products/123` matches `/products/[id]`).
- **Catch-All Match:** `[...slug]` matches one or more segments (e.g. `/blog/2026/11/post` matches `/blog/[...slug]`).
- **Optional Catch-All Match:** `[[...slug]]` matches zero or more segments (e.g. both `/shop` and `/shop/shoes` match `/shop/[[...slug]]`).

### 2.3 Indeterminate Targets Defense
- **Dynamic Variable Hrefs:** Expressions like `<Link href={targetUrl}>` are classified as `indeterminate`.
- **Match Result:** `matchLinkToRoute` marks `isIndeterminate: true`.
- **Rule Protection:** `routingBrokenInternalLinkRule` explicitly checks `if (!match.matched && !match.isIndeterminate)` before creating findings.
- **Guarantee:** **Uncertain or dynamic targets NEVER produce false-positive broken link findings.**

### 2.4 Navigation Graph & Orphan Detection
- **Inbound Counting:** Accurately counts all incoming static internal links per route.
- **Duplicate Links:** Preserves multiple links to the same destination in `inboundReferences` while incrementing `inboundCount`.
- **Special Route Exclusions:** Excludes root `/`, `/not-found`, `/_not-found`, `/error`, `/404`, and `/500` from orphan status.
- **API Exclusions:** All routes where `isApi: true` are excluded from orphan status.
- **Advisory Classification:** Rule `routing/orphaned-page` is assigned `severity: 'low'`, `confidence: 'medium'`, and conservative phrasing: *"Potentially orphaned page: no statically detectable internal inbound links were found"*.

---

## 3. Detailed Edge Case Analysis & Findings

### Finding QA-M5-006: URL-Encoded Link Targets
- **Severity:** Low
- **Affected File:** `src/core/routing/route-matcher.ts`, lines 18–58
- **Reproduction Scenario:**
  A link contains URL-encoded characters:
  ```tsx
  <Link href="/about%20us">About</Link>
  ```
  The corresponding App Router directory is `app/about us/page.tsx`.
- **Expected Behavior:**
  Next.js decodes `%20` to a space during route routing. The link should match `app/about us/page.tsx`.
- **Actual Behavior:**
  `normalizeLinkTarget` does not call `decodeURIComponent()`. `normalizedPath` remains `"/about%20us"`, while the manifest route path is `"/about us"`. The matcher fails to match, flagging a broken link.
- **Evidence:**
  `normalizeLinkTarget` performs query/fragment stripping, but does not perform URI decoding:
  ```typescript
  export function normalizeLinkTarget(target: string, sourceFile?: string): string { ... }
  ```
- **Recommended Correction (Post-M5 / M7):**
  Add safe `decodeURIComponent` (wrapped in `try/catch` to handle malformed sequences) inside `normalizeLinkTarget`.

---

### Finding QA-M5-007: Programmatic & Dynamic Navigation Untraceable
- **Severity:** Informational
- **Affected File:** `src/core/routing/navigation-graph.ts`, lines 56–74
- **Reproduction Scenario:**
  A page (e.g. `/checkout/success`) is only reached via programmatic redirects (`redirect('/checkout/success')` in a Server Action or `router.push(paymentResult.redirectUrl)`).
- **Expected Behavior:**
  Static analysis should acknowledge that programmatic navigation cannot be guaranteed complete without dynamic tracing.
- **Actual Behavior:**
  The page has 0 statically detectable `<Link>` or literal `router.push()` references, so it is reported as potentially orphaned.
- **Assessment:**
  The M5 implementation correctly anticipates this limitation:
  1. The finding title explicitly states: *"Potentially orphaned page: ... has no inbound internal links"*.
  2. The description clarifies: *"The page may be unreachable or only accessible via external or dynamic navigation"*.
  3. The rule severity is set to `low` and confidence to `medium`.
  This is a verified and appropriate design choice for static analysis.
