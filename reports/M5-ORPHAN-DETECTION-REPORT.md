# LaunchGuard — M5 Navigation Graph & Orphan Detection Report

**Document Reference:** LG-M5-REP-004  
**Target:** LaunchGuard v0.1.0  
**Milestone:** M5 — Routing & Navigation Audit  
**Date:** 2026-11-20  
**Status:** Verification Passed  
**Author:** Software Architecture & QA Team  

---

## 1. Scope & Objective

This report documents the validation of the static navigation graph builder and orphaned page detection subsystem (`src/core/routing/navigation-graph.ts`) and associated audit rule `routing/orphaned-page` (LG-RTE-R005).

The goal is to verify that LaunchGuard constructs a directed internal navigation graph, correctly calculates inbound link counts, and identifies user-facing pages that have no internal links, while strictly adhering to conservative reporting principles.

---

## 2. Test Cases & Verification Results

### 2.1 Navigation Graph Construction
- **Test Target:** `tests/unit/routing.test.ts` ("Navigation Graph & Orphan Detection: Identifies unlinked pages conservatively")
- **Scenarios Evaluated:**
  - Discovered Routes:
    - `app/page.tsx` (`/`)
    - `app/about/page.tsx` (`/about`)
    - `app/orphaned/page.tsx` (`/orphaned`)
    - `app/api/data/route.ts` (`/api/data`)
  - Internal Links:
    - `<Link href="/about">About</Link>` from `app/page.tsx`
  - Inbound Link Calculation:
    - `/about`: `inboundCount === 1`, `referrers: ['app/page.tsx']`, `isOrphaned === false`
    - `/`: `inboundCount === 0`, `isOrphaned === false` (Root page is intentionally exempt from orphan classification)
    - `/api/data`: `isOrphaned === false` (API routes are intentionally exempt from orphan classification)
    - `/orphaned`: `inboundCount === 0`, `isOrphaned === true`
- **Result:** **PASS**. Graph nodes, edges, and inbound reference counts computed accurately.

### 2.2 Conservative Orphan Exclusion Principles
1. **Root Page Exclusion:** The root route `/` represents the default landing page and does not require an inbound link from child pages.
2. **API Route Exclusion:** Server-side route handlers (`route.ts`) and Pages Router API routes (`pages/api/*`) are consumed programmatically via `fetch()` or external consumers; they are not expected to be linked via `<Link>` or `<a>`.
3. **Single-Page Application Guard:** If a project has only a root page (or 0 pages), orphaned page detection is disabled to prevent spurious warnings.
4. **Advisory Severity & Confidence:** The rule uses `severity: 'low'` and `confidence: 'medium'` to reflect the static nature of the analysis.
5. **Conservative Phrasing:** Findings are reported with advisory wording:
   > *"Potentially orphaned page: no statically detectable internal inbound links were found"*

### 2.3 Rule Execution Verification
- **Test Target:** `tests/unit/routing.test.ts` ("M5 Rules: Broken link, orphaned page, and route conflict rules execute properly")
- **Finding Properties Verified:**
  - Severity: `low`
  - Confidence: `medium`
  - Evidence Anchor: Deterministic anchor format `orphaned-page-/isolated`
  - Target Path: Points directly to the isolated page file `app/isolated/page.tsx:1`.
- **Result:** **PASS**. Emits exactly 1 finding for unlinked page `/isolated`.

---

## 3. Summary

The navigation graph module achieves **98.00% line coverage** and **92.31% branch coverage**. Orphan detection operates conservatively and deterministically across all tested scenarios.
