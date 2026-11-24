import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';

const DEFAULT_ASSET_SIZE_THRESHOLD = 500 * 1024; // 500KB

export const performanceLargeStaticAssetRule: RuleDefinition = {
  id: 'performance/large-static-asset',
  candidateId: 'LG-PRF-R001',
  category: 'performance',
  title: 'Large unoptimized static asset in public directory',
  description: 'Potential static indicator: files larger than 500KB in public/ may slow initial page load if served directly without CDN optimization or responsive sizing.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/performance/large-static-asset',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ files }) => {
    const findings: RuleFindingInput[] = [];

    const publicFiles = files.filter((f) => f.relativePath.startsWith('public/'));

    for (const f of publicFiles) {
      if (f.sizeBytes > DEFAULT_ASSET_SIZE_THRESHOLD) {
        const sizeKb = Math.round(f.sizeBytes / 1024);
        findings.push({
          title: `Static asset "${f.relativePath}" exceeds size threshold (${sizeKb} KB)`,
          description: `Potential static indicator: "${f.relativePath}" is ${sizeKb} KB. Large uncompressed images, videos, or fonts served directly from public/ can degrade LCP and bandwidth. (Note: This is a static file-size observation, not a real user runtime measurement).`,
          location: { file: f.relativePath, line: 1 },
          recommendation: 'Optimize, compress, or use `next/image` with WebP/AVIF format, or host heavy media on a dedicated CDN.',
          evidence: `File size: ${sizeKb} KB`,
          evidenceAnchor: `large-asset-${f.relativePath}`,
          limitationsNote: 'Static asset size alone does not measure real-world network or cache performance.',
        });
      }
    }

    return findings;
  },
};

export const performanceRules: RuleDefinition[] = [performanceLargeStaticAssetRule];
