# Rule: `structured-data/missing-context-or-type` (LG-SDT-R002)

- **Category:** `structured-data`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `post-mvp`

## Why This Matters

Schema.org JSON-LD requires both an `@context` and an `@type` declaration. The `@context` specifies the vocabulary namespace (typically `"https://schema.org"`), and `@type` specifies the Schema entity classification (e.g. `Organization`, `WebSite`, `Article`). Without these declarations, search engines and Schema validators cannot interpret the entity or map its properties.

## What LaunchGuard Checks

LaunchGuard inspects parsed JSON-LD objects and items within `@graph` arrays to verify:
1. `@context` is declared and matches a valid Schema.org vocabulary URL (`https://schema.org` or `http://schema.org`).
2. `@type` is declared as a non-empty string or array of entity types.

If either declaration is missing or empty, LaunchGuard emits a finding with specific remediation guidance.

## How to Fix

Add the standard Schema.org `@context` and appropriate `@type` to your JSON-LD object:
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "My Company",
  "url": "https://example.com"
}
```
If using `@graph`, ensure `@context` is declared on the root object or each entity in the graph.
