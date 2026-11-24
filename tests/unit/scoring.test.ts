import test from 'node:test';
import assert from 'node:assert';
import {
  FindingCollector,
  computeFindingFingerprint,
} from '../../src/core/dedup/finding-collector.ts';
import {
  calculateReadinessScore,
  SCORE_DISCLAIMER,
  SCORE_METHOD_VERSION,
} from '../../src/core/scoring/readiness-score.ts';
import type { RuleDefinition, RuleFindingInput } from '../../src/core/types.ts';

const mockRule: RuleDefinition = {
  id: 'seo/title-missing',
  candidateId: 'LG-SEO-R001',
  category: 'seo',
  title: 'No title metadata found',
  description: 'Missing page title',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/seo/title-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: () => [],
};

test('Fingerprint: Deterministic and insensitive to line changes', () => {
  const fp1 = computeFindingFingerprint('seo/title-missing', 'app/page.tsx', 'export default');
  const fp2 = computeFindingFingerprint('seo/title-missing', 'app/page.tsx', 'export default');
  const fpDifferentFile = computeFindingFingerprint('seo/title-missing', 'app/about/page.tsx', 'export default');

  assert.strictEqual(fp1, fp2);
  assert.notStrictEqual(fp1, fpDifferentFile);
});

test('Finding Collector: Deduplicates identical findings', () => {
  const collector = new FindingCollector();
  const input: RuleFindingInput = {
    title: 'Missing title',
    description: 'Title missing',
    location: { file: 'app/page.tsx', line: 10 },
    recommendation: 'Add title',
    evidenceAnchor: 'export default',
  };

  collector.addRawFinding(mockRule, input);
  // Duplicate input with different line number
  collector.addRawFinding(mockRule, { ...input, location: { file: 'app/page.tsx', line: 25 } });

  const result = collector.processFindings({
    targetPath: '.',
    format: 'terminal',
    timeoutMs: 1000,
    maxFileSize: 1000,
    noColor: true,
    verbose: false,
    quiet: false,
  });

  assert.strictEqual(result.activeFindings.length, 1);
});

test('Finding Collector: Handles suppression with reason', () => {
  const collector = new FindingCollector();
  collector.addRawFinding(mockRule, {
    title: 'Missing title',
    description: 'Title missing',
    location: { file: 'app/page.tsx', line: 1 },
    recommendation: 'Add title',
    evidenceAnchor: 'export default',
  });

  const result = collector.processFindings(
    {
      targetPath: '.',
      format: 'terminal',
      timeoutMs: 1000,
      maxFileSize: 1000,
      noColor: true,
      verbose: false,
      quiet: false,
    },
    {
      suppressions: [
        {
          ruleId: 'seo/title-missing',
          path: 'app/page.tsx',
          reason: 'Internal test page',
        },
      ],
    }
  );

  assert.strictEqual(result.activeFindings.length, 0);
  assert.strictEqual(result.suppressedFindings.length, 1);
  assert.strictEqual(result.suppressedFindings[0]?.suppressionReason, 'Internal test page');
});

test('Readiness Score: Clean project scores 100 with mandatory disclaimer', () => {
  const score = calculateReadinessScore([], ['seo', 'security']);
  assert.strictEqual(score.overall, 100);
  assert.strictEqual(score.byCategory.seo, 100);
  assert.strictEqual(score.byCategory.security, 100);
  assert.strictEqual(score.disclaimer, SCORE_DISCLAIMER);
  assert.strictEqual(score.methodVersion, SCORE_METHOD_VERSION);
});

test('Readiness Score: Applies penalty and diminishing returns cap per rule', () => {
  // 5 high findings (15 pts * 1.0 = 15 each, uncapped sum = 75, capped at 30)
  const findings = Array.from({ length: 5 }, (_, i) => ({
    id: `finding-${i}`,
    ruleId: 'security/secret-token-leak',
    candidateId: 'LG-SEC-R002',
    title: 'Secret found',
    description: 'API key exposed',
    severity: 'high' as const,
    category: 'security' as const,
    confidence: 'high' as const,
    recommendation: 'Remove secret',
    documentation: 'https://launchguard.dev',
    autofix: false as const,
  }));

  const score = calculateReadinessScore(findings, ['security']);
  // 100 - capped penalty 30 = 70
  assert.strictEqual(score.byCategory.security, 70);
  assert.strictEqual(score.overall, 70);
});
