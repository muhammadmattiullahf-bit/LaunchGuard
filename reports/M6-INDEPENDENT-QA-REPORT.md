# LaunchGuard — Milestone M6 Independent QA Audit Report

**Document Reference:** LG-QA-M6-001  
**Target:** LaunchGuard v0.1.0 (Milestone M6 — Structured Data & Schema Validation)  
**Primary Authorization:** LG-M6-AUTH-001  
**Additional Authorization:** LG-M6-DB-ADDENDUM-001  
**Audit Date:** 2026-11-24  
**Audit Status:** Complete  
**QA Verdict:** **PASS WITH LIMITATIONS**  
**Auditor:** Independent Software QA & Architecture Audit Team  

---

## 1. Scope & Methodology

An independent, rigorous, read-only quality assurance audit was performed on the completed Milestone M6 implementation of LaunchGuard v0.1.0, including the Schema Knowledge Base addendum (`LG-M6-DB-ADDENDUM-001`).

The audit evaluated the source code, architecture, automated test suites, adversarial security tests, documentation, and regression impact against DOC-001, ADR-001 through ADR-007, LG-M6-BASE-001, and the M6 Engineering Specification.

All verification steps were executed in clean, non-destructive subshell runs.

---

## 2. Baseline Comparison

Comparing the pre-implementation baseline (`LG-M6-BASE-001`) with the final M6 state:

| Metric | Pre-Implementation Baseline | Final M6 Verification | Delta |
| :--- | :---: | :---: | :---: |
| **Total Automated Tests** | 100 | **109** | +9 tests |
| **Unit Tests** | 61 | **70** | +9 tests |
| **Adversarial Tests** | 33 | **33** | 0 |
| **Overall Line Coverage** | 91.46% | **91.68%** | +0.22% |
| **Overall Branch Coverage** | 85.63% | **86.58%** | +0.95% |
| **Overall Function Coverage** | 94.55% | **93.55%** | -1.00% |
| **Total Registered Rules** | 34 | **34** | 0 |
| **Runtime Dependencies** | 0 | **0** | 0 (`{}`) |
| **TypeScript Diagnostics** | 0 | **0** | 0 errors |

### Test Progression Chronology & Baseline Reconciliation:
- **M5 Closure Baseline (`LG-M5-CLOSE-001`, Nov 20, 2026):** 84 automated tests (50 unit + 28 adversarial + 6 fixtures).
- **M6 Initial Core Rules Implementation (`LG-M6-AUTH-001`, Nov 20, 2026):** +16 tests (11 unit in `structured-data.test.ts` + 5 adversarial in `structured-data-adversarial.test.ts`), establishing the 100-test baseline (61 unit + 33 adversarial + 6 fixtures) recorded in `reports/M6-BASELINE-AUDIT.md` (`LG-M6-BASE-001`).
- **M6 Knowledge Base Addendum Verification (`LG-M6-DB-ADDENDUM-001`, Nov 24, 2026):** +9 dedicated unit tests in `tests/unit/schema-knowledge-base.test.ts`, reaching the final verified count of **109 tests** (70 unit + 33 adversarial + 6 fixtures).

---

## 3. Architecture Compliance

- **Single Package (ADR-001):** The Schema Knowledge Base and Structured Data subsystems are completely contained within the single repository and single npm package (`src/knowledge/schema/`, `src/core/structured-data/`, `src/rules/structured-data/`). Zero external packages were added.
- **Rule Extension Model (ADR-003):** All 4 M6 rules adhere strictly to the `RuleDefinition` interface, with candidate IDs `LG-SDT-R001` through `LG-SDT-R004`, structured metadata, and `releaseClass: 'post-mvp'`.
- **Runtime Isolation (ADR-007):** Rules execute within the scan orchestrator boundary with isolated error capture and configurable `AbortSignal` timeout handling.

---

## 4. ADR-002 Verification (Zero Untrusted Code Execution)

- **Verification:** Audited `jsonld-extractor.ts`, `jsonld-parser.ts`, `schema-validator.ts`, and `schema-knowledge-base.ts`.
- **Findings:**
  - Zero use of `eval()`, `new Function()`, `vm.runInContext()`, or dynamic `import()`.
  - Target project scripts, Next.js configurations, and React JSX files are parsed strictly as plain text.
  - Script tags containing executable JavaScript or `JSON.stringify(dynamicVar)` are marked `indeterminate` and never evaluated.
  - Adversarial tests confirmed that script contents containing `process.exit(1)` or command injection payloads are parsed purely as inert text strings without execution.

---

## 5. ADR-006 Verification (Zero Network Access & Offline Default)

- **Verification:** Audited all modules for network API references (`fetch`, `http`, `https`, `dgram`, `net`, `tls`, `dns`).
- **Findings:**
  - Zero network calls are made during JSON-LD extraction, parsing, or schema validation.
  - Remote context URLs (e.g. `https://schema.org`) are evaluated purely as literal strings; no remote fetching occurs.
  - Automated adversarial tests with monkey-patched `dns.lookup`, `http.request`, `https.request`, and `net.connect` confirmed 0 network requests occurred across the entire audit suite.

---

## 6. JSON-LD Discovery Results

- **Supported Patterns:**
  - Standard `<script type="application/ld+json">` tags.
  - Next.js `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}` (both standard and inverted attribute order).
  - JSX template literals `<script type="application/ld+json">{`...`}</script>`.
  - Multiple blocks in a single file.
  - Negative lookbehind `(?<!\/)>` successfully prevents greedily matching self-closing tags as opening tags.
- **Source Location Accuracy:** Linear-time binary search (`LineIndex`) accurately maps 1-based line and column offsets in $O(\log L)$ time.

---

## 7. JSON Parsing Results

- **Safety & Resource Bounds:**
  - Bounded memory limits reject payloads exceeding 2MB.
  - Recursion depth limit prevents stack overflow on payloads exceeding 32 levels of nesting.
- **Error Localization:** V8 parse error character offsets are converted to exact line and column coordinates within the source file.
- **Graph & Top-Level Arrays:** Arrays and `@graph` entries are correctly unwrapped, and top-level `@context` values are inherited by child entities.

---

## 8. Schema Validation Results

- **Context Validation:** Mandatory `@context` verified; invalid protocols or incorrect domains flagged.
- **Type Validation:** Mandatory `@type` verified against the Schema Knowledge Base.
- **Property Validation:** Recommended properties for rich results checked without penalizing optional Schema.org properties.
- **Structural Category Constraints:** High-impact structural constraints enforced (e.g. `itemListElement` must be Array, `mainEntity` must be Array or Object).
- **Empty Object Handling:** Empty objects `{}` flagged by `schema-syntax-error`, preventing redundant `missing-context-or-type` findings.

---

## 9. Knowledge-Base Verification (LG-M6-DB-ADDENDUM-001)

- **Architecture:** Bundled versioned JSON data modules and an in-memory cached reader under `src/knowledge/schema/`.
- **Zero Database Server:** Zero SQLite, zero Postgres, zero MySQL, zero remote databases.
- **Vocabulary Version:** Documented version `Schema.org v28.1` with release date `2024-10-15` and integrity hash.
- **Candidate Types:** All 12 candidate core types verified (`Organization`, `LocalBusiness`, `PostalAddress`, `WebSite`, `WebPage`, `Service`, `Product`, `BreadcrumbList`, `FAQPage`, `Article`, `Person`, `ImageObject`).
- **Inheritance Resolution:** Inheritance correctly modeled and resolved (e.g. `LocalBusiness` -> `Organization` -> `Thing`; `Article` -> `Thing`; `NewsArticle` -> `Article`).
- **Resilience:** Graceful fallback to embedded minimal types in the event of missing or corrupted files.
- **Deterministic Singleton:** Singleton caching guarantees deterministic access with zero repeated file I/O overhead.

---

## 10. Rule Registry Verification

Command: `node bin/launchguard.js rules list` (Exit Code: 0).
Total registered rules: **34**.
- **MVP Rules (27):** All preserved in `ALL_MVP_RULES` with `releaseClass: 'mvp'`.
- **M5 Routing Rules (3):** Preserved in `M5_ROUTING_RULES` with `releaseClass: 'post-mvp'`.
- **M6 Structured Data Rules (4):** Exported in `M6_STRUCTURED_DATA_RULES` with `releaseClass: 'post-mvp'`:
  - `structured-data/invalid-json-ld` (`LG-SDT-R001`, Medium, High)
  - `structured-data/missing-context-or-type` (`LG-SDT-R002`, Low, High)
  - `structured-data/missing-required-property` (`LG-SDT-R003`, Low, Medium)
  - `structured-data/schema-syntax-error` (`LG-SDT-R004`, Medium, High)

---

## 11. Functional Tests

Command: `npm run test:unit`
- **Exit Code:** 0
- **Total Unit Tests Passed:** 70/70
- Verifies discovery, parsing, validation, line indexing, Knowledge Base queries, inheritance, and rule execution.

---

## 12. Adversarial Tests

Command: `npm run test:adversarial`
- **Exit Code:** 0
- **Total Adversarial Tests Passed:** 33/33
- Verifies 500KB oversized payloads, 30-level deep nesting, ReDoS defense against 2,000 script tags, target code execution defense (ADR-002), and zero outbound network calls (ADR-006).

---

## 13. Regression Tests

- All 27 original MVP rules pass without failure.
- All 3 M5 routing rules pass without failure.
- CLI argument parsing, configuration loading, and reporters (Terminal, JSON, SARIF) verified without regressions.

---

## 14. Typecheck Verification

Command: `npm run typecheck` (`tsc --noEmit`)
- **Exit Code:** 0
- **Diagnostics:** 0 errors, 0 warnings.
- Verified with TypeScript 7.0.2 under strict mode with `exactOptionalPropertyTypes: true` and `noEmit: true`.

---

## 15. Coverage Verification

Command: `node --test --experimental-test-coverage tests/**/*.test.ts`
- **Overall Line Coverage:** **91.68%** ($\ge 80\%$ requirement met)
- **Overall Branch Coverage:** **86.58%** ($\ge 80\%$ requirement met)
- **Overall Function Coverage:** **93.55%** ($\ge 80\%$ requirement met)

**Key Subsystem Coverage Table:**
| Module | Line % | Branch % | Function % | Uncovered Lines |
| :--- | :---: | :---: | :---: | :--- |
| `src/knowledge/schema/index.ts` | 100.00% | 100.00% | 100.00% | None |
| `src/knowledge/schema/schema-knowledge-base.ts` | 95.95% | 94.83% | 85.00% | 137-138, 175-181, 217-218, 284-285, 344-345 |
| `src/core/structured-data/index.ts` | 100.00% | 100.00% | 100.00% | None |
| `src/core/structured-data/jsonld-extractor.ts` | 82.93% | 72.09% | 100.00% | 64-65, 77-78, 148-170, 246-247, 259, 263-278, 292-301 |
| `src/core/structured-data/jsonld-parser.ts` | 79.43% | 74.29% | 100.00% | 38-39, 42-60, 73-74, 88-89, 124-134 |
| `src/core/structured-data/schema-validator.ts` | 93.78% | 92.68% | 100.00% | 49-50, 103-112 |
| `src/rules/structured-data/structured-data-rules.ts` | 98.12% | 87.04% | 100.00% | 49-50, 164-165, 223-224 |

---

## 16. Dependency Comparison

- Pre-M6 `package.json` dependencies: `{}`
- Post-M6 `package.json` dependencies: `{}`
- Zero runtime dependencies were added.
- Only development tooling exists (`typescript`, `@types/node`).

---

## 17. Network Isolation Evidence

Automated test `tests/adversarial/structured-data-adversarial.test.ts` (suite "Zero outbound network calls during scan") verifies that:
1. `dns.lookup` and `dns.resolve` are intercepted; call count = 0.
2. `http.request` and `http.get` are intercepted; call count = 0.
3. `https.request` and `https.get` are intercepted; call count = 0.
4. `net.connect` and `net.Socket.prototype.connect` are intercepted; call count = 0.
5. All rule checks complete successfully without attempting network connections.

---

## 18. Known Limitations

In accordance with transparent engineering principles, the following limitations are cataloged:
1. **Regex Comment Extraction:** Comments containing `<script type="application/ld+json">` are matched by regex if unstripped.
2. **Indeterminate Dynamic Payloads:** Dynamic variables (`JSON.stringify(dynamicData)`) cannot be validated statically and are safely categorized as `indeterminate`.
3. **Curated Vocabulary Scope:** Offline Schema Knowledge Base contains 12 core candidate types and high-impact properties; uncommon or niche Schema.org types pass syntax validation without type-specific required property checks.

---

## 19. Remaining Technical Debt

The three cataloged limitations are recorded in `reports/REMAINING-ISSUES.md`:
- **QA-M6-001 (Low):** Regex Comment Extraction (planned comment-stripping pre-pass or full AST in post-MVP / M7).
- **QA-M6-002 (Low):** Indeterminate Dynamic Payloads (inherent to ADR-002 static parsing).
- **QA-M6-003 (Informational):** Local Schema Scope (expandable via future offline vocabulary updates).

---

## 20. Final QA Verdict

### QA Verdict: **PASS WITH LIMITATIONS**

**Formal Sign-Off:**
Milestone M6 — Structured Data & Schema Validation has met all architectural constraints, functional requirements, and security criteria authorized under `LG-M6-AUTH-001` and `LG-M6-DB-ADDENDUM-001`.

The implementation is verified with **109 passing automated tests**, **91.68% test coverage**, **0 TypeScript diagnostics**, **0 runtime dependencies**, and **0 network access**.

The three cataloged limitations are documented and accepted as appropriate engineering trade-offs for an offline, static, zero-dependency CLI.

**Milestone M7 (Security Advisory Integration) is NOT STARTED.**
