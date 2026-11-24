# Rule: `security/public-env-leak` (LG-SEC-R003)

- **Category:** `security`
- **Default Severity:** `high`
- **Default Confidence:** `medium`
- **Release Class:** `mvp`

## Why This Matters

Next.js automatically embeds any environment variable prefixed with `NEXT_PUBLIC_` into client-side JavaScript bundles sent to the browser. Naming secrets with this prefix risks exposing private keys or database passwords to all visitors.

## What LaunchGuard Checks

Checks `.env*` files and templates for `NEXT_PUBLIC_` variables containing sensitive tokens such as `SECRET`, `PRIVATE_KEY`, `PASSWORD`, `TOKEN`, or `API_KEY`.

## How to Fix

Remove the `NEXT_PUBLIC_` prefix and access the variable only in Server Components or API routes via `process.env`.
