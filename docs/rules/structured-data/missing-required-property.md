# Rule: `structured-data/missing-required-property` (LG-SDT-R003)

- **Category:** `structured-data`
- **Default Severity:** `low`
- **Default Confidence:** `medium`
- **Release Class:** `post-mvp`

---

## 1. Context & Architectural Distinction

To ensure accurate static analysis, LaunchGuard strictly distinguishes between three layers of structured data expectations:

1. **Schema.org Specification Flexibility:**  
   The underlying Schema.org vocabulary is descriptive rather than prescriptive. Most properties in the Schema.org standard are formally optional, designed to accommodate varied web content.
2. **Search-Engine Rich-Result Guidelines & Recommendations:**  
   Major search engines (such as Google, Bing, and others) publish specific documentation recommending or requiring certain properties for rich snippet eligibility (e.g., `headline` and `author` for `Article`, `name` and `offers` for `Product`, `itemListElement` for `BreadcrumbList`).
3. **LaunchGuard's Curated Offline Validation Checks:**  
   LaunchGuard maintains a bundled, offline Schema Knowledge Base (`src/knowledge/schema/`) reflecting common rich-result conventions. When a high-impact property is missing from a supported entity, LaunchGuard emits an **advisory finding** with `severity: 'low'` and `confidence: 'medium'`. This finding indicates an opportunity to improve structured data completeness rather than a fatal JSON or schema syntax error.

> [!NOTE]  
> LaunchGuard is a static analysis tool. Passing this rule does not guarantee search engine rich result eligibility or indexing, nor does it imply official endorsement or certification by Google or Schema.org.

---

## 2. Why This Matters

While omitting a recommended property will not invalidate JSON syntax or cause client-side runtime crashes, search engines rely on key properties to construct structured search cards, breadcrumb trails, and rich snippets. Omitting key identifying fields (such as `name` on `Product` or `itemListElement` on `BreadcrumbList`) typically results in search engines treating the markup as incomplete for enhanced search features.

---

## 3. What LaunchGuard Checks

LaunchGuard evaluates statically discovered JSON-LD entities of supported types against its curated Knowledge Base:

- `Organization` / `Corporation`: recommended `name` (or `legalName`), `url`.
- `WebSite`: recommended `name`, `url`.
- `WebPage`: recommended `name` (or `url`, `headline`).
- `Article` / `NewsArticle` / `BlogPosting`: recommended `headline`, `author` (or `publisher`), `datePublished`.
- `Product`: recommended `name`, and at least one of `offers`, `review`, or `aggregateRating`.
- `BreadcrumbList`: recommended `itemListElement` (must be an array).
- `LocalBusiness`: recommended `name` (or `legalName`), `address`, `telephone`.
- `FAQPage`: recommended `mainEntity` (must be an array or object of `Question` items).

If an entity lacks one of these standard identifying properties, LaunchGuard reports a low-severity advisory finding indicating which property is recommended.

---

## 4. How to Fix

Add the recommended property to the JSON-LD entity declaration.

### Example: Article Entity

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Understanding Next.js Structured Data",
  "author": {
    "@type": "Person",
    "name": "Jane Doe"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Tech Publishing Co."
  },
  "datePublished": "2026-11-20"
}
```

### Example: BreadcrumbList Entity

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://example.com/blog"
    }
  ]
}
```
