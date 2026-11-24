import type { DiscoveredFile, ProjectDescriptor } from '../types.ts';

export type DynamicSegmentType = 'standard' | 'catch-all' | 'optional-catch-all';

export interface RouteDefinition {
  path: string; // e.g. "/", "/about", "/products/[id]", "/blog/[...slug]"
  sourceFile: string; // project-relative path e.g. "app/about/page.tsx"
  routerType: 'app' | 'pages';
  kind: 'page' | 'api';
  isDynamic: boolean;
  dynamicType?: DynamicSegmentType | undefined;
  paramNames: string[];
  isApi: boolean;
  confidence: 'high' | 'medium';
}

export interface RouteConflict {
  path: string;
  conflictingFiles: string[];
  reason: string;
}

export interface RouteManifest {
  routes: RouteDefinition[]; // all routes, deterministic order
  pageRoutes: RouteDefinition[]; // only user-facing pages
  apiRoutes: RouteDefinition[]; // API routes / route handlers
  conflicts: RouteConflict[];
  routerType: 'app' | 'pages' | 'both' | 'none';
  totalDiscovered: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

const PAGES_ROUTER_SPECIAL_FILES = new Set([
  '_app',
  '_document',
  '_error',
  '_404',
]);

/**
 * Normalizes filesystem path separators to forward slashes.
 */
function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Extracts the file base name without extension.
 */
function getBaseNameWithoutExt(filename: string): { name: string; ext: string } {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return { name: filename, ext: '' };
  return {
    name: filename.slice(0, dotIndex),
    ext: filename.slice(dotIndex),
  };
}

/**
 * Parses dynamic parameter names from route segments.
 */
function extractDynamicInfo(segments: string[]): {
  isDynamic: boolean;
  dynamicType?: DynamicSegmentType | undefined;
  paramNames: string[];
} {
  const paramNames: string[] = [];
  let dynamicType: DynamicSegmentType | undefined = undefined;

  for (const seg of segments) {
    if (seg.startsWith('[[...') && seg.endsWith(']]')) {
      paramNames.push(seg.slice(5, -2));
      dynamicType = 'optional-catch-all';
    } else if (seg.startsWith('[...') && seg.endsWith(']')) {
      paramNames.push(seg.slice(4, -1));
      if (!dynamicType) dynamicType = 'catch-all';
    } else if (seg.startsWith('[') && seg.endsWith(']')) {
      paramNames.push(seg.slice(1, -1));
      if (!dynamicType) dynamicType = 'standard';
    }
  }

  return {
    isDynamic: paramNames.length > 0,
    dynamicType,
    paramNames,
  };
}

/**
 * Builds a Next.js Route Manifest from safely discovered project files (M5-A).
 */
export function buildRouteManifest(
  project: ProjectDescriptor,
  files: DiscoveredFile[]
): RouteManifest {
  const routes: RouteDefinition[] = [];
  const appPrefixes = project.hasSrc ? ['src/app/', 'app/'] : ['app/', 'src/app/'];
  const pagesPrefixes = project.hasSrc ? ['src/pages/', 'pages/'] : ['pages/', 'src/pages/'];

  // Map normalized URL -> files that resolve to it (for conflict detection)
  const pathToFileMap = new Map<string, RouteDefinition[]>();

  for (const file of files) {
    const relPath = normalizeSlashes(file.relativePath);
    const { ext } = getBaseNameWithoutExt(relPath.split('/').pop() || '');

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      continue;
    }

    // 1. Check App Router
    let isApp = false;
    let appSubPath = '';
    for (const prefix of appPrefixes) {
      if (relPath.startsWith(prefix)) {
        isApp = true;
        appSubPath = relPath.slice(prefix.length);
        break;
      }
    }

    if (isApp) {
      const parts = appSubPath.split('/');
      const fileName = parts.pop() || '';
      const { name: fName } = getBaseNameWithoutExt(fileName);

      // In App Router, only page.* and route.* produce routes
      const isPage = fName === 'page';
      const isRouteHandler = fName === 'route';

      if (!isPage && !isRouteHandler) {
        // Ignored: layout.*, loading.*, error.*, template.*, components, etc.
        continue;
      }

      // Check for private folders (_folder) or parallel routes (@slot)
      let isPrivate = false;
      const urlSegments: string[] = [];

      for (const segment of parts) {
        if (segment.startsWith('_')) {
          // Private folder: exclude entire directory tree
          isPrivate = true;
          break;
        }
        if (segment.startsWith('@')) {
          // Parallel route slot: not part of URL pathname
          continue;
        }
        if (segment.startsWith('(') && segment.endsWith(')')) {
          // Route group: omit from URL pathname
          continue;
        }
        // Intercepting route check
        if (segment.startsWith('(.)') || segment.startsWith('(..)') || segment.startsWith('(...)')) {
          continue;
        }
        urlSegments.push(segment);
      }

      if (isPrivate) {
        continue;
      }

      const normalizedUrl = '/' + urlSegments.join('/');
      const cleanUrl = normalizedUrl === '//' ? '/' : normalizedUrl.replace(/\/+/g, '/');
      const dynamicInfo = extractDynamicInfo(urlSegments);

      const routeDef: RouteDefinition = {
        path: cleanUrl,
        sourceFile: relPath,
        routerType: 'app',
        kind: isRouteHandler ? 'api' : 'page',
        isDynamic: dynamicInfo.isDynamic,
        dynamicType: dynamicInfo.dynamicType,
        paramNames: dynamicInfo.paramNames,
        isApi: isRouteHandler,
        confidence: 'high',
      };

      routes.push(routeDef);

      const existing = pathToFileMap.get(cleanUrl) || [];
      existing.push(routeDef);
      pathToFileMap.set(cleanUrl, existing);
      continue;
    }

    // 2. Check Pages Router
    let isPages = false;
    let pagesSubPath = '';
    for (const prefix of pagesPrefixes) {
      if (relPath.startsWith(prefix)) {
        isPages = true;
        pagesSubPath = relPath.slice(prefix.length);
        break;
      }
    }

    if (isPages) {
      const parts = pagesSubPath.split('/');
      const fileName = parts.pop() || '';
      const { name: fName } = getBaseNameWithoutExt(fileName);

      // Exclude special Pages Router files: _app, _document, _error, _404
      if (parts.length === 0 && PAGES_ROUTER_SPECIAL_FILES.has(fName)) {
        continue;
      }

      // Exclude files starting with underscore at any level in pages
      if (fName.startsWith('_')) {
        continue;
      }

      const isApi = parts.length > 0 && parts[0] === 'api';

      const urlSegments = [...parts];
      if (fName !== 'index') {
        urlSegments.push(fName);
      }

      const normalizedUrl = '/' + urlSegments.join('/');
      const cleanUrl = normalizedUrl === '//' ? '/' : normalizedUrl.replace(/\/+/g, '/');
      const dynamicInfo = extractDynamicInfo(urlSegments);

      const routeDef: RouteDefinition = {
        path: cleanUrl,
        sourceFile: relPath,
        routerType: 'pages',
        kind: isApi ? 'api' : 'page',
        isDynamic: dynamicInfo.isDynamic,
        dynamicType: dynamicInfo.dynamicType,
        paramNames: dynamicInfo.paramNames,
        isApi,
        confidence: 'high',
      };

      routes.push(routeDef);

      const existing = pathToFileMap.get(cleanUrl) || [];
      existing.push(routeDef);
      pathToFileMap.set(cleanUrl, existing);
    }
  }

  // Detect conflicts: where multiple distinct source files map to the same URL path
  const conflicts: RouteConflict[] = [];
  for (const [routePath, matchingRoutes] of pathToFileMap.entries()) {
    if (matchingRoutes.length > 1) {
      const files = matchingRoutes.map((r) => r.sourceFile);
      const kinds = new Set(matchingRoutes.map((r) => `${r.routerType}:${r.kind}`));
      let reason = 'Multiple source files define the same URL route path.';
      if (kinds.has('app:page') && kinds.has('pages:page')) {
        reason = 'Route collision between App Router and Pages Router definition for the same URL path.';
      } else if (matchingRoutes.some((r) => r.sourceFile.includes('('))) {
        reason = 'Route group collision: different route group folders resolve to the identical URL path.';
      } else {
        reason = 'Conflicting file extensions or duplicate definitions for the same route.';
      }

      conflicts.push({
        path: routePath,
        conflictingFiles: files,
        reason,
      });
    }
  }

  // Deterministic sort: path ascending, then sourceFile ascending
  routes.sort((a, b) => {
    const cmp = a.path.localeCompare(b.path);
    if (cmp !== 0) return cmp;
    return a.sourceFile.localeCompare(b.sourceFile);
  });

  const pageRoutes = routes.filter((r) => !r.isApi);
  const apiRoutes = routes.filter((r) => r.isApi);

  let effectiveRouterType: RouteManifest['routerType'] = 'none';
  const hasApp = routes.some((r) => r.routerType === 'app');
  const hasPages = routes.some((r) => r.routerType === 'pages');
  if (hasApp && hasPages) {
    effectiveRouterType = 'both';
  } else if (hasApp) {
    effectiveRouterType = 'app';
  } else if (hasPages) {
    effectiveRouterType = 'pages';
  }

  return {
    routes,
    pageRoutes,
    apiRoutes,
    conflicts,
    routerType: effectiveRouterType,
    totalDiscovered: routes.length,
  };
}
