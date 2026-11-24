# ADR-002: Static Parsing Strategy and Untrusted Target Safety

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-SEC-001, LG-SEC-002, LG-SEC-006, LG-FR-005, LG-FR-006, LG-FR-021, LG-FR-022, LG-FR-023
- **Related Open Question:** OQ-009

## Context

DOC-001 establishes the foundational security directive:
- **Never execute target-project code (P-02, LG-SEC-001, LG-SEC-002).**
- LaunchGuard must never `require()`, `import()`, or `eval()` any target project files, including `next.config.js`, `next.config.ts`, `next.config.mjs`, `.eslintrc.js`, or `tsconfig.json`.
- All target files must be treated as untrusted data.
- The tool must remain fast, deterministic, and maintain a minimal dependency footprint (P-10).

Target repositories contain:
1. JSON files (`package.json`, `tsconfig.json`, `.launchguardrc.json`, lockfiles).
2. Configuration files (`next.config.*`, `.env*`, `.gitignore`).
3. Source files (`app/**`, `pages/**`, `src/**`).

## Decision

1. **JSON Files:**
   - Parse using safe, bounded standard JSON parsers (`JSON.parse` with try/catch, stripped of comments or JSONC handling where appropriate).
   - Strict size and depth limits to prevent parser resource exhaustion.

2. **Configuration Files (`next.config.*`):**
   - Read strictly as text/data without execution.
   - For JavaScript/TypeScript configuration files:
     - Use static pattern extraction and AST traversal where determinable.
     - Never evaluate dynamic code, imported modules, or runtime functions.
     - When an option cannot be statically proven, emit "not determinable" / Low confidence rather than guessing (P-04, P-05).

3. **Source Files & Metadata Detection:**
   - For Next.js App Router metadata conventions (`metadata` static export, `robots.ts`/`robots.txt`, `sitemap.ts`/`sitemap.xml`, etc.):
     - Inspect route file existence (convention-based files in `app/`).
     - Statically inspect exports for literal values using AST or robust regex/token analysis with ReDoS protection.
     - Never invoke Next.js compilers, babel plugins, or webpack/turbopack.

4. **Environment & Ignore Files:**
   - Parse `.env*` and `.gitignore` as plain text line-by-line key/value and pattern files.
   - Treat all values read from `.env*` as sensitive and pass immediately through the Secret Redaction subsystem before storage or logging.

## Consequences

### Positive
- Immune to remote code execution (RCE) via untrusted repository configuration files or malicious lifecycle hooks.
- Extremely low memory and CPU overhead.
- Safe on corrupted, non-compiling, or hostile codebases.

### Negative
- Dynamic configuration (e.g. `headers: async () => fetchHeadersFromCms()`) cannot be evaluated and will correctly report "not determinable" at Low confidence as required by DOC-001.
