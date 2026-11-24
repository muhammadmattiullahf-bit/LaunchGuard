import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';
import { createDefaultRegistry } from '../../src/rules/index.ts';
import { formatJsonReport } from '../../src/reporters/json-reporter.ts';
import { formatSarifReport } from '../../src/reporters/sarif-reporter.ts';
import { runCli } from '../../src/cli/cli.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Reproducibility: Repeated scans produce identical findings, fingerprints, and scores', async () => {
  const tempDir = createTempDir('lg-repro-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'repro-app',
        dependencies: { next: '14.2.0', lodash: '*' },
        scripts: { build: 'next build' },
      })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(path.join(tempDir, 'app', 'layout.tsx'), 'export default function L({children}:any){return children;}');
    fs.writeFileSync(path.join(tempDir, 'app', 'page.tsx'), 'export default function P(){return <div>Page</div>;}');

    const registry = createDefaultRegistry();
    const scanOptions = {
      targetPath: tempDir,
      format: 'json' as const,
      timeoutMs: 5000,
      maxFileSize: 10 * 1024 * 1024,
      noColor: true,
      verbose: false,
      quiet: true,
    };

    // Scan 1
    const report1 = await executeScan({ options: scanOptions, registry });
    // Scan 2
    const report2 = await executeScan({ options: scanOptions, registry });
    // Scan 3
    const report3 = await executeScan({ options: scanOptions, registry });

    // 1. Findings count must be identical
    assert.strictEqual(report1.findings.length, report2.findings.length);
    assert.strictEqual(report2.findings.length, report3.findings.length);

    // 2. Finding IDs & fingerprints must match exactly in identical order
    for (let i = 0; i < report1.findings.length; i++) {
      const f1 = report1.findings[i]!;
      const f2 = report2.findings[i]!;
      const f3 = report3.findings[i]!;

      assert.strictEqual(f1.id, f2.id, `Finding ID mismatch at index ${i}`);
      assert.strictEqual(f2.id, f3.id, `Finding ID mismatch at index ${i}`);
      assert.strictEqual(f1.ruleId, f2.ruleId);
      assert.strictEqual(f1.severity, f2.severity);
      assert.strictEqual(f1.confidence, f2.confidence);
    }

    // 3. Overall and Category readiness scores must be identical
    assert.strictEqual(report1.summary.readinessScore.overall, report2.summary.readinessScore.overall);
    assert.strictEqual(report2.summary.readinessScore.overall, report3.summary.readinessScore.overall);
    assert.deepStrictEqual(report1.summary.readinessScore.byCategory, report2.summary.readinessScore.byCategory);

    // 4. JSON Serialization determinism (excluding dynamic timestamps)
    const json1 = JSON.parse(formatJsonReport(report1));
    const json2 = JSON.parse(formatJsonReport(report2));
    delete json1.scan.startTime;
    delete json1.scan.endTime;
    delete json1.scan.durationMs;
    delete json2.scan.startTime;
    delete json2.scan.endTime;
    delete json2.scan.durationMs;
    assert.deepStrictEqual(json1, json2, 'JSON report body must be deterministic');

    // 5. SARIF Serialization structural validity
    const sarifString = formatSarifReport(report1);
    const sarif = JSON.parse(sarifString);
    assert.strictEqual(sarif.version, '2.1.0');
    assert.ok(sarif.$schema.includes('sarif-schema-2.1.0.json'));
    assert.ok(Array.isArray(sarif.runs));
    assert.strictEqual(sarif.runs.length, 1);
    assert.strictEqual(sarif.runs[0].results.length, report1.findings.length);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Reproducibility: Exit codes are consistent across repeated CLI invocations', async () => {
  const tempDir = createTempDir('lg-repro-cli-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'cli-repro-app', dependencies: { next: '14.2.0' } })
    );

    const code1 = await runCli(['scan', tempDir]);
    const code2 = await runCli(['scan', tempDir]);
    const code3 = await runCli(['scan', tempDir]);

    assert.strictEqual(code1, 0);
    assert.strictEqual(code2, 0);
    assert.strictEqual(code3, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
