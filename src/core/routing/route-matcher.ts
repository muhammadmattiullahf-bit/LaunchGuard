import path from 'node:path';
import type { RouteDefinition, RouteManifest } from './route-manifest.ts';
import type { ExtractedLink } from './link-extractor.ts';

export interface RouteMatchResult {
  matched: boolean;
  target: string;
  normalizedPath: string;
  matchedRoute?: RouteDefinition | undefined;
  isIndeterminate: boolean;
  reason?: string | undefined;
}

/**
 * Normalizes a URL target by stripping query parameters and hashes,
 * resolving relative paths, and normalizing slashes.
 */
export function normalizeLinkTarget(target: string, sourceFile?: string): string {
  let cleaned = target.trim();

  // Strip query string and fragment
  const queryIndex = cleaned.indexOf('?');
  if (queryIndex !== -1) {
    cleaned = cleaned.slice(0, queryIndex);
  }
  const hashIndex = cleaned.indexOf('#');
  if (hashIndex !== -1) {
    cleaned = cleaned.slice(0, hashIndex);
  }

  // Handle relative targets (e.g. ./about or ../contact)
  if (cleaned.startsWith('./') || cleaned.startsWith('../')) {
    if (sourceFile) {
      // Find route path of the source file
      const dir = path.dirname(sourceFile).replace(/\\/g, '/');
      // Strip app or pages prefix
      const strippedDir = dir
        .replace(/^(?:src\/)?(?:app|pages)(?:\/|$)/, '/')
        .replace(/\/\([^)]+\)/g, '') // remove route groups
        .replace(/\/+/g, '/');
      cleaned = path.posix.join(strippedDir, cleaned);
    }
  }

  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }

  // Normalize slashes
  cleaned = cleaned.replace(/\/+/g, '/');

  // Strip trailing slash except for root "/"
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Splits a path into non-empty segments.
 */
function toSegments(p: string): string[] {
  return p.split('/').filter((s) => s.length > 0);
}

/**
 * Checks if target segments match route segments, supporting Next.js dynamic routing:
 * - [id]: single dynamic parameter
 * - [...slug]: catch-all (1 or more segments)
 * - [[...slug]]: optional catch-all (0 or more segments)
 */
function matchSegments(targetSegs: string[], routeSegs: string[]): boolean {
  let tIdx = 0;
  let rIdx = 0;

  while (rIdx < routeSegs.length && tIdx < targetSegs.length) {
    const rSeg = routeSegs[rIdx];
    const tSeg = targetSegs[tIdx];

    if (!rSeg || !tSeg) break;

    // Optional catch-all: [[...param]]
    if (rSeg.startsWith('[[...') && rSeg.endsWith(']]')) {
      // Matches remaining target segments (0 or more)
      return true;
    }

    // Catch-all: [...param]
    if (rSeg.startsWith('[...') && rSeg.endsWith(']')) {
      // Matches 1 or more target segments
      return targetSegs.length >= routeSegs.length;
    }

    // Standard dynamic: [param]
    if (rSeg.startsWith('[') && rSeg.endsWith(']')) {
      // Matches any single segment
      tIdx++;
      rIdx++;
      continue;
    }

    // Static segment: exact case-sensitive match
    if (rSeg === tSeg) {
      tIdx++;
      rIdx++;
      continue;
    }

    return false;
  }

  // Handle end of route segments
  if (rIdx === routeSegs.length && tIdx === targetSegs.length) {
    return true;
  }

  // Special case: optional catch-all [[...param]] matching 0 segments
  if (rIdx === routeSegs.length - 1 && tIdx === targetSegs.length) {
    const lastRouteSeg = routeSegs[rIdx];
    if (lastRouteSeg && lastRouteSeg.startsWith('[[...') && lastRouteSeg.endsWith(']]')) {
      return true;
    }
  }

  return false;
}

/**
 * Matches an extracted link against the route manifest.
 */
export function matchLinkToRoute(
  link: ExtractedLink,
  manifest: RouteManifest
): RouteMatchResult {
  // 1. External or ignored links are automatically considered non-broken
  if (link.classification === 'external' || link.classification === 'ignored') {
    return {
      matched: true,
      target: link.target,
      normalizedPath: link.target,
      isIndeterminate: false,
    };
  }

  // 2. Indeterminate dynamic identifiers (e.g. href={userUrl})
  if (link.classification === 'indeterminate') {
    return {
      matched: true,
      target: link.target,
      normalizedPath: link.target,
      isIndeterminate: true,
      reason: 'Dynamic expression cannot be statically resolved.',
    };
  }

  const normalized = normalizeLinkTarget(
    link.classification === 'dynamic-template' && link.templatePrefix
      ? link.templatePrefix
      : link.target,
    link.sourceFile
  );

  // 3. Dynamic template matching (e.g. `/products/${id}` -> prefix `/products`)
  if (link.classification === 'dynamic-template') {
    const prefixSegs = toSegments(normalized);
    // Find any route whose initial segments match prefixSegs and continues with a dynamic parameter
    const matchedDynamic = manifest.routes.find((r) => {
      const rSegs = toSegments(r.path);
      if (rSegs.length < prefixSegs.length) return false;
      for (let i = 0; i < prefixSegs.length; i++) {
        if (rSegs[i] !== prefixSegs[i] && !rSegs[i]?.startsWith('[')) return false;
      }
      return r.isDynamic;
    });

    if (matchedDynamic) {
      return {
        matched: true,
        target: link.target,
        normalizedPath: normalized,
        matchedRoute: matchedDynamic,
        isIndeterminate: false,
      };
    }

    // Conservative check: if route manifest is empty or prefix matches, don't false positive
    return {
      matched: true,
      target: link.target,
      normalizedPath: normalized,
      isIndeterminate: true,
      reason: 'Dynamic template pattern could not be definitively matched or ruled out.',
    };
  }

  // 4. Literal matching against all routes in manifest
  const targetSegs = toSegments(normalized);

  // A. Exact static match
  const exactMatch = manifest.routes.find((r) => r.path === normalized);
  if (exactMatch) {
    return {
      matched: true,
      target: link.target,
      normalizedPath: normalized,
      matchedRoute: exactMatch,
      isIndeterminate: false,
    };
  }

  // B. Dynamic route pattern match
  for (const route of manifest.routes) {
    if (!route.isDynamic) continue;
    const routeSegs = toSegments(route.path);
    if (matchSegments(targetSegs, routeSegs)) {
      return {
        matched: true,
        target: link.target,
        normalizedPath: normalized,
        matchedRoute: route,
        isIndeterminate: false,
      };
    }
  }

  // 5. No match found
  return {
    matched: false,
    target: link.target,
    normalizedPath: normalized,
    isIndeterminate: false,
    reason: `Target path "${normalized}" does not match any route in the Next.js project.`,
  };
}
