# LaunchGuard MVP — 27-Rule Test & Verification Matrix

**Document ID:** LG-RTM-027  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Date:** November 2026  
**Auditor:** QA & Rule Verification Subagent  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (Section 15)  

---

## 1. Matrix Overview

This matrix provides the complete QA verification record for all **27 MVP rules** implemented in LaunchGuard across 6 categories. Each rule has been validated against:
1. **Positive Fixture:** Confirms that non-compliant code or configuration triggers the rule with expected severity and confidence.
2. **Negative Fixture:** Confirms that compliant implementations emit 0 findings.
3. **Boundary Fixture:** Tests edge cases (e.g. dynamic metadata functions, commented lines, unusual casing, multi-lockfile scenarios).
4. **Malformed-Input Fixture:** Tests resilience against corrupted JSON, malformed configs, or empty files.
5. **False-Positive Assessment:** Documents handling of dynamic runtime expressions and static analysis boundaries.

---

## 2. Comprehensive 27-Rule Verification Matrix

| Rule ID | Candidate ID | Category | Default Severity | Confidence | Evidence Anchor | Positive Test | Negative Test | Boundary / Malformed Test | False-Positive Mitigation | Status |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| `seo/title-missing` | LG-SEO-R001 | seo | medium | high | `root-layout-title` | Verified | Verified | Layout with `generateMetadata` tested | Dynamic metadata exempts rule | **PASS** |
| `seo/description-missing` | LG-SEO-R002 | seo | medium | high | `root-layout-description` | Verified | Verified | Layout with dynamic metadata tested | Skips if `generateMetadata` present | **PASS** |
| `seo/canonical-missing` | LG-SEO-R004 | seo | medium | medium | `root-layout-canonical` | Verified | Verified | Missing `alternates.canonical` tested | Marked Medium confidence | **PASS** |
| `seo/robots-missing` | LG-SEO-R005 | seo | low | high | `missing-robots` | Verified | Verified | Checks both `public/` and `app/robots.ts` | Allows convention routes | **PASS** |
| `seo/site-wide-noindex` | LG-SEO-R006 | seo | high | medium | `robots-disallow-all` | Verified | Verified | `Disallow: /` in `app/robots.ts` & `public/robots.txt` | Distinguishes partial from root `/` | **PASS** |
| `seo/sitemap-missing` | LG-SEO-R007 | seo | low | high | `missing-sitemap` | Verified | Verified | Checks `public/sitemap.xml` & `app/sitemap.ts` | Allows convention routes | **PASS** |
| `seo/opengraph-missing` | LG-SEO-R009 | seo | low | medium | `root-layout-opengraph` | Verified | Verified | Root layout missing `openGraph` tested | Marked Medium confidence | **PASS** |
| `security/env-not-ignored` | LG-SEC-R001 | security | high | high | `env-unignored` | Verified | Verified | Unignored `.env.local` detected | Checks `.gitignore` patterns | **PASS** |
| `security/secret-token-leak` | LG-SEC-R002 | security | critical | high | `secret-leak` | Verified | Verified | Hardcoded API keys detected and masked | Pre-emission regex mask | **PASS** |
| `security/public-env-leak` | LG-SEC-R003 | security | high | high | `public-env-leak` | Verified | Verified | `NEXT_PUBLIC_SECRET_KEY` in `.env.example` | Checks for sensitive keywords | **PASS** |
| `security/security-headers-missing` | LG-SEC-R004 | security | medium | low | `missing-security-headers` | Verified | Verified | `next.config.js` with headers configured | Honestly marked Low confidence | **PASS** |
| `security/source-maps-enabled` | LG-SEC-R005 | security | medium | high | `source-maps-enabled` | Verified | Verified | `productionBrowserSourceMaps: true` | Explicit boolean flag check | **PASS** |
| `security/powered-by-header` | LG-SEC-R006 | security | low | high | `powered-by-header` | Verified | Verified | `poweredByHeader: false` tested | Flags omitted disable setting | **PASS** |
| `code-quality/typescript-config-missing` | LG-COD-R001 | code-quality | medium | high | `missing-tsconfig` | Verified | Verified | Missing `tsconfig.json` tested | Verifies file existence | **PASS** |
| `code-quality/typescript-strict-disabled` | LG-COD-R002 | code-quality | medium | high | `strict-disabled` | Verified | Verified | `strict: false` or missing strict mode | Strips comments before JSON parse | **PASS** |
| `code-quality/eslint-config-missing` | LG-COD-R003 | code-quality | low | high | `missing-eslint-config` | Verified | Verified | Checks `.eslintrc.*` and `eslint.config.*` | Flat & legacy configs supported | **PASS** |
| `code-quality/build-script-missing` | LG-COD-R004 | code-quality | high | high | `missing-build-script` | Verified | Verified | Missing or placeholder `build` script | Checks `scripts.build` in package | **PASS** |
| `code-quality/test-script-missing` | LG-COD-R005 | code-quality | informational | high | `missing-test-script` | Verified | Verified | Default echo error test script | 0 score penalty (info only) | **PASS** |
| `code-quality/build-error-suppression` | LG-COD-R006 | code-quality | medium | high | `build-error-suppression` | Verified | Verified | `ignoreBuildErrors: true` in config | Flags dangerous overrides | **PASS** |
| `code-quality/node-version-missing` | LG-COD-R007 | code-quality | informational | high | `missing-node-version` | Verified | Verified | Checks `engines.node`, `.nvmrc`, `.node-version` | Multiple config files checked | **PASS** |
| `deployment/env-template-missing` | LG-DPL-R001 | deployment | low | high | `missing-env-example` | Verified | Verified | Missing `.env.example` tested | Recommends env template | **PASS** |
| `deployment/env-var-untracked` | LG-DPL-R002 | deployment | low | medium | `untracked-env-var` | Verified | Verified | Empty `.env.example` & unlisted vars | Handles empty template safely | **PASS** |
| `deployment/start-script-missing` | LG-DPL-R003 | deployment | medium | high | `missing-start-script` | Verified | Verified | Missing `scripts.start` tested | Verifies production runner | **PASS** |
| `performance/large-static-asset` | LG-PRF-R001 | performance | low | high | `large-asset` | Verified | Verified | Files >500KB in `public/` detected | Stat checks file sizes | **PASS** |
| `dependencies/lockfile-missing` | LG-DEP-R001 | dependencies | low | high | `missing-lockfile` | Verified | Verified | Checks npm/pnpm/yarn/bun lockfiles | Supports all package managers | **PASS** |
| `dependencies/multiple-lockfiles` | LG-DEP-R002 | dependencies | medium | high | `multiple-lockfiles` | Verified | Verified | `package-lock.json` + `yarn.lock` together | Flags conflicting lockfiles | **PASS** |
| `dependencies/wildcard-version-range` | LG-DEP-R003 | dependencies | medium | high | `wildcard-version` | Verified | Verified | Dependencies with `*`, `latest`, empty | Recommends pinned ranges | **PASS** |

---

## 3. Boundary & Malformed-Input Observations

1. **Dynamic Metadata Functions in SEO Rules:**
   - In Next.js App Router, pages using `export async function generateMetadata()` compute title, description, and canonical tags dynamically.
   - *Observation:* Rules `seo/title-missing` and `seo/description-missing` verify presence of `generateMetadata` and abstain from emitting findings, eliminating false alarms.
2. **Commented JSON Handling:**
   - `tsconfig.json` frequently contains JavaScript-style comments (`//` or `/* ... */`).
   - *Observation:* Rules inspecting `tsconfig.json` strip comments safely before parsing, preventing false JSON syntax faults.
3. **Empty Template Files:**
   - Projects may commit a 0-byte `.env.example` placeholder.
   - *Observation:* Rule `deployment/env-var-untracked` treats empty template files as containing 0 keys, ensuring all referenced `process.env.VAR` variables in code are properly flagged.
4. **Edge CDN Security Headers:**
   - Security headers implemented in Cloudflare, AWS CloudFront, or Vercel Edge Config will not appear in `next.config.js`.
   - *Observation:* Rule `security/security-headers-missing` assigns **Low Confidence** and includes documentation noting that edge reverse-proxy configuration satisfies the production requirement.

---

## 4. Rule Matrix Verdict

**STATUS: PASS**  
All 27 MVP rules have been empirically verified across positive, negative, boundary, and malformed inputs with 100% test success.
