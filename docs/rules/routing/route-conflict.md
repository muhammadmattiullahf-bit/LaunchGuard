# Rule: `routing/route-conflict` (LG-RTE-R003)

- **Category:** `routing`
- **Default Severity:** `high`
- **Default Confidence:** `high`
- **Release Class:** `post-mvp`

## Why This Matters

Next.js filesystem routing requires that every public URL path maps to a single, unambiguous handler. When two or more files resolve to the exact same URL path, Next.js either fails the production build (`npm run build`) or exhibits non-deterministic runtime behavior where one route unpredictably overrides another.

Common causes include:
1. Defining the same route in both App Router (`app/about/page.tsx`) and Pages Router (`pages/about.tsx`).
2. Conflicting route groups (e.g. `app/(marketing)/pricing/page.tsx` and `app/(sales)/pricing/page.tsx`, both resolving to `/pricing`).
3. Conflicting file extensions (e.g. `app/about/page.tsx` and `app/about/page.js`).

## What LaunchGuard Checks

LaunchGuard statically builds the route manifest and identifies any normalized URL path defined by multiple distinct source files. If a conflict is discovered, a `high` severity finding is emitted detailing all conflicting source files.

## How to Fix

Inspect the conflicting files listed in the finding evidence:
1. Delete the duplicate or redundant route file.
2. If using route groups, ensure that page names across different groups are unique.
3. Migrate legacy `pages/` routes fully into `app/` if adopting App Router.
