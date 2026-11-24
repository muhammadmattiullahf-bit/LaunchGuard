# ADR-004: Configuration Format and Data-Only Loading

- **Status:** Approved (Working Baseline for MVP)
- **Date:** 2026-11-19
- **Related Requirements:** LG-FR-006, LG-FR-007, LG-SEC-008, LG-US-007
- **Related Open Question:** OQ-010

## Context

DOC-001 Section 15 (LG-FR-006) and Section 21 (LG-SEC-008) mandate:
- Configuration must be **data only**.
- Executable formats (`.launchguardrc.js`, `launchguard.config.ts`, etc.) are forbidden in the MVP to prevent code execution when scanning untrusted repositories.
- CLI options must take precedence over configuration file settings, which take precedence over built-in defaults.

## Decision

1. **Supported Configuration Formats:**
   - Primary: `.launchguardrc.json` or `launchguard.json` at the project root.
   - Secondary: `package.json` under the `"launchguard"` key.
   - Custom: Any file path passed via `--config <path>`.

2. **Schema and Validation:**
   - Strict schema validation: unknown top-level keys or invalid property types produce a clear configuration error (CLI exit code 2) naming the offending key.
   - Size limit: Configuration files larger than 1MB are rejected to prevent memory exhaustion.
   - Supported settings:
     ```json
     {
       "$schema": "https://launchguard.dev/schema/v1/config.json",
       "categories": ["seo", "security", "code-quality", "performance", "dependencies", "deployment"],
       "skip": [],
       "failOn": "high",
       "minConfidence": "low",
       "rules": {
         "seo/title-missing": {
           "severity": "high",
           "enabled": true
         }
       },
       "suppressions": [
         {
           "ruleId": "security/source-maps-enabled",
           "path": "next.config.mjs",
           "reason": "Internal staging build only"
         }
       ],
       "limits": {
         "maxFileSize": 10485760,
         "timeoutMs": 30000
       }
     }
     ```

3. **`init` Command Behavior:**
   - Generates a well-commented/structured `.launchguardrc.json` file.
   - Refuses to overwrite existing files unless `--force` is specified.
   - Zero network requests.

## Consequences

- Completely immune to code execution attacks via configuration.
- Simple, transparent schema easily shared in CI/CD pipelines.
