# ADR-003: Rule API, Metadata, and Extension Model

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-FR-004, LG-FR-008, LG-FR-009, LG-FR-010, LG-FR-011, LG-FR-020, LG-FR-028, LG-NFR-010, LG-NFR-013
- **Related Open Question:** OQ-012, OQ-014

## Context

LaunchGuard's core principle is an extensible, maintainable rule architecture (P-08, LG-NFR-010). Rules must be self-contained units with uniform metadata, isolated execution, clear documentation links, and deterministic finding generation.

## Decision

1. **Rule Runtime Identifier Scheme:**
   - Runtime `ruleId` follows a clean, namespaced, kebab-case format: `<category>/<rule-name>`, matching the candidate ID:
     - Example: `seo/title-missing` (`LG-SEO-R001`)
     - Example: `security/env-not-ignored` (`LG-SEC-R001`)
     - Example: `security/secret-token-leak` (`LG-SEC-R002`)
     - Example: `code-quality/typescript-strict` (`LG-COD-R002`)
     - Example: `performance/large-static-asset` (`LG-PRF-R001`)
     - Example: `dependencies/lockfile-missing` (`LG-DEP-R001`)
     - Example: `deployment/env-template-missing` (`LG-DPL-R001`)
   - Each rule metadata explicitly registers its DOC-001 candidate ID (`LG-<MOD>-Rnnn`) for strict requirement traceability.

2. **Rule Interface Definition:**
   - Every rule is an object implementing `RuleDefinition`:
     ```typescript
     export interface RuleDefinition {
       id: string; // e.g. "seo/title-missing"
       candidateId: string; // e.g. "LG-SEO-R001"
       category: RuleCategory; // "seo" | "security" | "code-quality" | "performance" | "dependencies" | "deployment"
       title: string;
       description: string;
       defaultSeverity: Severity; // "critical" | "high" | "medium" | "low" | "informational"
       defaultConfidence: Confidence; // "high" | "medium" | "low"
       documentationUrl: string;
       releaseClass: 'mvp' | 'post-mvp';
       requiresNetwork: boolean; // Always false for MVP
       execute: (context: RuleExecutionContext) => Promise<RuleFindingInput[]> | RuleFindingInput[];
     }
     ```

3. **Rule Execution Context:**
   - Rules receive a read-only, safe context:
     - `project`: Resolved project descriptor (root, router type, detected configs).
     - `files`: Safe indexed files within canonical root.
     - `readFile(relativePath: string, maxSize?: number)`: Safe containment-checked reader.
     - `readJson(relativePath: string)`: Safe JSON parser.
     - `options`: Effective scan options.

4. **Fault Isolation (LG-FR-020):**
   - The Scan Orchestrator executes rules wrapped in per-rule error boundaries and timeouts.
   - If a rule throws an exception, times out, or emits an invalid finding, the orchestrator catches it, records a rule fault in the scan status (`incomplete`), and continues executing remaining rules.

## Consequences

### Positive
- Strict isolation: no single buggy rule can crash the entire scan.
- Adding new rules is modular and requires zero modification to the scan orchestrator.
- Deterministic finding IDs generated from stable fingerprints.
