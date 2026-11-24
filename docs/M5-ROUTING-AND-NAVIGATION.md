# LaunchGuard M5 — Routing & Navigation Audit Architecture

**Document Reference:** LG-M5-ARCH-001  
**Milestone:** M5 — Routing & Navigation Audit  
**Status:** Implemented & Verified  
**Date:** 2026-11-20  

---

## 1. Architectural Overview

Milestone M5 extends LaunchGuard's static analysis engine to perform comprehensive, offline inspection of Next.js internal application routing, link connectivity, and page discoverability. In accordance with LaunchGuard core principles:
- **Zero Runtime Dependencies:** Built strictly using native TypeScript and Node.js built-ins (`dependencies: {}`).
- **Zero Network Access (ADR-006):** Operates entirely offline without making network, DNS, registry, or telemetry requests.
- **Zero Code Execution (ADR-002):** Routes and links are extracted via safe static analysis, never importing or executing user project code.
- **Unified Engine Architecture (ADR-001):** Integrated directly into LaunchGuard's core pipeline without creating an external runner or separate CLI.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LaunchGuard M5 Routing Pipeline                      │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
      ┌──────────────────────┐        ┌──────────────────────┐
      │ Safe File Discovery  │        │  Project Descriptor  │
      └──────────────┬───────┘        └──────────┬───────────┘
                     │                           │
                     ▼                           ▼
      ┌──────────────────────────────────────────────────────┐
      │         M5-A: Static Route Manifest Builder          │
      │   - App Router (page.*, route.*, (groups), [slug])   │
      │   - Pages Router (index.*, [slug].*, api/*)          │
      │   - Conflict & Collision Detection                   │
      └──────────────────────────┬───────────────────────────┘
                                 │
                                 ├──────────────────────────────────┐
                                 ▼                                  ▼
      ┌──────────────────────────────────────┐           ┌────────────────────┐
      │     M5-B: Static Link Extractor      │           │    Rule Engine     │
      │  - JSX <Link href="...">             │           │  routing/          │
      │  - Anchor <a href="...">             │           │  route-conflict    │
      │  - Router Calls (push/replace)       │           │  (LG-RTE-R003)     │
      └──────────────────┬───────────────────┘           └────────────────────┘
                         │
                         ▼
      ┌──────────────────────────────────────┐
      │        M5-B: Route Matcher           │
      │  - Normalization (?, #, trailing /)  │
      │  - Static & Dynamic Param Resolution │
      │  - Indeterminate Classification      │
      └──────────────────┬───────────────────┘
                         │
                         ├──────────────────────────────────┐
                         ▼                                  ▼
      ┌──────────────────────────────────────┐   ┌────────────────────────────┐
      │   M5-C: Navigation Graph Builder     │   │        Rule Engine         │
      │  - Inbound Link Reference Counting   │   │  routing/broken-internal-  │
      │  - Static Reachability Mapping       │   │  link (LG-RTE-R001)        │
      └──────────────────┬───────────────────┘   └────────────────────────────┘
                         │
                         ▼
      ┌──────────────────────────────────────┐
      │             Rule Engine              │
      │  routing/orphaned-page (LG-RTE-R005) │
      └──────────────────────────────────────┘
```

---

## 2. Core Subsystems

### 2.1 M5-A: Static Route Manifest (`src/core/routing/route-manifest.ts`)
Discovers routes from the project structure and maps them into a deterministic manifest:
- **Router Support:** App Router (`app/`, `src/app/`) and Pages Router (`pages/`, `src/pages/`).
- **File Conventions:** Recognizes `page.*`, `layout.*`, `loading.*`, `error.*`, `not-found.*`, and `route.*`.
- **Dynamic Segments:**
  - Standard dynamic: `[id]` -> `:id`
  - Catch-all: `[...slug]` -> `*slug`
  - Optional catch-all: `[[...slug]]` -> `*slug?`
- **Route Groups & Folders:** Strips route groups `(marketing)` and parallel route slots `@modal` from public URL paths. Excludes private folders `_components`.
- **Route Collisions:** Detects overlapping paths (e.g. `(marketing)/pricing/page.tsx` and `(sales)/pricing/page.tsx`) and emits structured conflict records.

### 2.2 M5-B: Static Link Extractor (`src/core/routing/link-extractor.ts`)
Extracts internal navigation targets using linear-time, ReDoS-resistant patterns:
- **Target Patterns:**
  - Next.js `<Link href="...">`, `<Link href={'...'}>`, `<Link href={`...`}>`, `<Link href={variable}>`
  - HTML `<a href="...">`
  - Imperative navigation: `router.push(...)` and `router.replace(...)`
- **Linear-Time Indexing:** Uses `LineIndex` binary search to compute exact 1-based line and column offsets in $O(\log L)$ time, avoiding quadratic runtime on large source files.
- **Target Classification:**
  - `literal`: Statically verifiable local path (e.g. `"/pricing"`).
  - `dynamic-template`: Template literal with static prefix (e.g. `` `/products/${id}` ``).
  - `indeterminate`: Variable or runtime expression (e.g. `{targetUrl}`). Safely ignored for broken link reporting.
  - `external`: Protocol links (`http:`, `https:`, `//`).
  - `ignored`: Pseudo-protocols (`mailto:`, `tel:`, `javascript:`, `#`).

### 2.3 M5-B: Route Matcher (`src/core/routing/route-matcher.ts`)
Normalizes and resolves link targets against the route manifest:
- **Normalization:** Strips query strings (`?ref=nav`), URL fragments (`#top`), and trailing slashes. Resolves relative paths (`./contact`) against the referencing file's route context.
- **Matching Precedence:**
  1. Exact static match.
  2. Dynamic segment match (single parameter).
  3. Catch-all match (1 or more segments).
  4. Optional catch-all match (0 or more segments).
- **Conservative Precision:** Dynamic template expressions matching known dynamic prefixes are accepted without false positive warnings.

### 2.4 M5-C: Navigation Graph & Orphan Detection (`src/core/routing/navigation-graph.ts`)
Constructs an in-memory directed graph of project internal navigation:
- **Node Aggregation:** Every discovered route serves as a node with associated inbound link counters and referrer lists.
- **Orphan Criteria:** A page is classified as potentially orphaned if:
  1. It is a user-facing page route (`kind === 'page'`).
  2. It is not the root page (`path !== '/'`).
  3. It is not an API route (`isApi === false`).
  4. Total inbound internal links equal zero (`inboundCount === 0`).
- **Conservative Phrasing:** Findings are reported with informative wording: *"Potentially orphaned page: no statically detectable internal inbound links were found"*.

---

## 3. Registered Rules

| Rule ID | Candidate ID | Category | Severity | Confidence | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `routing/broken-internal-link` | `LG-RTE-R001` | `routing` | Medium | High | Statically detectable internal link targeting a non-existent route |
| `routing/orphaned-page` | `LG-RTE-R005` | `routing` | Low | Medium | User-facing page with zero statically detectable inbound internal links |
| `routing/route-conflict` | `LG-RTE-R003` | `routing` | High | High | Multiple route files colliding on identical public URL paths |

---

## 4. Verification & Testing

M5 includes 15 automated test suites:
- **11 Unit Tests (`tests/unit/routing.test.ts`):** Covering App Router, Pages Router, route groups, dynamic catch-alls, link classification, extraction, normalization, matching, navigation graph, and rule execution.
- **4 Adversarial Security Tests (`tests/adversarial/routing-adversarial.test.ts`):**
  - Path traversal and malicious link target resilience.
  - ReDoS resistance on 5,000 links in oversized JSX structures.
  - Deeply nested route hierarchies (25 levels).
  - Code execution prevention (ADR-002) and offline network isolation (ADR-006).

All 84 project tests pass with 91.86% line coverage and 0 TypeScript errors.
