# Contributing to LaunchGuard

Thank you for your interest in contributing to LaunchGuard!

## Architectural Principles for Contributors

Before submitting a pull request, ensure your contribution respects the core directives from DOC-001:

1. **Independent Core Engine:** Code under `src/core/` must never import from `src/cli/` or web applications.
2. **Never Execute Target Code:** Rules must inspect source files as static text or parsed data. Never `eval()`, `require()`, or dynamic-`import()` target project files.
3. **Deterministic Output:** Results must be sorted deterministically and have stable fingerprint IDs.
4. **Redact Sensitive Information:** Never print raw credentials. Use `formatSafeEvidence()` or `redactSecrets()`.
5. **Zero External Dependencies:** Prefer Node.js standard built-ins (`node:fs`, `node:path`, `node:crypto`, `node:util`).

---

## Adding a New Audit Rule

Every new rule must:
1. Define a unique runtime rule ID (e.g., `seo/meta-description-missing`) and candidate ID (`LG-SEO-R002`).
2. Implement the `RuleDefinition` interface (`src/core/types.ts`).
3. Set `defaultSeverity`, `defaultConfidence`, `title`, `description`, `recommendation`, and a stable `documentationUrl`.
4. Implement safe static execution via `context.readFile()` or `context.readJson()`.
5. Add unit tests in `tests/unit/` covering true positive and true negative cases.
6. Register the rule in `src/rules/index.ts`.

---

## Running Tests

```bash
# Run all tests
npm test

# Run individual test suites
node --test tests/unit/rules.test.ts
node --test tests/unit/discovery.test.ts
node --test tests/unit/cli.test.ts
```
