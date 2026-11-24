import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverFilesSafely } from '../../src/core/discovery/safe-file-discovery.ts';
import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';
import { RuleRegistry } from '../../src/core/rules/rule-registry.ts';
import { redactSecrets } from '../../src/core/redaction/redactor.ts';
import { sanitizeTerminalString, formatTerminalReport } from '../../src/reporters/terminal-reporter.ts';
import { formatJsonReport } from '../../src/reporters/json-reporter.ts';
import { formatSarifReport } from '../../src/reporters/sarif-reporter.ts';
import { runCli } from '../../src/cli/cli.ts';
import type { RuleDefinition, EffectiveScanOptions } from '../../src/core/types.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const defaultTestOptions: EffectiveScanOptions = {
  targetPath: '.',
  format: 'terminal',
  timeoutMs: 5000,
  maxFileSize: 1024 * 1024,
  noColor: true,
  verbose: false,
  quiet: true,
};

test('Security Audit 1: Path Traversal Attempts in Target Project', async () => {
  const tempDir = createTempDir('lg-sec-traversal-');
  const secretFileOutside = path.join(os.tmpdir(), 'secret-outside-' + Date.now() + '.txt');
  fs.writeFileSync(secretFileOutside, 'CONFIDENTIAL_ROOT_SECRET');

  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'traversal-target', dependencies: { next: '14.0.0' } })
    );

    // Rule that maliciously tries to read a file outside root using ../
    const evilRule: RuleDefinition = {
      id: 'test/evil-traversal-rule',
      candidateId: 'LG-SEC-TEST',
      category: 'security',
      title: 'Evil Traversal Rule',
      description: 'Attempts traversal',
      defaultSeverity: 'high',
      defaultConfidence: 'high',
      documentationUrl: 'https://launchguard.dev',
      releaseClass: 'mvp',
      requiresNetwork: false,
      execute: async ({ readFile }) => {
        const content = await readFile('../' + path.basename(secretFileOutside));
        assert.strictEqual(content, null, 'Traversal via ../ must return null');
        const absContent = await readFile(secretFileOutside);
        assert.strictEqual(absContent, null, 'Absolute path outside root must return null');
        return [];
      },
    };

    const registry = new RuleRegistry([evilRule]);
    const report = await executeScan({
      options: { ...defaultTestOptions, targetPath: tempDir },
      registry,
    });
    assert.strictEqual(report.status, 'complete');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(secretFileOutside, { force: true });
  }
});

test('Security Audit 2 & 3: Symlink Escape and Circular Symlinks', async () => {
  const tempDir = createTempDir('lg-sec-symlink-');
  const outsideDir = createTempDir('lg-sec-outside-');
  fs.writeFileSync(path.join(outsideDir, 'secret-outside.txt'), 'PRIVATE_DATA');

  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'symlink-target', dependencies: { next: '14.0.0' } })
    );

    // Try creating symlink escaping root
    let symlinksCreated = false;
    try {
      fs.symlinkSync(outsideDir, path.join(tempDir, 'escaped-dir'), 'junction');
      // Create circular directory symlink
      fs.mkdirSync(path.join(tempDir, 'subA'));
      fs.symlinkSync(path.join(tempDir, 'subA'), path.join(tempDir, 'subA', 'loop'), 'junction');
      symlinksCreated = true;
    } catch {
      // On some Windows environments without SeCreateSymbolicLinkPrivilege, junctions work or symlinks skip
    }

    if (symlinksCreated) {
      const discovery = await discoverFilesSafely(tempDir);
      // Ensure no outside files are indexed
      assert.strictEqual(
        discovery.files.some((f) => f.relativePath.includes('secret-outside.txt')),
        false
      );
      // Ensure escape was noted in skippedFiles
      const escapedSkip = discovery.skippedFiles.find((s) =>
        s.reason.includes('Symlink points outside')
      );
      assert.ok(escapedSkip, 'Symlink escaping root must be recorded in skippedFiles');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('Security Audit 5 & 6: Resource Limits (Oversized files and depth)', async () => {
  const tempDir = createTempDir('lg-sec-limits-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'limits-test', dependencies: { next: '14.0.0' } })
    );
    // Create oversized file (100KB file with 50KB limit)
    fs.writeFileSync(path.join(tempDir, 'huge.dat'), 'A'.repeat(100 * 1024));

    // Create deep directory
    let deepPath = tempDir;
    for (let i = 0; i < 35; i++) {
      deepPath = path.join(deepPath, `d${i}`);
      fs.mkdirSync(deepPath);
    }
    fs.writeFileSync(path.join(deepPath, 'deep.txt'), 'deep');

    const result = await discoverFilesSafely(tempDir, {
      maxFileSize: 50 * 1024,
      maxDepth: 30,
    });

    assert.strictEqual(result.files.some((f) => f.relativePath === 'huge.dat'), false);
    assert.ok(result.skippedFiles.some((s) => s.reason.includes('exceeds limit')));
    assert.ok(result.skippedFiles.some((s) => s.reason.includes('depth limit')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Security Audit 7: Malformed and Oversized Configuration Handling', async () => {
  const tempDir = createTempDir('lg-sec-badconfig-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'bad-config-app', dependencies: { next: '14.0.0' } })
    );
    // Malformed JSON in .launchguardrc.json
    fs.writeFileSync(path.join(tempDir, '.launchguardrc.json'), '{ "failOn": "invalid", }');

    const code = await runCli(['scan', tempDir]);
    assert.strictEqual(code, 2, 'Malformed config must result in exit code 2');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Security Audit 9, 11, 12: Secret Redaction in All Output Formats', () => {
  const fakeSecret = 'ghp_TESTSECRET1234567890abcdef1234567890';
  const textWithSecret = `API token is: ${fakeSecret}`;

  // 1. Redaction unit check
  const redacted = redactSecrets(textWithSecret);
  assert.strictEqual(redacted.includes(fakeSecret), false);
  assert.ok(redacted.includes('[REDACTED:GITHUB_TOKEN]'));

  // 2. Report model check
  const mockReport: any = {
    schemaVersion: '1.0.0',
    tool: { name: 'launchguard', version: '0.1.0' },
    status: 'complete',
    scan: { targetPath: '.', startTime: '', endTime: '', durationMs: 0, categoriesExecuted: [], rulesExecutedCount: 0, filesScannedCount: 0, networkUsed: false },
    summary: { totalFindings: 1, bySeverity: { critical: 1, high: 0, medium: 0, low: 0, informational: 0 }, suppressedCount: 0, readinessScore: { overall: 70, byCategory: {}, disclaimer: '', methodVersion: '1.0' } },
    findings: [{
      id: 'f1',
      ruleId: 'security/secret-token-leak',
      candidateId: 'LG-SEC-R002',
      title: 'Secret leak',
      description: 'Found token',
      severity: 'critical',
      category: 'security',
      confidence: 'high',
      location: { file: 'src/token.ts', line: 1 },
      recommendation: 'Fix it',
      documentation: 'https://launchguard.dev',
      autofix: false,
      evidence: redactSecrets(textWithSecret),
    }],
    suppressed: [],
    faults: [],
    skippedFiles: [],
  };

  const term = formatTerminalReport(mockReport, true);
  const jsonOut = formatJsonReport(mockReport);
  const sarifOut = formatSarifReport(mockReport);

  assert.strictEqual(term.includes(fakeSecret), false);
  assert.strictEqual(jsonOut.includes(fakeSecret), false);
  assert.strictEqual(sarifOut.includes(fakeSecret), false);
});

test('Security Audit 10: Terminal Output Control Sequence Sanitization', () => {
  const maliciousAnsiString = 'CleanTitle\x1b[31;1mINJECTED_RED\x1b[0m\x1b[2J\x07';
  const sanitized = sanitizeTerminalString(maliciousAnsiString);
  assert.strictEqual(sanitized.includes('\x1b'), false);
  assert.strictEqual(sanitized.includes('\x07'), false);
  assert.strictEqual(sanitized, 'CleanTitleINJECTED_RED');
});

test('Security Audit 13: Target-Project Code Execution Prevention (P-02, LG-SEC-001, LG-SEC-002)', async () => {
  const tempDir = createTempDir('lg-sec-no-exec-');
  const sentinelFile = path.join(tempDir, 'PWNED_BY_EXECUTION.txt');

  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'malicious-target',
        dependencies: { next: '14.0.0' },
        scripts: {
          build: `node -e "require('fs').writeFileSync('${sentinelFile.replace(/\\/g, '/')}', 'pwned')"`,
          postinstall: `node -e "require('fs').writeFileSync('${sentinelFile.replace(/\\/g, '/')}', 'pwned')"`,
        },
      })
    );

    // Malicious next.config.js attempting execution side-effects
    fs.writeFileSync(
      path.join(tempDir, 'next.config.js'),
      `
      const fs = require('fs');
      fs.writeFileSync('${sentinelFile.replace(/\\/g, '/')}', 'pwned');
      module.exports = { poweredByHeader: false };
      `
    );

    const code = await runCli(['scan', tempDir]);
    assert.strictEqual(code, 0);

    // Verify sentinel file was NEVER created
    assert.strictEqual(
      fs.existsSync(sentinelFile),
      false,
      'Target project script/config must NEVER be executed!'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Security Audit 14: Output Destination Symlink Writing Prohibited (LG-SEC-014)', async () => {
  const tempDir = createTempDir('lg-sec-out-symlink-');
  const targetOutside = path.join(tempDir, 'outside-target.txt');
  fs.writeFileSync(targetOutside, 'ORIGINAL_DATA');
  const symlinkPath = path.join(tempDir, 'symlink-out.json');

  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-app', dependencies: { next: '14.0.0' } })
    );

    let canSymlink = false;
    try {
      fs.symlinkSync(targetOutside, symlinkPath, 'file');
      canSymlink = true;
    } catch {
      // Symlink permission skipped
    }

    if (canSymlink) {
      const code = await runCli(['scan', tempDir, '--output', symlinkPath]);
      assert.strictEqual(code, 2, 'Writing through symlink destination must be blocked');
      assert.strictEqual(fs.readFileSync(targetOutside, 'utf-8'), 'ORIGINAL_DATA');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Security Audit 15: Timeout and Fault Isolation (LG-FR-017, LG-FR-020)', async () => {
  const tempDir = createTempDir('lg-sec-fault-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'fault-app', dependencies: { next: '14.0.0' } })
    );

    const crashingRule: RuleDefinition = {
      id: 'test/crashing-rule',
      candidateId: 'LG-TEST-CRASH',
      category: 'security',
      title: 'Crashing Rule',
      description: 'Throws error',
      defaultSeverity: 'high',
      defaultConfidence: 'high',
      documentationUrl: 'https://launchguard.dev',
      releaseClass: 'mvp',
      requiresNetwork: false,
      execute: () => {
        throw new Error('Simulated rule crash');
      },
    };

    const healthyRule: RuleDefinition = {
      id: 'test/healthy-rule',
      candidateId: 'LG-TEST-HEALTHY',
      category: 'seo',
      title: 'Healthy Rule',
      description: 'Runs normally',
      defaultSeverity: 'low',
      defaultConfidence: 'high',
      documentationUrl: 'https://launchguard.dev',
      releaseClass: 'mvp',
      requiresNetwork: false,
      execute: () => [
        {
          title: 'Healthy finding',
          description: 'Desc',
          recommendation: 'Fix',
          evidenceAnchor: 'anchor-healthy',
        },
      ],
    };

    const registry = new RuleRegistry([crashingRule, healthyRule]);
    const report = await executeScan({
      options: { ...defaultTestOptions, targetPath: tempDir },
      registry,
    });

    // Rule crash must NOT crash scan; scan status becomes incomplete
    assert.strictEqual(report.status, 'incomplete');
    assert.strictEqual(report.faults.length, 1);
    assert.strictEqual(report.faults[0]?.ruleId, 'test/crashing-rule');
    // Healthy rule must still run and produce findings!
    assert.strictEqual(report.findings.length, 1);
    assert.strictEqual(report.findings[0]?.ruleId, 'test/healthy-rule');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
