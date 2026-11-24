# LaunchGuard MVP — Rule Quality & Detection Accuracy Report

**Document ID:** LG-RQR-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Verification Date:** November 2026  
**Auditor:** LaunchGuard Rule Architect & QA Subagent  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (Section 15)  

---

## 1. Executive Summary

This report evaluates the quality, precision, reliability, and documentation of all **27 MVP rules** implemented in LaunchGuard across 6 audit categories.

In compliance with DOC-001 principles (**P-03: Explain every finding**, **P-04: Be honest about uncertainty**, **P-05: No false assurance**, **P-07: Extensible rule architecture**), each rule has been audited against:
1. **Detection Mechanism:** Deterministic, non-executing static analysis (bounded regex, file presence checks, and configuration heuristics).
2. **False-Positive Mitigation:** Clear awareness of static analysis limits, particularly dynamic runtime expressions in Next.js.
3. **Evidence Anchoring:** Clear, reproducible evidence anchors for deduplication and line attribution.
4. **Severity & Confidence Justification:** Well-calibrated default severities and honest confidence classifications.
5. **Documentation Alignment:** Dedicated markdown documentation in `docs/rules/` providing rationale, good/bad code examples, and remediation steps.

---

## 2. Rule Quality Matrix (All 27 Rules)

| Rule ID | Candidate ID | Category | Default Severity | Confidence | Detection Method | Evidence Quality | Doc File Verified |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `seo/title-missing` | LG-SEO-R001 | seo | medium | high | Static Regex / Presence | High (file + anchor) | `docs/rules/seo/title-missing.md` |
| `seo/description-missing` | LG-SEO-R002 | seo | medium | high | Static Regex / Presence | High (layout inspection) | `docs/rules/seo/description-missing.md` |
| `seo/canonical-missing` | LG-SEO-R004 | seo | medium | medium | Static Regex / Presence | Medium (heuristic fallback) | `docs/rules/seo/canonical-missing.md` |
| `seo/robots-missing` | LG-SEO-R005 | seo | low | high | File Presence | High (checks `public/` & `app/`) | `docs/rules/seo/robots-missing.md` |
| `seo/site-wide-noindex` | LG-SEO-R006 | seo | high | high | Static Regex | High (line matches `noindex`) | `docs/rules/seo/site-wide-noindex.md` |
| `seo/sitemap-missing` | LG-SEO-R007 | seo | low | high | File Presence | High (checks `public/` & `app/`) | `docs/rules/seo/sitemap-missing.md` |
| `seo/opengraph-missing` | LG-SEO-R009 | seo | low | medium | Static Regex | Medium (checks OG metadata) | `docs/rules/seo/opengraph-missing.md` |
| `security/env-not-ignored` | LG-SEC-R001 | security | high | high | File Presence & Parser | High (checks gitignore patterns) | `docs/rules/security/env-not-ignored.md` |
| `security/secret-token-leak` | LG-SEC-R002 | security | critical | high | High-Entropy Regex | High (redacted snippet anchor) | `docs/rules/security/secret-token-leak.md` |
| `security/public-env-leak` | LG-SEC-R003 | security | high | high | Static Regex | High (flags sensitive public vars) | `docs/rules/security/public-env-leak.md` |
| `security/security-headers-missing` | LG-SEC-R004 | security | medium | low | Static Regex | Low (honestly marked low conf) | `docs/rules/security/security-headers-missing.md` |
| `security/source-maps-enabled` | LG-SEC-R005 | security | medium | high | Static Regex | High (flags `productionBrowserSourceMaps`) | `docs/rules/security/source-maps-enabled.md` |
| `security/powered-by-header` | LG-SEC-R006 | security | low | high | Static Regex | High (flags omitted disable header) | `docs/rules/security/powered-by-header.md` |
| `code-quality/typescript-config-missing` | LG-COD-R001 | code-quality | medium | high | File Presence | High (verifies `tsconfig.json`) | `docs/rules/code-quality/typescript-config-missing.md` |
| `code-quality/typescript-strict-disabled` | LG-COD-R002 | code-quality | medium | high | JSON Configuration | High (checks `strict: false`) | `docs/rules/code-quality/typescript-strict-disabled.md` |
| `code-quality/eslint-config-missing` | LG-COD-R003 | code-quality | low | high | File Presence | High (verifies ESLint configs) | `docs/rules/code-quality/eslint-config-missing.md` |
| `code-quality/build-script-missing` | LG-COD-R004 | code-quality | high | high | JSON Configuration | High (checks `package.json` scripts) | `docs/rules/code-quality/build-script-missing.md` |
| `code-quality/test-script-missing` | LG-COD-R005 | code-quality | informational | high | JSON Configuration | High (checks `scripts.test`) | `docs/rules/code-quality/test-script-missing.md` |
| `code-quality/build-error-suppression` | LG-COD-R006 | code-quality | medium | high | Static Regex | High (flags `ignoreBuildErrors`) | `docs/rules/code-quality/build-error-suppression.md` |
| `code-quality/node-version-missing` | LG-COD-R007 | code-quality | informational | high | Config & File Presence | High (checks `engines.node`, `.nvmrc`) | `docs/rules/code-quality/node-version-missing.md` |
| `deployment/env-template-missing` | LG-DPL-R001 | deployment | low | high | File Presence | High (checks `.env.example`) | `docs/rules/deployment/env-template-missing.md` |
| `deployment/env-var-untracked` | LG-DPL-R002 | deployment | low | medium | Regex Extraction | Medium (cross-checks source & env) | `docs/rules/deployment/env-var-untracked.md` |
| `deployment/start-script-missing` | LG-DPL-R003 | deployment | medium | high | JSON Configuration | High (checks `scripts.start`) | `docs/rules/deployment/start-script-missing.md` |
| `performance/large-static-asset` | LG-PRF-R001 | performance | low | high | File Stat Inspection | High (exact file size reported) | `docs/rules/performance/large-static-asset.md` |
| `dependencies/lockfile-missing` | LG-DEP-R001 | dependencies | low | high | File Presence | High (checks npm/pnpm/yarn/bun) | `docs/rules/dependencies/lockfile-missing.md` |
| `dependencies/multiple-lockfiles` | LG-DEP-R002 | dependencies | medium | high | File Presence | High (checks lockfile conflicts) | `docs/rules/dependencies/multiple-lockfiles.md` |
| `dependencies/wildcard-version-range` | LG-DEP-R003 | dependencies | medium | high | JSON Configuration | High (flags `*`, `latest`, empty) | `docs/rules/dependencies/wildcard-version-range.md` |

---

## 3. Deep-Dive Category Analysis

### 3.1 SEO Category (7 Rules)
- **Design Philosophy:** Next.js App Router uses convention-based file metadata (`robots.ts`, `sitemap.ts`, `favicon.ico`) alongside static or dynamic `metadata` exports.
- **Handling of Dynamic Metadata:** In adherence to Principle P-04 (Honest about uncertainty), rules check for `generateMetadata` exports. When dynamic metadata is detected, the rules do not emit false positives for missing metadata.
- **False Positive Controls:** `seo/robots-missing` and `seo/sitemap-missing` inspect both `public/` static files and App Router metadata route files (`app/robots.ts`, `app/sitemap.ts`).
- **Fixture Verification:** Tested in `tests/fixtures/rules-verification.test.ts`. Confirmed 0 false positives when standard metadata and convention routes are present.

### 3.2 Security Category (6 Rules)
- **High-Risk Detection:**
  - `security/secret-token-leak`: Identifies high-entropy secrets and standard tokens in source code. All matched tokens are redacted prior to report emission.
  - `security/public-env-leak`: Flags sensitive environment variables mistakenly prefixed with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_SECRET_KEY`, `NEXT_PUBLIC_AWS_SECRET`).
  - `security/env-not-ignored`: Ensures `.env*` files are excluded in `.gitignore` before code is committed to version control.
- **Next.js Hardening:**
  - `security/source-maps-enabled`: Warns when `productionBrowserSourceMaps: true` is configured, preventing source code exposure in production.
  - `security/powered-by-header`: Alerts when `poweredByHeader` is not disabled, exposing server tech stack.
  - `security/security-headers-missing`: Emits a low-confidence recommendation when security headers (CSP, HSTS, X-Frame-Options) are absent from `next.config.*`. Marked low confidence because headers may be applied at edge/reverse proxy levels (Cloudflare, Vercel, Nginx).

### 3.3 Code Quality Category (7 Rules)
- **Baseline Rigor:** Audits presence and configuration of TypeScript (`tsconfig.json`), ESLint (`.eslintrc.*`), build scripts, and test commands.
- **Build Safety:** `code-quality/build-error-suppression` detects dangerous overrides in `next.config.*` such as `typescript.ignoreBuildErrors: true` or `eslint.ignoreDuringBuilds: true`, preventing broken builds from deploying.
- **Informational Cleanliness:** Missing test scripts and Node engine declarations are scored as informational (0-point penalty), avoiding unwarranted score inflation while promoting best practices.

### 3.4 Deployment Category (3 Rules)
- **Environment Parity:** `deployment/env-template-missing` flags missing `.env.example` templates.
- **Configuration Drifts:** `deployment/env-var-untracked` scans `process.env.VAR` usage in code and alerts if a referenced variable is missing from `.env.example`.
- **Runtime Readiness:** `deployment/start-script-missing` ensures `package.json` contains a production runner command (`next start`).

### 3.5 Performance Category (1 Rule)
- **Asset Size Thresholds:** `performance/large-static-asset` inspects `public/` assets and flags uncompressed files exceeding 500KB. Provides file size and format recommendations (WebP/AVIF conversion).

### 3.6 Dependencies Category (3 Rules)
- **Reproducible Installs:** `dependencies/lockfile-missing` ensures deterministic builds in CI.
- **Lockfile Conflicts:** `dependencies/multiple-lockfiles` identifies conflicting package manager artifacts (e.g., `package-lock.json` and `pnpm-lock.yaml` simultaneously present).
- **Supply Chain Hygiene:** `dependencies/wildcard-version-range` flags uncontrolled wildcard (`*`), `latest`, or unbounded version ranges in `dependencies`.

---

## 4. Documentation Compliance (DOC-001 LG-FR-028)

Every rule in LaunchGuard is paired with a corresponding markdown file under `docs/rules/<category>/<rule-id>.md`.
Automated test `tests/unit/rules.test.ts` validates that:
```typescript
for (const rule of registry.getAllRules()) {
  const docPath = `docs/rules/${rule.id}.md`;
  assert.strictEqual(fs.existsSync(docPath), true);
}
```
All 27 documentation files have been reviewed and verified to contain:
1. Rule title, ID, category, default severity, and default confidence.
2. "Why it matters" explanation detailing business or security impact.
3. Examples of non-compliant code/configuration.
4. Examples of compliant remediation code.
5. Known limitations of static analysis for the rule.

---

## 5. Rule Quality Verdict

**STATUS: PASS**  
All 27 MVP rules exhibit high detection fidelity, rigorous false-positive controls, safe evidence anchoring, and complete documentation.
