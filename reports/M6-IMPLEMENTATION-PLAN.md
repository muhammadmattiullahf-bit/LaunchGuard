# LaunchGuard Milestone M6 — Structured Data & Schema Validation Implementation Plan

**Document Reference:** LG-M6-PLAN-001  
**Project:** LaunchGuard  
**Target Version:** v0.1.0  
**Milestone:** M6 — Structured Data & Schema Validation  
**Primary Authorization:** LG-M6-AUTH-001  
**Additional Authorization:** LG-M6-DB-ADDENDUM-001  
**Date:** 2026-11-24  
**Status:** Approved for Implementation  
**Baseline Documents:** `DOC-001` (Sections 14.8, 15, 20), ADR-001 through ADR-007, `LG-M5-CLOSE-001`, `LG-M6-BASE-001`  

---

## 1. Executive Summary & Existing Functionality Assessment

Milestone M6 introduces reliable, local, static inspection of structured data (JSON-LD) embedded within Next.js source code without executing application code, backed by a lightweight, bundled, versioned **Local Schema Knowledge Base**.

### Baseline Verification (per `LG-M6-BASE-001`):
- All 100 existing automated tests pass cleanly (`npm test`).
- TypeScript compiler passes with 0 errors and 0 warnings under strict settings.
- Rule registry contains exactly 34 rules (27 MVP rules + 3 M5 routing rules + 4 initial M6 structured data rules).
- Zero external runtime dependencies (`dependencies: {}`).
- Zero network requests (100% offline).

---

## 2. Precise M6 Scope & Requirements

### 2.1 JSON-LD Discovery Scope
- Traverses Next.js project source files (`.tsx`, `.ts`, `.jsx`, `.js`) in `app/`, `src/app/`, `pages/`, `src/pages/`, and components.
- Discovers:
  1. Standard `<script type="application/ld+json">` tags with literal JSON content.
  2. Next.js idiomatic `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: '...' }} />` and inverted attribute variations.
  3. `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }} />` with static or dynamic objects.
  4. JSX template literals `<script type="application/ld+json">{`{...}`}</script>`.
  5. Multiple JSON-LD script tags within a single file.
  6. Top-level objects, top-level arrays, and `@graph` containers.
  7. Accurate source location tracking (file, start line, end line, column, block index) in $O(\log L)$ time via binary search.

### 2.2 JSON-LD Safe Parsing Scope
- Safe, bounded JSON parsing with memory limits (2MB per block) and recursion depth limits (32 levels).
- Syntax error detection (missing braces, missing commas, trailing commas, unexpected tokens).
- Top-level array and `@graph` flattening with automatic `@context` inheritance to child entities.
- Error localization mapping V8 parse positions back to exact file line/column coordinates.

### 2.3 Local Schema Knowledge Base Architecture (`src/knowledge/schema/`)
Per Authorization `LG-M6-DB-ADDENDUM-001`, M6 introduces a bundled, deterministic, versioned Schema Knowledge Base:
- **Zero Database Server:** No Postgres, MySQL, MongoDB, Supabase, or remote database. Zero SQLite. Pure bundled local data modules.
- **Resource Organization:**
  - `vocabulary-version.json`: Vocabulary version (`Schema.org v28.1`), specification date, license, and hash.
  - `schema-types.json`: Core candidate types (`Organization`, `LocalBusiness`, `PostalAddress`, `WebSite`, `WebPage`, `Service`, `Product`, `BreadcrumbList`, `FAQPage`, `Article`, `Person`, `ImageObject`), parent type relationships (inheritance), supported properties, required/recommended properties, validation metadata.
  - `schema-properties.json`: Property definitions, expected value types (e.g. `Text`, `URL`, `Array`, `Organization`, `PostalAddress`), description.
  - `property-value-types.json`: Value type definitions and structural validation specifications (`Text`, `URL`, `Date`, `Integer`, `Float`, `Boolean`, `Array`, `Object`).
  - `schema-knowledge-base.ts`: Typesafe singleton reader, query API, inheritance resolver, and validation methods.
- **Inheritance Resolution:** Resolves inherited properties from parent types (e.g., `LocalBusiness` inherits from `Organization`; `Article` inherits from `CreativeWork`).
- **Separation of Concerns:** Knowledge data is kept cleanly decoupled from rule execution logic.

### 2.4 Structured Data Validation Scope
- Context validation: `@context` required, must be `https://schema.org` (or `http://schema.org`). Flags invalid protocols, wrong domains, empty values.
- Type validation: `@type` required, non-empty, checks against Knowledge Base vocabulary. Distinguishes unknown types from invalid types.
- Property validation: Validates presence of recommended properties for rich results without flagging optional properties as errors.
- Value type validation: Enforces correct types for high-impact properties (e.g. `itemListElement` must be an array; `offers` must be an object/array).
- Empty entity/property detection: Objects `{}` or empty values `""` cleanly flagged.

### 2.5 Dynamic JSON-LD Handling (Security Boundary)
- Detection of runtime variables or function calls (e.g. `JSON.stringify(props.data)`).
- Marked as `indeterminate` with low confidence / informational status; never execute target code (ADR-002).

---

## 3. M6 Rule Registry & Classifications

The M6 rules belong to the `structured-data` category with `releaseClass: 'post-mvp'`:

| Rule ID | Candidate ID | Category | Severity | Confidence | Release Class | Description |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `structured-data/invalid-json-ld` | `LG-SDT-R001` | `structured-data` | Medium | High | `post-mvp` | A `<script type="application/ld+json">` tag contains invalid JSON syntax that cannot be parsed. |
| `structured-data/missing-context-or-type` | `LG-SDT-R002` | `structured-data` | Low | High | `post-mvp` | A JSON-LD entity or `@graph` item lacks a valid `@context` or `@type` declaration. |
| `structured-data/missing-required-property` | `LG-SDT-R003` | `structured-data` | Low | Medium | `post-mvp` | A supported Schema.org entity is missing standard recommended properties for rich results. |
| `structured-data/schema-syntax-error` | `LG-SDT-R004` | `structured-data` | Medium | High | `post-mvp` | A structured data block contains an empty entity, malformed `@graph`, or invalid property value type. |

Total registered rules: **34** (27 original MVP rules + 3 M5 routing rules + 4 M6 structured data rules).

---

## 4. Planned File & Directory Structure

```
src/
├── knowledge/
│   └── schema/
│       ├── vocabulary-version.json       # Version metadata (Schema.org v28.1)
│       ├── schema-types.json             # Core types, parent types, recommended props
│       ├── schema-properties.json        # Supported properties and expected value types
│       ├── property-value-types.json     # Value type validation definitions
│       ├── schema-knowledge-base.ts      # KB reader, cache singleton, inheritance resolver
│       └── index.ts                      # Barrel export
├── core/
│   └── structured-data/
│       ├── jsonld-extractor.ts           # Discovery and extraction
│       ├── jsonld-parser.ts              # Bounded JSON parsing & error locator
│       ├── schema-validator.ts           # Validator leveraging SchemaKnowledgeBase
│       └── index.ts                      # Barrel export
└── rules/
    └── structured-data/
        └── structured-data-rules.ts      # 4 audit rules (LG-SDT-R001 to R004)
tests/
├── unit/
│   ├── structured-data.test.ts           # Unit tests for discovery, parsing, rules
│   └── schema-knowledge-base.test.ts     # Dedicated tests for KB loader, inheritance, data integrity
└── adversarial/
    └── structured-data-adversarial.test.ts # ReDoS, oversized payloads, code execution, offline isolation
```

---

## 5. Security & Architectural Invariant Conformance

- **ADR-001 (Single Package):** Fully integrated in core package, zero npm dependencies added (`dependencies: {}`).
- **ADR-002 (Zero Code Execution):** All extraction is static text/regex. Dynamic code is never evaluated.
- **ADR-006 (Zero Network Access):** 100% offline. Knowledge Base is bundled locally. Zero outbound network calls.
- **ADR-007 (Fault Isolation):** Per-rule error capture. Malformed JSON-LD in one block never crashes the audit.
- **Resource Exhaustion Defense:** Max 2MB block limit, max 32 nesting levels, linear-time line indexing.

---

## 6. Test Strategy

1. **Schema Knowledge Base Tests (`tests/unit/schema-knowledge-base.test.ts`):**
   - Verify deterministic loading of version metadata (`Schema.org v28.1`).
   - Verify all 12 candidate types are loaded with correct parent inheritance chains.
   - Verify property definition lookups and inheritance (`LocalBusiness` inherits `name` from `Organization`).
   - Verify unknown types and properties return clear `isUnknown` flags rather than errors.
   - Verify resilience against corrupted or missing local data files.
2. **Structured Data Unit Tests (`tests/unit/structured-data.test.ts`):**
   - Discovery across standard, dangerouslySetInnerHTML, inverted attribute, and template literal patterns.
   - Safe parsing of valid, malformed, truncated, and empty JSON-LD blocks.
   - Schema validation with context, type, required properties, and property types.
   - Complete rule execution of all 4 rules across Next.js fixtures.
3. **Adversarial Security Tests (`tests/adversarial/structured-data-adversarial.test.ts`):**
   - ReDoS resistance against 2,000+ pathological tags.
   - 500KB oversized payloads parsed safely within bounds.
   - 30-level deep nesting handled cleanly.
   - Target code execution defense (payloads with malicious scripts).
   - Strict offline isolation (monkey-patched network sockets).
4. **Full Regression Suite:**
   - 27 MVP rules, 3 M5 routing rules, CLI, reporters, and scoring engine.

---

## 7. Known Limitations & Technical Debt (for Documentation)

1. **QA-M6-001 (Low Severity) — Regex Comment Extraction:**
   - Script tags inside JSX or JavaScript comments (`{/* <script type="application/ld+json"> */}`) are extracted by regex if unstripped.
2. **QA-M6-002 (Low Severity) — Indeterminate Dynamic Payloads:**
   - Dynamic variable references (`JSON.stringify(schemaData)`) are marked as indeterminate to avoid false positives, but cannot be statically validated (ADR-002).
3. **QA-M6-003 (Informational) — Local Schema Scope:**
   - Built-in offline validation targets high-impact Schema.org types; uncommon types validate general syntax and `@context`, but do not have type-specific required property checks.
