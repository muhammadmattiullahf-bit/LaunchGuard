# LaunchGuard MVP — Remaining Issues, Technical Debt & Roadmap Decisions

**Document ID:** LG-REM-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Revision:** 1.4  
**Verification Date:** November 24, 2026  
**Auditor:** Lead Architect & Quality Gate Subagent  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (Sections 7, 19, 20)  

---

## 1. Executive Overview & Architecture Decision Baseline

The LaunchGuard Minimum Viable Product (MVP) has verified 100% compliance with its core security boundaries, functional requirements, and architectural contracts.

The foundational architecture decisions (ADRs) have been formally approved by the project owner as the binding baseline for the MVP and are no longer open for approval:

| ADR ID | Title | Approved Decision Summary | Status | Approved Date |
| :--- | :--- | :--- | :---: | :---: |
| **ADR-001** | Repository Layout & Package Structure | Single repository and single unified npm package for MVP; internal directory isolation between Core Engine, CLI, and Reporters. Zero cross-imports. | **Approved** | 2026-11-19 |
| **ADR-002** | Static Parsing Strategy & Untrusted Target Safety | Safe static parsing strategy; never execute target-project code or configuration. Bounded JSON parsing, safe text/regex inspection, no dynamic code evaluation, no guessing of dynamic values; report uncertainty with appropriate confidence. | **Approved** | 2026-11-19 |
| **ADR-003** | Rule API & Extension Model | Uniform `RuleDefinition` interface with mandatory metadata, queryable `RuleRegistry`, and isolated execution contexts. | **Approved** | 2026-11-19 |
| **ADR-004** | Configuration Format & Loading | Strict `.launchguardrc.json` format, rejection of unknown keys, mandatory suppression rationale string. | **Approved** | 2026-11-19 |
| **ADR-005** | Report Schema & Versioning | Standardized machine-readable `ReportModel` contract (v1.0.0), deterministic finding fingerprinting, and OASIS SARIF v2.1.0 support. | **Approved** | 2026-11-19 |
| **ADR-006** | Network Access & Offline Default | Zero network access and zero telemetry in MVP; strict offline operation. Explicit user consent required for future network features (proposed flag: `--allow-network` for Milestone M7). | **Approved** | 2026-11-19 |
| **ADR-007** | Runtime Isolation & Timeouts | Per-rule fault isolation (faults captured without aborting scan) and configurable AbortSignal timeout bounds. | **Approved** | 2026-11-19 |

---

## 2. Genuinely Unresolved Decisions Requiring Future Project Owner Approval

The following items are genuinely unresolved governance and architectural decisions that require project-owner evaluation prior to public release or post-MVP milestones:

### 1. Brand Identity & Trademark Verification (OQ-001)
- **Context:** The name "LaunchGuard" is currently a provisional product name under DOC-001 Section 7.3.
- **Unresolved Decision:** Formal legal/trademark clearance across developer-tool classifications must be completed and approved before public repository publication and marketing.

### 2. Package Registry Identity & Namespace Allocation (OQ-002)
- **Context:** The project must publish its distribution artifacts to npm.
- **Unresolved Decision:** The owner must approve the public package identifier: whether to publish under the standalone name `launchguard` or reserve an organizational scope such as `@launchguard/cli` (with a placeholder redirect package).

### 3. Post-MVP AST Engine Selection & Security Sandbox (Post-M4 / Planning M5)
- **Context:** Milestone M5 (Routing & Navigation Audit) and complex JSX inspection may exceed the expressiveness of pure regex heuristics.
- **Unresolved Decision:** When evaluating an AST parser (e.g., `@babel/parser`, `swc`, or the TypeScript Compiler API) for post-MVP milestones, the project owner must approve the specific library and its sandboxing strategy. The AST solution must strictly inherit ADR-002 principles: never execute code, remain bounded against resource exhaustion, and introduce minimal dependency risk.

### 4. Advisory Data Source & Provider Selection for Milestone M7 (LG-FR-030)
- **Context:** Milestone M7 introduces security advisory lookups for dependencies, which will operate strictly behind the approved explicit consent mechanism (`--allow-network`).
- **Unresolved Decision:** The project owner must select the authoritative advisory data provider: OSV.dev, GitHub Advisory Database, or an offline periodically bundled database snapshot.

### 5. Web Report Viewer Deployment & Architecture (OQ-003 / Milestone M9)
- **Context:** Milestone M9 introduces a visual report viewer for `report.json` artifacts.
- **Unresolved Decision:** Owner decision required on hosting architecture: whether to maintain the viewer as a static client-side single-page app hosted on GitHub Pages/Cloudflare Pages, or package an optional zero-install local HTML generator directly into the CLI.

---

## 3. Open Questions from DOC-001 (Preserved as Unresolved)

In compliance with DOC-001 Section 20, the following open questions remain explicitly unresolved:

| ID | Title | Summary & Current Assessment | Recommended Path Forward |
| :--- | :--- | :--- | :--- |
| **OQ-001** | Trademark & Name Collision | Clearance search required to verify that "LaunchGuard" does not infringe existing registered trademarks in dev-ops / CLI tooling. | Conduct clearance search before public GitHub launch. |
| **OQ-002** | Package Registry Identity | Confirm availability of `launchguard` vs `@launchguard/cli` on npm and GitHub Organization. | Reserve package namespaces on npmjs.com. |
| **OQ-003** | Web Viewer Hosting & Tech | Architecture, hosting model, and maintenance boundaries for the future web viewer (Milestone M9). | Formalize web viewer RFC during Milestone M6. |
| **OQ-004** | Symlink In-Root Policy | Safe handling of symlinks that point within the repository root. The MVP follows in-root symlinks while tracking visited paths to prevent loops, but formal policy remains open. | Document benchmark results and formalize in-root symlink policy for v1.0. |

---

## 4. MVP Static Analysis Boundaries & Known Limitations

In strict adherence to the approved **ADR-002** principles, the LaunchGuard MVP enforces rigid static analysis boundaries:

1. **Zero Target-Project Code Execution:**
   - LaunchGuard never executes, imports, or evaluates target JavaScript, TypeScript, or shell scripts.
   - `package.json` scripts (`build`, `start`, `postinstall`) are never invoked.
2. **Zero Target-Project Configuration Execution:**
   - Configuration files (`next.config.js`, `next.config.mjs`, `next.config.ts`, `.eslintrc.*`) are parsed strictly as plain text or via bounded data parsers.
   - Dynamic configuration functions (e.g. `headers: async () => [...]`) cannot be evaluated and are not guessed.
3. **No Guessing of Dynamic Values:**
   - Next.js App Router dynamic metadata functions (`generateMetadata`) are identified statically. If present, LaunchGuard refrains from guessing runtime return values and does not emit speculative false-positive findings.
4. **Honest Confidence Classification:**
   - Rules where external infrastructure (edge CDNs, reverse proxies) might satisfy a requirement (e.g., `security/security-headers-missing`) are intentionally classified with **Low Confidence** with transparent explanations in the finding documentation.
5. **Bounded Resource Limits:**
   - File discovery is bounded at 10,000 files, 10MB per file, and directory recursion depth of 30. Monorepos exceeding these defaults can adjust bounds via `--max-file-size` or configuration exclusions.

### 4.1 Milestone M5 Documented Limitations & Technical Debt (LG-QA-M5-001)

Milestone M5 (Routing & Navigation Audit) was formally accepted with verdict **PASS WITH LIMITATIONS** per authorization `LG-M5-CLOSE-001` and QA audit `LG-QA-M5-001`. The following five limitations are formally cataloged in the technical debt register:

1. **QA-M5-001 (Medium Severity) — Collocated Dynamic Segments with Differing Parameter Names:**
   - *Description:* Defining dual dynamic routes at the same folder level with differing parameter names (e.g. `app/posts/[id]/page.tsx` and `app/posts/[slug]/page.tsx`) causes a Next.js build-time collision. LaunchGuard indexes routes by literal string keys (`/posts/[id]` vs `/posts/[slug]`) and does not detect this as a collision in `manifest.conflicts`.
   - *Resolution Plan:* Normalize dynamic segment parameters (e.g. to `[:param]`) during conflict evaluation in post-MVP / M7.

2. **QA-M5-002 (Low Severity) — Commented-Out Links Extracted by Regex:**
   - *Description:* Static link extraction uses regular expressions over raw source text without stripping comments. Links inside `// <Link href="...">` or `{/* <Link href="..."> */}` are extracted and may produce false-positive broken link findings if targeting non-existent routes.
   - *Resolution Plan:* Add a comment-stripping pre-pass or full AST parser in post-MVP / M7.

3. **QA-M5-003 (Low Severity) — Aliased or Third-Party `<Link>` Components Matched:**
   - *Description:* Elements matching `<Link ... href="...">` from third-party libraries (e.g. `import { Link } from 'lucide-react'`) are extracted as navigation links regardless of import source.
   - *Resolution Plan:* Correlate `<Link>` occurrences with `import ... from 'next/link'` in the same source file in post-MVP / M7.

4. **QA-M5-004 (Low Severity) — URL-Encoded Link Targets Not Decoded:**
   - *Description:* URL-encoded link targets (e.g. `<Link href="/about%20us">`) are not decoded before route matching against filesystem folder names (`app/about us/page.tsx`), causing valid links to be flagged as broken.
   - *Resolution Plan:* Add safe `decodeURIComponent` in `normalizeLinkTarget` in post-MVP / M7.

5. **QA-M5-005 (Informational) — Programmatic Runtime Navigation Untraceable Statically:**
   - *Description:* Pages reached exclusively via dynamic runtime navigation (`router.push(variable)`) or server-side `redirect()` cannot be traced statically and are reported as potentially orphaned.
   - *Mitigation:* Correctly mitigated in M5 by assigning `severity: 'low'`, `confidence: 'medium'`, and conservative advisory phrasing.

### 4.2 Milestone M6 Documented Limitations & Technical Debt (LG-QA-M6-001)

Milestone M6 (Structured Data & Schema Validation) was formally accepted with verdict **PASS WITH LIMITATIONS** per authorization `LG-M6-AUTH-001` and QA audit `LG-QA-M6-001`. The following three limitations are formally cataloged in the technical debt register:

1. **QA-M6-001 (Low Severity) — Regex Comment Extraction:**
   - *Description:* Structured data extraction uses regular expressions over raw source files without comment stripping. Script tags inside JSX or JavaScript comments (`{/* <script type="application/ld+json"> */}`) are extracted and evaluated.
   - *Resolution Plan:* Add a comment-stripping pre-pass or full AST parser in post-MVP / M7.

2. **QA-M6-002 (Low Severity) — Indeterminate Dynamic Payloads Not Statically Evaluable:**
   - *Description:* When structured data is provided via a dynamic variable (`JSON.stringify(schemaData)`), LaunchGuard conservatively marks the block as indeterminate to avoid false positives. It cannot validate properties of dynamic objects.
   - *Resolution Plan:* In accordance with ADR-002 (never execute target code), LaunchGuard refrains from guessing runtime data.

3. **QA-M6-003 (Informational) — Local Schema Scope Limited to High-Impact Types:**
   - *Description:* Built-in offline validation targets high-impact Schema.org types (Organization, WebSite, Article, Product, BreadcrumbList, LocalBusiness, FAQPage). Niche or uncommon Schema.org types (e.g., `Recipe`, `Event`, `MedicalEntity`) validate general syntax and `@context`, but do not have type-specific required property checks.
   - *Resolution Plan:* Expand built-in specification map or load an offline JSON schema catalog in post-MVP.

---

## 5. Post-MVP Feature Roadmap

The following milestones are classified in `DOC-001` as Post-MVP and tracked as follows:

- **Milestone M5 — Routing & Navigation Audit (LG-FR-029):**
  - **Status:** **Completed & Formally Accepted (PASS WITH LIMITATIONS)** per Authorization `LG-M5-CLOSE-001` and QA Sign-off `LG-QA-M5-001`.
  - **Delivered Scope:** Static route manifest discovery across App Router and Pages Router; linear-time static link extraction; route matching with dynamic/catch-all resolution; static navigation graph and orphaned page detection.
  - **Rules Registered (post-mvp classification):**
    - `routing/broken-internal-link` (`LG-RTE-R001`, Medium severity, High confidence)
    - `routing/orphaned-page` (`LG-RTE-R005`, Low severity, Medium confidence)
    - `routing/route-conflict` (`LG-RTE-R003`, High severity, High confidence)
  - **Final Verified Metrics:**
    - 84/84 automated tests passing (100% pass rate).
    - 91.86% line coverage, 86.91% branch coverage, 93.88% function coverage.
    - 30 total registered rules (27 original MVP rules preserved + 3 M5 routing rules).
    - 0 TypeScript compiler diagnostics (`tsc --noEmit`).
    - 0 runtime dependencies (`dependencies: {}`).
    - 0 network requests (ADR-006 offline isolation verified).
    - 0 target-code execution (ADR-002 static parsing verified).
- **Milestone M6 — Structured Data & Schema Validation (LG-FR-032):**
  - **Status:** **Completed & Formally Accepted (PASS WITH LIMITATIONS)** per Authorization `LG-M6-AUTH-001`, `LG-M6-DB-ADDENDUM-001` and QA Sign-off `LG-QA-M6-001`.
  - **Delivered Scope:** Static JSON-LD discovery across App Router and Pages Router; Next.js `dangerouslySetInnerHTML` and template literal extraction; safe bounded JSON parsing with `@graph` unwrapping; versioned local Schema Knowledge Base (`src/knowledge/schema/`) based on Schema.org v28.1; local Schema.org validation against high-impact search types; and 4 audit rules in `structured-data` category.
  - **Rules Registered (post-mvp classification):**
    - `structured-data/invalid-json-ld` (`LG-SDT-R001`, Medium severity, High confidence)
    - `structured-data/missing-context-or-type` (`LG-SDT-R002`, Low severity, High confidence)
    - `structured-data/missing-required-property` (`LG-SDT-R003`, Low severity, Medium confidence)
    - `structured-data/schema-syntax-error` (`LG-SDT-R004`, Medium severity, High confidence)
  - **Final Verified Metrics:**
    - 109/109 automated tests passing (100% pass rate).
    - 91.68% line coverage, 86.58% branch coverage, 93.55% function coverage.
    - 34 total registered rules (27 original MVP rules + 3 M5 routing rules + 4 M6 structured data rules).
    - 0 TypeScript compiler diagnostics (`tsc --noEmit`).
    - 0 runtime dependencies (`dependencies: {}`).
    - 0 database servers (bundled JSON data modules).
    - 0 network requests (ADR-006 offline isolation verified).
    - 0 target-code execution (ADR-002 static parsing verified).
- **Milestone M7 — Security Advisory Integration (LG-FR-030):**
  - **Status:** **Not Started / Next in Roadmap** (Awaiting formal owner authorization).
  - Security advisory lookup for declared dependencies.
  - **Network Policy:** Operating strictly behind the proposed `--allow-network` CLI flag (with explicit user consent). The MVP remains 100% offline.
- **Milestone M8 — Workflow & CI Integration Checks (LG-FR-031):**
  - **Status:** Pending Future Milestone.
  - Auditing CI workflows (`.github/workflows/`, GitLab CI) for pre-deployment audit gates.
- **Milestone M9 — Client-Side Web Report Viewer:**
  - **Status:** Pending Future Milestone.
  - Standalone, client-side web application for uploading and visually browsing `report.json` outputs without server-side processing.

---

## 6. Document Revision History / Changelog

### Revision 1.4 (November 24, 2026) — M6 Knowledge Base Addendum & Final Verification
- **M6 Knowledge Base Addendum (`LG-M6-DB-ADDENDUM-001`):** Integrated bundled, versioned Local Schema Knowledge Base (`src/knowledge/schema/`) based on Schema.org v28.1 with zero external database dependencies.
- **Chronology & Test Progression Reconciliation:**
  - Prior baseline at M5 closure (`LG-M5-CLOSE-001` on Nov 20, 2026): 84 automated tests (50 unit + 28 adversarial + 6 fixtures).
  - Initial M6 authorization (`LG-M6-AUTH-001` on Nov 20, 2026): Added 16 tests (11 unit in `tests/unit/structured-data.test.ts` + 5 adversarial in `tests/adversarial/structured-data-adversarial.test.ts`, net +16 tests), establishing the 100-test baseline (61 unit + 33 adversarial + 6 fixtures) recorded in `LG-M6-BASE-001`.
  - Knowledge Base Addendum verification (Nov 24, 2026): Added 9 dedicated unit tests (`tests/unit/schema-knowledge-base.test.ts`), bringing final test count to 109 tests (70 unit + 33 adversarial + 6 fixtures).
- **Final M6 Metrics Recorded:** 109 tests passing (100% pass rate), 91.68% line coverage, 86.58% branch coverage, 93.55% function coverage, 34 total registered rules (27 MVP + 3 M5 + 4 M6).
- **Roadmap Reaffirmed:** M6 completed with QA verdict **PASS WITH LIMITATIONS**; M7 reaffirmed as **Not Started / Next in Roadmap**.

### Revision 1.3 (November 20, 2026) — Initial M6 Core Rules Implementation & Review
- **Initial M6 Formal Review:** Core M6 structured data rules implemented and provisionally accepted with verdict **PASS WITH LIMITATIONS** per Authorization `LG-M6-AUTH-001` and initial QA Audit `LG-QA-M6-001`.
- **Technical Debt Register Updated:** Formally cataloged all three M6 limitations (QA-M6-001 through QA-M6-003) under Section 4.2.
- **M6 Initial Metrics Recorded:** 100 tests passing, 91.46% line coverage, 85.63% branch coverage, 94.55% function coverage, 34 total rules (27 MVP + 3 M5 post-mvp + 4 M6 post-mvp).
- **Roadmap Updated:** M6 status updated to Completed; M7 explicitly reaffirmed as **Not Started / Next in Roadmap**.
- **Rule Classification Confirmed:** Preserved the 27 original MVP rules, 3 M5 routing rules, and confirmed the 4 structured data rules maintain `post-mvp` release classification.

### Revision 1.2 (November 20, 2026)
- **M5 Formal Closure:** Marked Milestone M5 as completed and formally accepted with verdict **PASS WITH LIMITATIONS** per Authorization `LG-M5-CLOSE-001` and QA Audit `LG-QA-M5-001`.
- **Technical Debt Register Updated:** Formally cataloged all five M5 limitations (QA-M5-001 through QA-M5-005) under Section 4.1.
- **M5 Metrics Recorded:** 84 tests passing, 91.86% line coverage, 86.91% branch coverage, 93.88% function coverage, 30 total rules (27 MVP + 3 M5 post-mvp).
- **Roadmap Updated:** M5 status updated to Completed; M6 explicitly marked as **Not Started / Next in Roadmap**.
- **Rule Classification Confirmed:** Preserved the 27 original MVP rules and confirmed the 3 routing rules maintain `post-mvp` release classification.

### Revision 1.1 (November 20, 2026)
- **Approved Decisions Updated:** Transitioned ADR-001 (Single repo/package), ADR-002 (Static parsing & zero execution), and ADR-006 (Zero network/telemetry offline default) to Approved Baseline status per project owner decisions. Removed them from the approval-pending list.
- **Network Flag Standardized:** Updated the proposed future network consent flag for Milestone M7 to `--allow-network` (proposed naming standard; MVP remains strictly offline).
- **Preserved Open Questions:** Retained OQ-001, OQ-002, OQ-003, and OQ-004 as open and unresolved.
- **Static Analysis Boundaries Reaffirmed:** Codified ADR-002 core principles (never execute code/config, bounded parsing, no guessing of dynamic values, honest confidence).
- **Roadmap Milestones Preserved:** Reaffirmed Milestones M5 through M9 without scope modifications.

### Revision 1.0 (November 20, 2026)
- Initial document generation during MVP verification audit.
