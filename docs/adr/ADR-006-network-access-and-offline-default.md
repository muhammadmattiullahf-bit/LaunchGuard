# ADR-006: Network Access, Offline Default, and Advisory Data Consent

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-PG-002, LG-FR-019, LG-FR-026, LG-FR-030, LG-SEC-010, LG-SEC-011, LG-NFR-008, P-01
- **Related Open Question:** OQ-017, OQ-020

## Context

DOC-001 Table 13.6 lists ADR-006 ("Network access, consent and advisory data source").
During initial foundation work, ADR-006 numbering was not authored alongside ADR-005 and ADR-007 because external advisory lookup is formally classified as **Post-MVP** in DOC-001 Section 14.5 and Section 25.
However, omitting ADR-006 created a documentation gap. A definitive architecture decision is required to formalize LaunchGuard's network boundaries for the MVP and future network integrations.

## Decision

1. **Strict Offline Default for MVP (P-01, LG-FR-019, LG-SEC-010):**
   - In the MVP, LaunchGuard initiates **zero** outbound network connections under any circumstances.
   - All MVP audit modules (SEO, Security, Code Quality, Deployment, Performance, Dependencies) operate entirely offline by inspecting local project files.
   - Dependency auditing in the MVP is restricted to offline manifest and lockfile hygiene (`LG-DEP-R001`, `LG-DEP-R002`, `LG-DEP-R003`).

2. **No Telemetry (LG-SEC-021, OQ-020):**
   - The CLI and Core Engine contain zero analytics, usage tracking, pingbacks, or telemetry probes.

3. **Post-MVP Network Architecture & Consent Protocol (LG-FR-030, LG-SEC-011):**
   - When external advisory lookups or remote CVE checks are introduced in Post-MVP:
     - Network access must be disabled by default.
     - Execution will require an explicit CLI flag (e.g., `--allow-network`) or explicit configuration consent.
     - LaunchGuard must publish a transparent payload specification documenting exactly what data is sent (package names and versions only; never source code, repository paths, or environment variables).
     - Network failure must gracefully degrade to an `incomplete` rule status rather than crashing local analysis.

## Consequences

### Positive
- Air-gapped and offline execution guarantee for developer environments and secure CI runners.
- Eliminates supply-chain exposure from target repository registry settings (`.npmrc`).
- Unambiguous privacy posture with zero data exfiltration risks.

### Negative
- Real-time vulnerability advisories (CVE lookups) are unavailable in the initial MVP release.
