import type { RouteDefinition, RouteManifest } from './route-manifest.ts';
import type { ExtractedLink } from './link-extractor.ts';
import { matchLinkToRoute } from './route-matcher.ts';

export interface InboundLinkReference {
  sourceFile: string;
  line: number;
  target: string;
}

export interface PageNavigationNode {
  route: RouteDefinition;
  inboundCount: number;
  inboundReferences: InboundLinkReference[];
  isOrphaned: boolean;
}

export interface NavigationGraph {
  nodes: Map<string, PageNavigationNode>;
  orphanedPages: RouteDefinition[];
  totalLinksEvaluated: number;
  totalInboundLinks: number;
}

const SPECIAL_CONVENTION_ROUTES = new Set([
  '/',
  '/not-found',
  '/_not-found',
  '/error',
  '/404',
  '/500',
]);

/**
 * Builds an internal static navigation graph and detects potentially orphaned pages (M5-C).
 */
export function buildNavigationGraph(
  manifest: RouteManifest,
  extractedLinks: ExtractedLink[]
): NavigationGraph {
  const nodes = new Map<string, PageNavigationNode>();

  // 1. Initialize nodes for all user-facing page routes
  for (const pageRoute of manifest.pageRoutes) {
    nodes.set(pageRoute.path, {
      route: pageRoute,
      inboundCount: 0,
      inboundReferences: [],
      isOrphaned: false,
    });
  }

  let totalInbound = 0;

  // 2. Map links to destinations
  for (const link of extractedLinks) {
    if (link.classification === 'external' || link.classification === 'ignored' || link.classification === 'indeterminate') {
      continue;
    }

    const match = matchLinkToRoute(link, manifest);
    if (match.matched && match.matchedRoute && !match.matchedRoute.isApi) {
      const node = nodes.get(match.matchedRoute.path);
      if (node) {
        node.inboundCount++;
        node.inboundReferences.push({
          sourceFile: link.sourceFile,
          line: link.line,
          target: link.target,
        });
        totalInbound++;
      }
    }
  }

  // 3. Detect potentially orphaned pages
  const orphanedPages: RouteDefinition[] = [];

  for (const [path, node] of nodes.entries()) {
    // Exclude root and framework convention routes
    if (SPECIAL_CONVENTION_ROUTES.has(path)) {
      continue;
    }

    if (node.inboundCount === 0) {
      node.isOrphaned = true;
      orphanedPages.push(node.route);
    }
  }

  // Deterministic sort: path ascending
  orphanedPages.sort((a, b) => a.path.localeCompare(b.path));

  return {
    nodes,
    orphanedPages,
    totalLinksEvaluated: extractedLinks.length,
    totalInboundLinks: totalInbound,
  };
}
