# Rule: `security/secret-token-leak` (LG-SEC-R002)

- **Category:** `security`
- **Default Severity:** `critical`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Hardcoding secrets, API tokens, private keys, database passwords, or third-party service credentials in source or configuration files allows unauthorized parties to compromise databases, cloud accounts, and APIs. In Next.js, code in client components is bundled into public JavaScript files served to every visitor.

## What LaunchGuard Checks

LaunchGuard statically scans source code files, configurations, and templates (excluding ignored `.env` files) against high-confidence signatures for:
- Private Keys (`-----BEGIN ... PRIVATE KEY-----`)
- AWS Access Key IDs and Secrets
- GitHub Personal Access Tokens and App Tokens (`ghp_`, `github_pat_`)
- OpenAI and Anthropic API keys (`sk-`, `sk-ant-`)
- Google Cloud API keys (`AIza...`)
- Slack tokens (`xoxb-`, `xoxp-`)
- Database connection strings with embedded passwords (`postgres://user:pass@host/db`)

### Redaction Guarantee

All detected secrets are masked with placeholders (e.g. `[REDACTED:API_KEY]`) prior to report generation or logging. LaunchGuard will **never** print the raw secret value to stdout, stderr, or reports.

## How to Fix

1. Immediately rotate and revoke the exposed secret in your provider's dashboard.
2. Remove the hardcoded secret from the code and commit history.
3. Move the secret to `.env.local` for local development.
4. Access the secret exclusively in Server Components, Server Actions, or Route Handlers via `process.env.<VARIABLE_NAME>`.
