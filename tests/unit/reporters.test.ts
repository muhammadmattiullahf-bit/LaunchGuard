import test from 'node:test';
import assert from 'node:assert';
import { formatTerminalReport } from '../../src/reporters/terminal-reporter.ts';
import { formatJsonReport } from '../../src/reporters/json-reporter.ts';
import { formatSarifReport } from '../../src/reporters/sarif-reporter.ts';
import type { ReportModel } from '../../src/core/types.ts';

const mockReport: ReportModel = {
  schemaVersion: '1.0.0',
  tool: {
    name: 'launchguard',
    version: '0.1.0',
  },
  status: 'complete',
  scan: {
    targetPath: '.',
    startTime: '2026-11-19T00:00:00.000Z',
    endTime: '2026-11-19T00:00:01.000Z',
    durationMs: 1000,
    categoriesExecuted: ['seo', 'security'],
    rulesExecutedCount: 2,
    filesScannedCount: 10,
    networkUsed: false,
  },
  summary: {
    totalFindings: 1,
    bySeverity: {
      critical: 0,
      high: 1,
      medium: 0,
      low: 0,
      informational: 0,
    },
    suppressedCount: 0,
    readinessScore: {
      overall: 85,
      byCategory: { seo: 100, security: 70 },
      disclaimer: 'The readiness score is an informational heuristic...',
      methodVersion: '1.0.0',
    },
  },
  findings: [
    {
      id: 'abc12345',
      ruleId: 'security/env-not-ignored',
      candidateId: 'LG-SEC-R001',
      title: '.env file not covered by .gitignore',
      description: 'Environment file may be committed to version control',
      severity: 'high',
      category: 'security',
      confidence: 'high',
      location: { file: '.env.local', line: 1 },
      recommendation: 'Add .env* to .gitignore',
      documentation: 'https://launchguard.dev/rules/security/env-not-ignored',
      autofix: false,
    },
  ],
  suppressed: [],
  faults: [],
  skippedFiles: [],
};

test('Reporters: Terminal report renders without error and respects noColor', () => {
  const output = formatTerminalReport(mockReport, true);
  assert.ok(output.includes('LaunchGuard v0.1.0'));
  assert.ok(output.includes('[HIGH]'));
  assert.ok(output.includes('.env file not covered by .gitignore'));
  assert.ok(output.includes('Readiness Score: 85 / 100'));
});

test('Reporters: JSON report parses and validates schema fields', () => {
  const jsonStr = formatJsonReport(mockReport);
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.schemaVersion, '1.0.0');
  assert.strictEqual(parsed.tool.name, 'launchguard');
  assert.strictEqual(parsed.findings.length, 1);
  assert.strictEqual(parsed.findings[0].id, 'abc12345');
});

test('Reporters: SARIF report validates OASIS SARIF v2.1.0 structure', () => {
  const sarifStr = formatSarifReport(mockReport);
  const parsed = JSON.parse(sarifStr);
  assert.strictEqual(parsed.version, '2.1.0');
  assert.strictEqual(parsed.runs.length, 1);
  assert.strictEqual(parsed.runs[0].tool.driver.name, 'launchguard');
  assert.strictEqual(parsed.runs[0].results.length, 1);
  assert.strictEqual(parsed.runs[0].results[0].ruleId, 'security/env-not-ignored');
  assert.strictEqual(parsed.runs[0].results[0].level, 'error'); // High maps to error
});
