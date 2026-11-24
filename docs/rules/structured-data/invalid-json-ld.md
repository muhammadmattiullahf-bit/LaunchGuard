# Rule: `structured-data/invalid-json-ld` (LG-SDT-R001)

- **Category:** `structured-data`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `post-mvp`

---

## 1. Architectural Scope & Non-Overlapping Boundary

LaunchGuard enforces a strict architectural boundary between JSON syntax errors and schema structural errors:

- **`structured-data/invalid-json-ld` (LG-SDT-R001 - This Rule):**  
  Operates strictly at the **JSON Lexical & Parsing Syntax Layer**. It triggers *only* when the raw text content inside `<script type="application/ld+json">` fails standard `JSON.parse` evaluation (e.g. unclosed braces, raw unescaped quotes, trailing commas, or truncated payloads).
- **`structured-data/schema-syntax-error` (LG-SDT-R004):**  
  Operates strictly at the **Schema Structural & Semantic Shape Layer**. It triggers *only* on **valid, parseable JSON** that has structural schema defects (such as empty `{}` objects, malformed non-array `@graph` containers, entities missing all content properties, or incorrect property structural categories).

Because LG-SDT-R001 aborts processing when text fails JSON parsing, and LG-SDT-R004 only runs on successfully parsed JSON (`parsed.isValidJson`), these two rules **never overlap or emit duplicate findings for the same defect**.

---

## 2. Why This Matters

Structured data in JSON-LD format must be valid, parseable JSON according to RFC 8259. Search engine crawlers (such as Googlebot) parse `<script type="application/ld+json">` tags using standard JSON parsers. If a script block contains syntax errors (such as unescaped quotes, trailing commas, or unclosed braces), parsers discard the entire block, forfeiting rich snippets and search appearance enhancements.

---

## 3. What LaunchGuard Checks

LaunchGuard scans source files in Next.js projects for `<script type="application/ld+json">` tags, including those embedded in JSX/TSX or set via `dangerouslySetInnerHTML`. It parses the literal payload using a safe, bounded JSON parser:
- Unclosed braces `{` or brackets `[`.
- Trailing commas after object properties or array elements.
- Unescaped newline characters or unescaped quotes inside string values.
- Truncated or malformed JSON payloads.

If syntax errors are detected, LaunchGuard flags the exact line and column of the malformed block with the parser error message.

Indeterminate expressions (e.g. `JSON.stringify(dynamicData)`) are excluded to avoid speculative false positives.

---

## 4. How to Fix

1. Review the JSON-LD script block and ensure all string values are enclosed in valid double quotes (`"`).
2. Remove any trailing commas after the last property in an object or array.
3. If constructing JSON-LD in JSX, use `JSON.stringify(...)` with a valid static JavaScript object literal.

### Bad Example (Trailing comma causes JSON parse error)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "My Site",
}
</script>
```

### Good Example (Valid JSON)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "My Site"
}
</script>
```
