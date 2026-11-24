# Rule: `structured-data/schema-syntax-error` (LG-SDT-R004)

- **Category:** `structured-data`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `post-mvp`

---

## 1. Architectural Scope & Non-Overlapping Boundary

LaunchGuard enforces a strict architectural boundary between JSON syntax errors and schema structural errors:

- **`structured-data/invalid-json-ld` (LG-SDT-R001):**  
  Operates strictly at the **JSON Lexical & Parsing Syntax Layer**. It triggers *only* when the raw text content inside `<script type="application/ld+json">` fails standard `JSON.parse` evaluation (e.g. unclosed braces, raw unescaped quotes, trailing commas, or truncated payloads).
- **`structured-data/schema-syntax-error` (LG-SDT-R004 - This Rule):**  
  Operates strictly at the **Schema Structural & Semantic Shape Layer**. It triggers *only* on **valid, parseable JSON** that has structural schema defects (such as empty `{}` objects, malformed non-array `@graph` containers, entities missing all content properties, or incorrect property structural categories).

Because LG-SDT-R004 only runs on successfully parsed JSON (`parsed.isValidJson`), these two rules **never overlap or emit duplicate findings for the same defect**.

---

## 2. Why This Matters

Search engine schema validators require clean, well-formed entity objects. Declaring empty objects (`{}`), empty arrays, malformed `@graph` structures, empty string properties (such as `"name": ""`), or incorrect property value types (e.g. passing a string where an array of items is required) leads to validation errors and ignored metadata.

---

## 3. What LaunchGuard Checks

On parseable JSON-LD payloads, LaunchGuard verifies the internal structural consistency of the declared entities against Schema.org conventions and the bundled Schema Knowledge Base:
1. **Empty Blocks & Objects:** `<script type="application/ld+json"></script>` tags with empty bodies or root JSON objects declared as `{}` or `[]`.
2. **Malformed `@graph` Containers:** `@graph` properties that are not arrays or contain empty entities.
3. **Empty Content Entities:** Entities that declare `@context` and/or `@type` but contain zero content properties.
4. **Empty Property Values:** Properties declared with empty string values (`""`).
5. **Structural Category Mismatches:** Properties where the Schema.org model requires a structural category that is violated (e.g., `itemListElement` must be an `Array`, `mainEntity` must be an `Array` or `Object`).

---

## 4. How to Fix

1. Remove unused empty `<script type="application/ld+json">` tags or empty `{}` objects.
2. Ensure properties contain meaningful, non-empty values.
3. Format `@graph` as an array of entity objects.
4. Ensure property value types match Schema.org specifications (e.g. use an array for list items).

### Bad Example (Structural Mismatch: `itemListElement` is a string instead of array)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": "Home > Blog"
}
```

### Good Example (Correct Array Structure)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home"
    }
  ]
}
```
