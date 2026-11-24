# LaunchGuard M6 — Structured Data & Schema Validation Architecture

**Document Reference:** LG-M6-ARCH-001  
**Milestone:** M6 — Structured Data & Schema Validation  
**Authorizations:** LG-M6-AUTH-001, LG-M6-DB-ADDENDUM-001  
**Status:** Implemented, Reconciled & Verified  
**Date:** 2026-11-24  

---

## 1. Architectural Overview

Milestone M6 extends LaunchGuard's static analysis engine to inspect JSON-LD structured data and Schema.org markup embedded in Next.js applications, supported by a bundled, versioned **Local Schema Knowledge Base**.

The design strictly upholds LaunchGuard core principles:
- **Zero Runtime Dependencies:** Built strictly using native TypeScript and Node.js built-ins (`dependencies: {}`).
- **Zero Network Access (ADR-006):** Operates 100% offline. Remote `@context` URLs (e.g. `https://schema.org`) are validated as strings, never fetched over the network.
- **Zero Code Execution (ADR-002):** Target files are parsed statically. Dynamic application code, functions, and runtime expressions are never executed. Indeterminate expressions (`JSON.stringify(dynamicData)`) are marked `indeterminate` without evaluation.
- **Zero Database Servers:** No Postgres, MySQL, MongoDB, Supabase, or SQLite. Pure bundled JSON data modules and an in-memory cached reader.
- **Unified Single-Package Engine (ADR-001):** Implemented within the core engine and rule registry without standalone CLIs or external runners.

```
┌────────────────────────────────────────────────────────────────────────┐
│               LaunchGuard M6 Structured Data Pipeline                  │
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
      │         M6-A: Static JSON-LD Block Extractor         │
      │   - <script type="application/ld+json">              │
      │   - dangerouslySetInnerHTML={{ __html: ... }}       │
      │   - Binary-search LineIndex (O(log L))               │
      │   - Classification: literal / empty / indeterminate  │
      └──────────────────────────┬───────────────────────────┘
                                 │
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │           M6-B: Bounded JSON-LD Parser               │
      │   - Syntax error detection                           │
      │   - Root shape validation (object / array / @graph)  │
      │   - Entity extraction & inherited context resolution │
      └──────────────────────────┬───────────────────────────┘
                                 │
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │         M6-C: Local Schema Knowledge Base            │
      │   - src/knowledge/schema/ (Schema.org v28.1)         │
      │   - 12 candidate core types + type inheritance       │
      │   - Property definitions & structural categories     │
      └──────────────────────────┬───────────────────────────┘
                                 │
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │          M6-D: Local Schema.org Validator            │
      │   - @context and @type validation                    │
      │   - Recommended property checks (supported types)    │
      │   - Property structural category checks              │
      └──────────────────────────┬───────────────────────────┘
                                 │
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │                    M6 Rule Suite                     │
      │  - structured-data/invalid-json-ld         (R001)    │
      │  - structured-data/missing-context-or-type (R002)    │
      │  - structured-data/missing-required-prop   (R003)    │
      │  - structured-data/schema-syntax-error     (R004)    │
      └──────────────────────────────────────────────────────┘
```

---

## 2. Core Subsystems

### 2.1 JSON-LD Discovery (`src/core/structured-data/jsonld-extractor.ts`)
- Statically identifies `<script type="application/ld+json">` tags across supported Next.js file extensions (`.tsx`, `.ts`, `.jsx`, `.js`).
- Handles direct text children, JSX expressions (`{`...`}`), and `dangerouslySetInnerHTML`.
- Handles both standard and inverted attribute ordering.
- Filters self-closing tags via negative lookbehind `(?<!\/)>`.
- Identifies indeterminate expressions (e.g. `JSON.stringify(dynamicVar)`) and marks them as `indeterminate` to prevent speculative false-positive findings.
- Uses `LineIndex` to calculate 1-based line and column offsets in $O(\log L)$ time.

### 2.2 JSON-LD Parsing (`src/core/structured-data/jsonld-parser.ts`)
- Bounded parsing of JSON text with 2MB block size limit and 32-level recursion depth limit.
- Captures exact parse error details on syntax failures and maps V8 positions back to file lines and columns.
- Normalizes single entity objects, top-level entity arrays, and `@graph` containers into uniform `SchemaEntity` items.
- Resolves inherited `@context` from container root objects to member entities.

### 2.3 Local Schema Knowledge Base (`src/knowledge/schema/`)
Per Authorization `LG-M6-DB-ADDENDUM-001`, a bundled, offline, versioned knowledge base provides schema vocabulary:
- **`vocabulary-version.json`:** Tracks Schema.org version `28.1`.
- **`schema-types.json`:** Defines core candidate types (`Organization`, `LocalBusiness`, `PostalAddress`, `WebSite`, `WebPage`, `Service`, `Product`, `BreadcrumbList`, `FAQPage`, `Article`, `Person`, `ImageObject`) and parent-child inheritance hierarchies.
- **`schema-properties.json`:** Supported property definitions and expected types.
- **`property-value-types.json`:** Category mappings (primitive vs structural).
- **`schema-knowledge-base.ts`:** Cached singleton providing inheritance resolution (`isSubtypeOf`), property aggregation (`getAllPropertiesForType`), validation rules retrieval (`getTypeValidationRules`), and structural validation (`validatePropertyStructuralCategory`).

### 2.4 Schema Consistency & Validation (`src/core/structured-data/schema-validator.ts`)
- Validates `@context` protocol (`https://schema.org`).
- Validates `@type` is declared and non-empty.
- Evaluates supported types against Knowledge Base rules.
- Clearly distinguishes between:
  1. Syntax/fatal errors (`invalid-json-ld`, `empty-entity`).
  2. Protocol/vocabulary errors (`missing-context-or-type`, `invalid-context`).
  3. Quality/completeness advisories (`missing-required-property`).

---

## 3. Registered Rules

| Rule ID | Candidate ID | Category | Severity | Confidence | Release Class | Description |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `structured-data/invalid-json-ld` | `LG-SDT-R001` | `structured-data` | Medium | High | `post-mvp` | Detects syntax errors, malformed JSON, and truncated payloads in JSON-LD script blocks. |
| `structured-data/missing-context-or-type` | `LG-SDT-R002` | `structured-data` | Low | High | `post-mvp` | Detects absence of mandatory `@context` or `@type` declarations. |
| `structured-data/missing-required-property` | `LG-SDT-R003` | `structured-data` | Low | Medium | `post-mvp` | Advises on missing recommended properties for rich results per Schema Knowledge Base. |
| `structured-data/schema-syntax-error` | `LG-SDT-R004` | `structured-data` | Medium | High | `post-mvp` | Flags empty entities, malformed `@graph` arrays, and structural category mismatches. |
