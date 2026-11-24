# ADR-005: Finding and Report Schema, SARIF Mapping, and Redaction

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-FR-009, LG-FR-010, LG-FR-011, LG-FR-012, LG-FR-013, LG-FR-014, LG-FR-015, LG-FR-018, LG-SEC-007, LG-SEC-016
- **Related Open Question:** OQ-013

## Context

DOC-001 Section 20 defines the required fields for findings and reports:
- Deterministic finding IDs based on stable fingerprints (excluding volatile line numbers).
- Standard severities: `critical`, `high`, `medium`, `low`, `informational`.
- Standard confidences: `high`, `medium`, `low`.
- Formats: Terminal (human-readable), JSON (machine-readable), and SARIF (Static Analysis Results Interchange Format 2.1.0).
- Mandatory secret redaction across all output formats and log levels.
- Readiness scoring formula with mandatory disclaimer.

## Decision

1. **Deterministic Fingerprint & Finding ID:**
   - Fingerprint hash: SHA-256 over `${ruleId}::${relativePath}::${normalizedAnchor}`.
   - Line numbers are tracked for presentation but excluded from the fingerprint so edits elsewhere in the file do not alter finding identity.

2. **JSON Report Schema (`v1`):**
   ```json
   {
     "schemaVersion": "1.0.0",
     "tool": {
       "name": "launchguard",
       "version": "0.1.0"
     },
     "status": "complete",
     "scan": {
       "targetPath": ".",
       "startTime": "...",
       "endTime": "...",
       "durationMs": 42,
       "categoriesExecuted": ["seo", "security"],
       "rulesExecutedCount": 12,
       "filesScannedCount": 24,
       "networkUsed": false
     },
     "summary": {
       "totalFindings": 2,
       "bySeverity": {
         "critical": 0,
         "high": 1,
         "medium": 1,
         "low": 0,
         "informational": 0
       },
       "suppressedCount": 0,
       "readinessScore": {
         "overall": 82,
         "disclaimer": "The readiness score is an informational heuristic derived from the findings of a static scan. It is not a security certification, audit attestation or guarantee of production readiness.",
         "byCategory": {
           "seo": 90,
           "security": 74
         }
       }
     },
     "findings": [...],
     "suppressed": [...],
     "faults": [],
     "skippedFiles": []
   }
   ```

3. **SARIF 2.1.0 Mapping:**
   - Complies with OASIS SARIF v2.1.0 specification.
   - Severity mappings:
     - `critical`, `high` -> `"error"`
     - `medium` -> `"warning"`
     - `low`, `informational` -> `"note"`

4. **Redaction Guarantee (LG-FR-018, LG-SEC-007):**
   - The redaction engine operates prior to any finding collection or emission.
   - All secret-like tokens are replaced with `[REDACTED:<type>]` (e.g. `[REDACTED:API_KEY]`).
   - If redactor validation encounters any uncertainty, evidence is completely omitted.

## Consequences

- Completely predictable, machine-readable outputs for CI/CD integration.
- Zero possibility of credential leaks into reports or dashboards.
