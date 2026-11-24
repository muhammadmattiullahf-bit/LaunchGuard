# Security Policy

## LaunchGuard Security Model & Trust Boundaries

LaunchGuard is designed specifically to audit untrusted repositories safely. Its security architecture is governed by DOC-001 Section 21:

1. **Zero Execution of Target Code (LG-SEC-001, LG-SEC-002):**
   - LaunchGuard never executes scripts, package-manager commands, build steps, or tests in the target directory.
   - Target configuration files (`next.config.*`, `.eslintrc.*`, `tsconfig.json`, `.launchguardrc.json`) are read strictly as static text or data and are NEVER dynamically imported or evaluated.

2. **Containment & Filesystem Boundary (LG-SEC-003, LG-SEC-004):**
   - File access is strictly bounded to the canonicalized project root.
   - Symlinks resolving outside the project root are ignored.
   - Cyclic symlinks are detected to prevent infinite traversal.

3. **Secret Redaction (LG-SEC-007, LG-FR-018):**
   - Hardcoded tokens, API keys, passwords, and private keys detected by rules are masked (`[REDACTED:<type>]`) before emission.
   - Redaction is applied across all output formats (terminal, JSON, SARIF) and log levels.
   - If redactor validation fails, the evidence snippet is omitted completely.

4. **Network Access (LG-SEC-010, LG-SEC-011):**
   - Default audits perform zero outbound network requests.
   - The tool does not include telemetry or remote analytics.

## Reporting a Vulnerability

If you discover a security vulnerability in LaunchGuard itself, please do not file a public issue. Send reports directly to the maintainers:

- **Email:** `security@launchguard.dev` (provisional)
- **Response window:** Acknowledgement within 48 hours with a coordinated disclosure timeline.
