import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';
import {
  buildRouteManifest,
  extractLinksFromFile,
  matchLinkToRoute,
  buildNavigationGraph,
} from '../../core/routing/index.ts';

export const routingBrokenInternalLinkRule: RuleDefinition = {
  id: 'routing/broken-internal-link',
  candidateId: 'LG-RTE-R001',
  category: 'routing',
  title: 'Internal link targets a non-existent route',
  description: 'An internal link (<Link href="...">, <a href="...">, or router navigation call) references a URL path that cannot be matched to any discovered route in the project.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/routing/broken-internal-link',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    // 1. Build route manifest
    const manifest = buildRouteManifest(project, files);
    if (manifest.routes.length === 0) {
      // If no routes are discovered, avoid false positives
      return [];
    }

    // 2. Scan source files for links
    const sourceExtensions = new Set(['.tsx', '.ts', '.jsx', '.js']);
    const candidateFiles = files.filter(
      (f) =>
        sourceExtensions.has(f.relativePath.slice(f.relativePath.lastIndexOf('.'))) &&
        !f.relativePath.startsWith('node_modules/') &&
        !f.relativePath.startsWith('.next/') &&
        !f.relativePath.startsWith('dist/') &&
        !f.relativePath.startsWith('tests/fixtures/')
    );

    for (const f of candidateFiles) {
      const content = await readFile(f.relativePath, 1024 * 1024);
      if (!content) continue;

      const extracted = extractLinksFromFile(content, f.relativePath);

      for (const link of extracted) {
        // Skip external, ignored, or indeterminate links
        if (
          link.classification === 'external' ||
          link.classification === 'ignored' ||
          link.classification === 'indeterminate'
        ) {
          continue;
        }

        const match = matchLinkToRoute(link, manifest);
        if (!match.matched && !match.isIndeterminate) {
          findings.push({
            title: `Broken internal link target "${match.normalizedPath}"`,
            description: `The internal link references "${match.normalizedPath}", which does not match any static or dynamic route in the project manifest.`,
            location: {
              file: link.sourceFile,
              line: link.line,
              column: link.column,
            },
            recommendation: 'Update the href attribute to point to a valid route, or create the missing route file.',
            evidence: link.rawSnippet,
            evidenceAnchor: `broken-link-${link.sourceFile}-${link.line}-${match.normalizedPath}`,
            severity: 'medium',
            confidence: 'high',
          });
        }
      }
    }

    return findings;
  },
};

export const routingOrphanedPageRule: RuleDefinition = {
  id: 'routing/orphaned-page',
  candidateId: 'LG-RTE-R005',
  category: 'routing',
  title: 'Potentially orphaned page with no internal inbound links',
  description: 'A user-facing page route was discovered, but no statically detectable internal inbound links (<Link>, <a>, or router calls) target this route.',
  defaultSeverity: 'low',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/routing/orphaned-page',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    // 1. Build route manifest
    const manifest = buildRouteManifest(project, files);
    if (manifest.pageRoutes.length <= 1) {
      // If only root or 0 pages exist, no orphaned detection is meaningful
      return [];
    }

    // 2. Extract links from all source files
    const sourceExtensions = new Set(['.tsx', '.ts', '.jsx', '.js']);
    const candidateFiles = files.filter(
      (f) =>
        sourceExtensions.has(f.relativePath.slice(f.relativePath.lastIndexOf('.'))) &&
        !f.relativePath.startsWith('node_modules/') &&
        !f.relativePath.startsWith('.next/') &&
        !f.relativePath.startsWith('dist/') &&
        !f.relativePath.startsWith('tests/fixtures/')
    );

    const allLinks = [];
    for (const f of candidateFiles) {
      const content = await readFile(f.relativePath, 1024 * 1024);
      if (!content) continue;
      const extracted = extractLinksFromFile(content, f.relativePath);
      allLinks.push(...extracted);
    }

    // 3. Build navigation graph and find orphans
    const graph = buildNavigationGraph(manifest, allLinks);

    for (const orphan of graph.orphanedPages) {
      findings.push({
        title: `Potentially orphaned page: "${orphan.path}" has no inbound internal links`,
        description: `No statically detectable internal navigation links (<Link>, <a>, or router calls) target the route "${orphan.path}". The page may be unreachable or only accessible via external or dynamic navigation.`,
        location: {
          file: orphan.sourceFile,
          line: 1,
        },
        recommendation: 'Verify whether this page is intended to be accessible, and link to it from relevant navigation menus, headers, footers, or parent pages.',
        evidenceAnchor: `orphaned-page-${orphan.path}`,
        severity: 'low',
        confidence: 'medium',
      });
    }

    return findings;
  },
};

export const routingRouteConflictRule: RuleDefinition = {
  id: 'routing/route-conflict',
  candidateId: 'LG-RTE-R003',
  category: 'routing',
  title: 'Conflicting or ambiguous route definitions detected',
  description: 'Multiple files resolve to the identical public URL path, creating routing conflicts, unexpected overrides, or build failures in Next.js.',
  defaultSeverity: 'high',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/routing/route-conflict',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ project, files }) => {
    const findings: RuleFindingInput[] = [];

    const manifest = buildRouteManifest(project, files);

    for (const conflict of manifest.conflicts) {
      const primaryFile = conflict.conflictingFiles[0] || 'app';
      findings.push({
        title: `Conflicting route definitions for URL path "${conflict.path}"`,
        description: `${conflict.reason} Files: ${conflict.conflictingFiles.join(', ')}.`,
        location: {
          file: primaryFile,
          line: 1,
        },
        recommendation: 'Remove duplicate route files or rename conflicting folders to ensure every public route path is uniquely defined.',
        evidence: `Conflicting files: ${conflict.conflictingFiles.join(', ')}`,
        evidenceAnchor: `route-conflict-${conflict.path}`,
        severity: 'high',
        confidence: 'high',
      });
    }

    return findings;
  },
};

export const routingRules: RuleDefinition[] = [
  routingBrokenInternalLinkRule,
  routingOrphanedPageRule,
  routingRouteConflictRule,
];
