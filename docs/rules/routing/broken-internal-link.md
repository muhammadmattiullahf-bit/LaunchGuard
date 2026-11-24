# Rule: `routing/broken-internal-link` (LG-RTE-R001)

- **Category:** `routing`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `post-mvp`

## Why This Matters

Broken internal links degrade user experience, increase bounce rates, and harm search engine crawl efficiency. When a visitor or crawler follows a navigation link `<Link href="...">`, `<a href="...">`, or router navigation call (`router.push()`) that points to a non-existent route, Next.js displays a 404 error page.

## What LaunchGuard Checks

LaunchGuard constructs a static Next.js route manifest representing all discovered App Router and Pages Router routes, including dynamic routes (`[id]`, `[...slug]`, `[[...slug]]`) and route groups. It then inspects JSX components and source files for:
1. `<Link href="...">` and `<Link href={'...'}>`
2. `<a href="...">` and `<a href={'...'}>`
3. `router.push('/...')` and `router.replace('/...')`
4. Statically determinable template literals and local paths

If an internal link references a URL path that cannot be matched to any statically discoverable route in the project, LaunchGuard flags it as a `broken-internal-link`. External URLs, email (`mailto:`), phone (`tel:`), fragment-only targets (`#`), and indeterminate dynamic variables are excluded to prevent false positives.

## How to Fix

Verify the target URL path against your project's routing structure:
1. Correct typos in the `href` attribute (e.g. change `/aboot` to `/about`).
2. If the page is missing, create the corresponding page file (e.g. `app/about/page.tsx` or `pages/about.tsx`).
3. For dynamic links, verify the segment matches the dynamic route definition (e.g. `/products/123` matches `app/products/[id]/page.tsx`).
