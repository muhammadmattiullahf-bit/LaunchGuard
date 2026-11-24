# LaunchGuard — M5 Link Extraction Validation Report

**Document Reference:** LG-QA-M5-003  
**Target:** `src/core/routing/link-extractor.ts`  
**Audit Date:** 2026-11-20  
**Status:** Audit Complete  
**Auditor:** Independent Software QA & Architecture Audit Team  

---

## 1. Scope of Audit

This audit evaluates the link extraction subsystem (`src/core/routing/link-extractor.ts`). The objective is to verify that LaunchGuard extracts internal navigation targets safely, without executing target project code, while evaluating the limitations inherent in regular expression parsing versus full AST compilation.

---

## 2. Verified Parsing Capabilities

The following syntax constructs were verified to extract correctly:
1. **Standard JSX Components:**
   - `<Link href="/about">` (double quotes)
   - `<Link href='/contact'>` (single quotes)
   - `<Link href={"/pricing"}>` (JSX expression string)
   - `<Link href={'/team'}>` (JSX expression single quote)
   - `<Link href={`/blog`}>` (static template literal)
2. **Dynamic & Indeterminate Expressions:**
   - `<Link href={`/products/${id}`}>` -> Extracted as `dynamic-template`, `templatePrefix: '/products/'`
   - `<Link href={targetUrl}>` -> Extracted as `indeterminate`
3. **HTML Anchor Tags:**
   - `<a href="/legal">Terms</a>`
   - `<a href={'/privacy'}>Privacy</a>`
4. **Imperative Router Navigation:**
   - `router.push('/dashboard')`
   - `router.replace('/login')`
   - `router.push(`/user/${id}`)`
5. **Non-Internal Classification:**
   - `https://external.org` -> Classified as `external`
   - `mailto:support@test.com` -> Classified as `ignored`
   - `#overview` -> Classified as `ignored`
6. **ReDoS Resistance & Linear-Time Indexing:**
   - Evaluated against a synthetic file containing 5,000 links in oversized JSX structures.
   - Parsed in ~12 milliseconds, verifying that the combination of bounded regexes and binary-search `LineIndex` maintains strictly linear-time performance.

---

## 3. Detailed Edge Case Analysis & Findings

### Finding QA-M5-002: Commented-Out Links Extracted by Regex
- **Severity:** Low
- **Affected File:** `src/core/routing/link-extractor.ts`, lines 118–170
- **Reproduction Scenario:**
  A source file contains a commented-out component pointing to a deprecated or missing route:
  ```tsx
  // <Link href="/old-deprecated-page">Legacy</Link>
  /* <Link href="/temp-broken">Temp</Link> */
  ```
- **Expected Behavior:**
  A full AST compiler ignores comments and does not extract links from commented code.
- **Actual Behavior:**
  Because `link-extractor.ts` operates via regular expressions over raw source text, `<Link href="/old-deprecated-page">` is matched and extracted. If `/old-deprecated-page` does not exist in the route manifest, rule `routing/broken-internal-link` will flag it as a broken internal link.
- **Evidence:**
  `link-extractor.ts` processes `content` directly without a comment-stripping pre-pass:
  ```typescript
  while ((match = linkComponentRegex.exec(content)) !== null) { ... }
  ```
- **Recommended Correction (Post-M5 / M7):**
  Add a lightweight comment-stripping regex pre-processor (or full AST parser when external dependencies/parsers are authorized in M7).

---

### Finding QA-M5-003: String Literals Containing JSX-Like Markup
- **Severity:** Low
- **Affected File:** `src/core/routing/link-extractor.ts`, lines 118–170
- **Reproduction Scenario:**
  A developer writes an ordinary string literal or documentation snippet inside code:
  ```typescript
  const helpText = 'Use <Link href="/example"> to navigate';
  ```
- **Expected Behavior:**
  String literals are not evaluated as live JSX components.
- **Actual Behavior:**
  The regex matches `<Link href="/example">` within the string and treats it as an internal link.
- **Evidence:**
  Regex has no lexical scope awareness between JSX elements and string literal tokens.
- **Recommended Correction:**
  Document as an inherent static regex matching trade-off.

---

### Finding QA-M5-004: Aliased or Third-Party `<Link>` Components
- **Severity:** Low
- **Affected File:** `src/core/routing/link-extractor.ts`, line 118
- **Reproduction Scenario:**
  A file imports a component named `Link` from an external icon or UI library:
  ```tsx
  import { Link } from 'lucide-react';
  // ...
  <Link href="/icon-link" className="w-4 h-4" />
  ```
- **Expected Behavior:**
  Only `next/link` components are audited for Next.js routing.
- **Actual Behavior:**
  Any element matching `<Link ... href="...">` is extracted regardless of import source.
- **Evidence:**
  Regex does not inspect `import Link from 'next/link'`.
- **Recommended Correction:**
  Correlate `<Link>` occurrences with the presence of `import ... from 'next/link'` in the same source file.

---

### Finding QA-M5-005: Long Attribute Lists Exceeding Regex Boundary
- **Severity:** Low
- **Affected File:** `src/core/routing/link-extractor.ts`, lines 118, 173
- **Reproduction Scenario:**
  A `<Link>` component has more than 1,000 characters of attributes placed before `href`:
  ```tsx
  <Link className="..." data-tracking-payload="..." aria-label="..." href="/target">
  ```
- **Expected Behavior:**
  The link is extracted.
- **Actual Behavior:**
  Because the regex bounds attribute distance to 1,000 characters (`<Link\b([^>]{0,1000})\bhref\s*=\s*`) to prevent catastrophic backtracking (ReDoS), attributes exceeding 1,000 characters before `href` will cause the regex not to match.
- **Evidence:**
  The 1,000 character bound is an intentional security control for ADR-002 ReDoS defense.
- **Assessment:**
  This is a sound security trade-off. Extreme attribute lengths (>1,000 characters before `href`) are rare, and bounding protects against denial-of-service.
