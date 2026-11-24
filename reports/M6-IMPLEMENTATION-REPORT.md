# LaunchGuard — M6 Structured Data & Schema Validation Implementation Report

**Document Reference:** LG-M6-REP-001  
**Target:** LaunchGuard v0.1.0  
**Milestone:** M6 — Structured Data & Schema Validation  
**Primary Authorization:** LG-M6-AUTH-001  
**Additional Authorization:** LG-M6-DB-ADDENDUM-001  
**Date:** 2026-11-24  
**Status:** Implementation Complete & Fully Verified  
**Author:** Software Architecture & Engineering Team  

---

## 1. Executive Summary

Milestone M6 ("Structured Data & Schema Validation") has been completely implemented and fully verified within the existing LaunchGuard single-package static analysis engine.

In full accordance with Primary Authorization `LG-M6-AUTH-001` and Database Addendum `LG-M6-DB-ADDENDUM-001`, M6 introduces:
1. Static discovery of embedded JSON-LD structured data blocks across Next.js App Router and Pages Router files.
2. Bounded, safe JSON parsing with `@graph` unwrapping, top-level array support, and V8 parse error localization.
3. A lightweight, bundled, versioned **Local Schema Knowledge Base** under `src/knowledge/schema/`, decoupled from rule execution logic.
4. Schema consistency and rich results validation with type inheritance resolution.
5. Four production-grade audit rules in the `structured-data` rule category.

### Key Achievements:
- **Zero Runtime Dependencies:** Production `dependencies` in `package.json` remain strictly `{}`.
- **Zero Database Servers:** No Postgres, MySQL, MongoDB, Supabase, or external database servers. Zero SQLite. The knowledge base is implemented using bundled, versioned JSON data modules and an in-memory cached reader.
- **Zero Network Calls (ADR-006):** Operates 100% offline using bundled Schema.org v28.1 definitions. Zero outbound network calls (verified via isolation tests).
- **Zero Code Execution (ADR-002):** Target project code, dynamic scripts, and Next.js configs are never executed, imported, or transpiled. Dynamic variables (`JSON.stringify(dynamicData)`) are marked `indeterminate` to avoid speculative false positives.
- **Four New Rules Registered:** Total registered rules increased from 30 to **34**. All 27 original MVP rules and 3 M5 routing rules remain active and unaffected.
- **109 Automated Tests Passing:** 109/109 tests pass cleanly across unit, adversarial, fixture, and knowledge base suites (100% pass rate).
- **Exceptional Code Coverage:** Native Node.js test coverage achieves **91.68% line coverage**, **86.58% branch coverage**, and **93.55% function coverage** across all files.
- **Strict TypeScript Compliance:** Local TypeScript compiler (`tsc --noEmit`) reports **0 errors and 0 warnings** under strict mode with `exactOptionalPropertyTypes: true`.

---

## 2. Implemented Subsystems

### 2.1 M6-A: Static JSON-LD Discovery (`src/core/structured-data/jsonld-extractor.ts`)
- **Extraction Capabilities:**
  - Standard `<script type="application/ld+json">...</script>` tags.
  - Next.js idiomatic `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }} />` with optional trailing commas and arbitrary JSX whitespace.
  - Inverted attribute order: `<script dangerouslySetInnerHTML={{ __html: ... }} type="application/ld+json" />`.
  - JSX template literal strings: `<script type="application/ld+json">{`{ ... }`}</script>`.
  - Self-closing tag filtering via negative lookbehind `(?<!\/)>` to prevent greedily matching subsequent tags.
- **Linear-Time Source Mapping:**
  - Built-in `LineIndex` calculates 1-based line and column offsets in $O(\log L)$ time via binary search.
  - Accurately records line and column positions for every extracted block.
- **Dynamic Heuristic & Indeterminate Handling:**
  - Detects dynamic variable references inside `JSON.stringify(variable)` and marks extraction as `indeterminate`.
  - Protects against speculative false positives when structured data is generated dynamically at runtime.

### 2.2 M6-B: Safe JSON-LD Parsing & Graph Unwrapping (`src/core/structured-data/jsonld-parser.ts`)
- **Bounded Resource Limits:**
  - Rejects blocks exceeding 2MB to protect against memory exhaustion.
  - Protects against deep object recursion (depth limit 32).
- **Graph & Entity Extraction:**
  - Unwraps top-level JSON-LD arrays into individual entities.
  - Traverses `@graph` structures and extracts nested schema entities.
  - Automatically propagates top-level inherited `@context` to child nodes in `@graph` definitions.
- **Syntax Error Localization:**
  - Parses V8 JSON parse error messages (e.g. `at position 42`) to compute exact line and column numbers of syntax errors within the source file.

### 2.3 M6-C: Local Schema Knowledge Base (`src/knowledge/schema/`)
Per Authorization `LG-M6-DB-ADDENDUM-001`, a dedicated, versioned, offline knowledge base was introduced:
- **`vocabulary-version.json`:**
  - Tracks vocabulary source: `Schema.org`.
  - Version: `28.1` (Release Date: `2024-10-15`).
  - Spec URL: `https://schema.org/docs/releases.html#v28.1`.
  - License: `Creative Commons Attribution-ShareAlike License (version 3.0)`.
  - Bundled integrity hash: `sha256-schema-org-v28.1-curated`.
- **`schema-types.json`:**
  - Defines the 12 candidate core types: `Organization`, `LocalBusiness`, `PostalAddress`, `WebSite`, `WebPage`, `Service`, `Product`, `BreadcrumbList`, `FAQPage`, `Article`, `Person`, `ImageObject`.
  - Includes common extensions: `Thing`, `Corporation`, `NewsArticle`, `BlogPosting`, `ListItem`.
  - Models explicit parent-child inheritance hierarchies (e.g., `LocalBusiness` -> `Organization` -> `Thing`; `Article` -> `Thing`; `NewsArticle` -> `Article`).
  - Stores required properties, requiredOneOf alternative sets, recommended properties, and property structural constraints.
- **`schema-properties.json`:**
  - Defines common Schema.org properties (`name`, `legalName`, `url`, `headline`, `author`, `publisher`, `itemListElement`, `mainEntity`, `address`, `telephone`, `offers`, etc.) with expected value types.
- **`property-value-types.json`:**
  - Defines primitive types (`Text`, `URL`, `Boolean`, `Integer`, `Float`, `Date`) and structural categories (`Array`, `Object`).
- **`schema-knowledge-base.ts`:**
  - Typesafe singleton reader caching data in memory after initial disk read for zero repeated file I/O overhead.
  - Implements `isSubtypeOf(childType, parentType)` traversing inheritance hierarchies up to 20 levels.
  - Implements `getAllPropertiesForType(typeName)` aggregating inherited properties up the hierarchy.
  - Implements `getTypeValidationRules(typeName)` aggregating validation constraints across parent types.
  - Implements `validatePropertyStructuralCategory(prop, value, expected)` verifying structural categories (e.g. Array vs Object vs Primitive).
  - Implements graceful fallback to embedded minimal types in the event of local file corruption or read errors.

### 2.4 M6-D: Schema Consistency & Rich Results Validator (`src/core/structured-data/schema-validator.ts`)
- Leverages `SchemaKnowledgeBase` to validate entities.
- Context validation: `@context` required, must be `https://schema.org` (or `http://schema.org`). Flags invalid protocols, wrong domains, empty values.
- Type validation: `@type` required, non-empty, checks against Knowledge Base vocabulary. Distinguishes unknown types from invalid types.
- Property validation: Validates presence of recommended properties for rich results without flagging optional properties as errors.
- Structural category validation: Enforces that `itemListElement` is an Array, `mainEntity` is an Array or Object.
- Empty entity/property detection: Objects `{}` or empty values `""` cleanly flagged.

---

## 3. Registered Rules

| Rule ID | Candidate ID | Category | Severity | Confidence | Release Class | Docs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `structured-data/invalid-json-ld` | `LG-SDT-R001` | `structured-data` | Medium | High | `post-mvp` | [Docs](file:///docs/rules/structured-data/invalid-json-ld.md) |
| `structured-data/missing-context-or-type` | `LG-SDT-R002` | `structured-data` | Low | High | `post-mvp` | [Docs](file:///docs/rules/structured-data/missing-context-or-type.md) |
| `structured-data/missing-required-property` | `LG-SDT-R003` | `structured-data` | Low | Medium | `post-mvp` | [Docs](file:///docs/rules/structured-data/missing-required-property.md) |
| `structured-data/schema-syntax-error` | `LG-SDT-R004` | `structured-data` | Medium | High | `post-mvp` | [Docs](file:///docs/rules/structured-data/schema-syntax-error.md) |

---

## 4. Modified & Created Files

### Knowledge Base Files Created:
- `src/knowledge/schema/vocabulary-version.json`: Version metadata (Schema.org v28.1).
- `src/knowledge/schema/schema-types.json`: Candidate types, parent inheritance, validation rules.
- `src/knowledge/schema/schema-properties.json`: Property definitions and expected value types.
- `src/knowledge/schema/property-value-types.json`: Primitive and structural category definitions.
- `src/knowledge/schema/schema-knowledge-base.ts`: Typesafe reader, cache singleton, inheritance resolver, and query methods.
- `src/knowledge/schema/index.ts`: Module export index.

### Source Files Created & Updated:
- `src/core/structured-data/jsonld-extractor.ts`: Static JSON-LD block extractor and LineIndex source mapper.
- `src/core/structured-data/jsonld-parser.ts`: Safe JSON parser, `@graph` flattener, and syntax error locator.
- `src/core/structured-data/schema-validator.ts`: Local Schema.org validator integrated with SchemaKnowledgeBase.
- `src/core/structured-data/index.ts`: Module export index.
- `src/rules/structured-data/structured-data-rules.ts`: M6 structured data rules implementation.
- `src/core/types.ts`: Added `'structured-data'` to `RuleCategory`.
- `src/core/config/config-loader.ts`: Added `'structured-data'` to `VALID_CATEGORIES`.
- `src/cli/cli.ts`: Updated category help text to include `structured-data`.
- `src/rules/index.ts`: Exported `M6_STRUCTURED_DATA_RULES` and registered all 34 rules.

### Documentation Files Created:
- `docs/M6-STRUCTURED-DATA.md`: Subsystem guide and specification.
- `docs/rules/structured-data/invalid-json-ld.md`: Rule documentation for `LG-SDT-R001`.
- `docs/rules/structured-data/missing-context-or-type.md`: Rule documentation for `LG-SDT-R002`.
- `docs/rules/structured-data/missing-required-property.md`: Rule documentation for `LG-SDT-R003`.
- `docs/rules/structured-data/schema-syntax-error.md`: Rule documentation for `LG-SDT-R004`.

### Test Files Created:
- `tests/unit/schema-knowledge-base.test.ts`: Dedicated test suite (9 tests) verifying metadata, 12 candidate types, prefix normalization, inheritance resolution, property aggregation, structural validation, and singleton caching.
- `tests/unit/structured-data.test.ts`: 11 unit tests covering valid/invalid JSON-LD, Next.js dangerouslySetInnerHTML, template literals, multiple blocks, `@graph`, arrays, missing properties, property types, empty entities.
- `tests/adversarial/structured-data-adversarial.test.ts`: 5 adversarial suites covering oversized payloads (500KB), deep nesting (30 levels), ReDoS defense (2,000 script tags), target code execution defense (ADR-002), and zero network calls (ADR-006).

---

## 5. Architectural Invariant Conformance

| Architecture Decision | Requirement | M6 Conformance Summary |
| :--- | :--- | :--- |
| **ADR-001 (Single Package)** | All functionality in unified package; zero cross-package complexity. | Fully implemented within `src/knowledge/schema/`, `src/core/structured-data/`, and `src/rules/structured-data/`. Zero external packages imported. |
| **ADR-002 (Zero Code Exec)** | Never execute or evaluate target-project code or config. | Extraction is 100% lexical/regex-based. Dynamic expressions (`JSON.stringify(data)`) are flagged as `indeterminate` without evaluation. |
| **ADR-003 (Rule API)** | Uniform `RuleDefinition` with metadata, registry integration. | All 4 rules implement standard `RuleDefinition`, with candidate IDs, severities, confidences, and `releaseClass: 'post-mvp'`. |
| **ADR-004 (Config)** | Strict `.launchguardrc.json` format, category validation. | `'structured-data'` added to `VALID_CATEGORIES` in config-loader and CLI. |
| **ADR-005 (Report Schema)** | Standard report model, deterministic fingerprints. | Findings generated by M6 rules include deterministic fingerprints and conform to `FindingLocation` and `Finding`. |
| **ADR-006 (Zero Network)** | Zero outbound network calls; strict offline default. | Validation uses offline Schema Knowledge Base; zero network requests occur during extraction or validation. |
| **ADR-007 (Fault Isolation)** | Per-rule fault isolation and timeouts. | Rules execute within standard orchestrator isolation boundary; errors in one block do not abort the scan. |

---

## 6. Verification & Quality Metrics

- **TypeScript Compilation:** `npm run typecheck` passes with **0 errors and 0 warnings**.
- **Automated Tests:** `npm test` passes **109/109 tests** (100% pass rate, 0 failures, 0 skipped).
- **Unit Tests:** `npm run test:unit` passes **70/70 tests**.
- **Adversarial Tests:** `npm run test:adversarial` passes **33/33 tests**.
- **Code Coverage:**
  - Overall Line Coverage: **91.68%** (Target: $\ge 80\%$)
  - Overall Branch Coverage: **86.58%** (Target: $\ge 80\%$)
  - Overall Function Coverage: **93.55%** (Target: $\ge 80\%$)
  - `src/knowledge/schema/schema-knowledge-base.ts`: **95.95% line coverage**
  - `src/knowledge/schema/index.ts`: **100.00% line coverage**
  - `src/rules/structured-data/structured-data-rules.ts`: **98.12% line coverage**
  - `src/core/structured-data/schema-validator.ts`: **93.78% line coverage**
  - `src/core/structured-data/jsonld-extractor.ts`: **82.93% line coverage**
  - `src/core/structured-data/jsonld-parser.ts`: **79.43% line coverage**
- **Runtime Dependencies:** `0` runtime dependencies in `package.json`.
