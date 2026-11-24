import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';
import { createDefaultRegistry } from '../../src/rules/index.ts';
import type { EffectiveScanOptions } from '../../src/core/types.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const baseOptions: EffectiveScanOptions = {
  targetPath: '.',
  format: 'json',
  timeoutMs: 5000,
  maxFileSize: 10 * 1024 * 1024,
  noColor: true,
  verbose: false,
  quiet: true,
};

test('Rule Matrix: SEO Rules Boundary and Malformed Input Tests', async () => {
  const tempDir = createTempDir('lg-mat-seo-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'seo-mat', dependencies: { next: '14.2.0' } })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));

    // Boundary 1: layout with dynamic generateMetadata function (should NOT trigger false positive for missing title)
    fs.writeFileSync(
      path.join(tempDir, 'app', 'layout.tsx'),
      'export async function generateMetadata() { return { title: "Dynamic" }; } export default function L({children}:any){return children;}'
    );

    // Boundary 2: site-wide noindex in robots.ts
    fs.writeFileSync(
      path.join(tempDir, 'app', 'robots.ts'),
      'export default function robots() { return { rules: { userAgent: "*", disallow: "/" }, }; }'
    );
    // Boundary 3: site-wide noindex in layout metadata
    fs.writeFileSync(
      path.join(tempDir, 'app', 'page.tsx'),
      'export const metadata = { robots: { index: false, follow: false } }; export default function P() { return <div>P</div>; }'
    );

    const registry = createDefaultRegistry();
    const report = await executeScan({
      options: { ...baseOptions, targetPath: tempDir, categories: ['seo'] },
      registry,
    });

    const ruleIds = report.findings.map((f) => f.ruleId);
    // seo/site-wide-noindex must trigger
    assert.ok(ruleIds.includes('seo/site-wide-noindex'), 'site-wide-noindex must be detected');
    // seo/title-missing must NOT trigger because generateMetadata is present!
    assert.strictEqual(ruleIds.includes('seo/title-missing'), false, 'Dynamic metadata must not false positive');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Rule Matrix: Code Quality Boundary, Malformed JSON and Build Suppression Tests', async () => {
  const tempDir = createTempDir('lg-mat-code-');
  try {
    // Malformed tsconfig.json (invalid JSON syntax)
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'code-mat', dependencies: { next: '14.2.0' } })
    );
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{ compilerOptions: { "strict": false } /* comments */ }');

    // next.config.js with build error suppressions
    fs.writeFileSync(
      path.join(tempDir, 'next.config.js'),
      `module.exports = {
        typescript: { ignoreBuildErrors: true },
        eslint: { ignoreDuringBuilds: true }
      };`
    );

    const registry = createDefaultRegistry();
    const report = await executeScan({
      options: { ...baseOptions, targetPath: tempDir, categories: ['code-quality'] },
      registry,
    });

    const ruleIds = report.findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('code-quality/build-error-suppression'), 'Must flag ignoreBuildErrors');
    assert.ok(ruleIds.includes('code-quality/build-script-missing'), 'Must flag missing build script');
    assert.ok(ruleIds.includes('code-quality/test-script-missing'), 'Must flag missing test script');
    assert.ok(ruleIds.includes('code-quality/node-version-missing'), 'Must flag missing node version');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Rule Matrix: Deployment and Dependencies Boundary Tests', async () => {
  const tempDir = createTempDir('lg-mat-dep-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'dep-mat',
        dependencies: { next: '14.2.0', express: 'latest', axios: '*' },
      })
    );

    // Empty .env.example
    fs.writeFileSync(path.join(tempDir, '.env.example'), '');

    // Source referencing untracked env
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'src', 'db.ts'), 'const url = process.env.DATABASE_SUPER_URL;');

    // Missing lockfiles
    const registry = createDefaultRegistry();
    const report = await executeScan({
      options: { ...baseOptions, targetPath: tempDir, categories: ['deployment', 'dependencies'] },
      registry,
    });

    const ruleIds = report.findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('deployment/env-var-untracked'), 'Must flag untracked env var');
    assert.ok(ruleIds.includes('deployment/start-script-missing'), 'Must flag missing start script');
    assert.ok(ruleIds.includes('dependencies/lockfile-missing'), 'Must flag missing lockfile');
    assert.ok(ruleIds.includes('dependencies/wildcard-version-range'), 'Must flag wildcard version ranges');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
