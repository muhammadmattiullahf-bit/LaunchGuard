# Rule: `performance/large-static-asset` (LG-PRF-R001)

- **Category:** `performance`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Uncompressed, oversized static files (high-resolution PNGs, uncompressed video, large fonts) in the `public/` directory can degrade Largest Contentful Paint (LCP) and consume excessive user bandwidth if served without CDN optimization or responsive scaling.

## What LaunchGuard Checks

Checks files in `public/` that exceed the static size threshold (default: 500KB).

## Limitations Note

This finding is an informational static file-size indicator only. It does not measure or claim to reflect real runtime browser performance, network conditions, or caching behavior.

## How to Fix

Compress images using modern formats (WebP, AVIF) via `next/image` or host heavy media on a dedicated content delivery network.
