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

const defaultOptions: EffectiveScanOptions = {
  targetPath: '.',
  format: 'json',
  timeoutMs: 5000,
  maxFileSize: 10 * 1024 * 1024,
  noColor: true,
  verbose: false,
  quiet: true,
};

test('Rules Verification: SEO rules (Positive and Negative Fixtures)', async () => {
  const tempDir = createTempDir('lg-fix-seo-');
  try {
    // 1. Positive fixture: missing metadata, robots, sitemap
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'seo-app', dependencies: { next: '14.0.0' } })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(
      path.join(tempDir, 'app', 'layout.tsx'),
      'export default function RootLayout({ children }: { children: any }) { return children; }'
    );

    const registry = createDefaultRegistry();
    let report = await executeScan({
      options: { ...defaultOptions, targetPath: tempDir, categories: ['seo'] },
      registry,
    });

    const ruleIds = report.findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('seo/title-missing'), 'Must flag title-missing');
    assert.ok(ruleIds.includes('seo/description-missing'), 'Must flag description-missing');
    assert.ok(ruleIds.includes('seo/canonical-missing'), 'Must flag canonical-missing');
    assert.ok(ruleIds.includes('seo/robots-missing'), 'Must flag robots-missing');
    assert.ok(ruleIds.includes('seo/sitemap-missing'), 'Must flag sitemap-missing');
    assert.ok(ruleIds.includes('seo/opengraph-missing'), 'Must flag opengraph-missing');

    // 2. Negative fixture: configure all SEO elements properly
    fs.writeFileSync(
      path.join(tempDir, 'app', 'layout.tsx'),
      `export const metadata = {
        title: { default: "App", template: "%s | App" },
        description: "App description",
        alternates: { canonical: "https://example.com" },
        openGraph: { title: "App", description: "App description" },
      };
      export default function RootLayout({ children }: any) { return children; }`
    );
    fs.writeFileSync(path.join(tempDir, 'app', 'robots.ts'), 'export default function robots() { return {}; }');
    fs.writeFileSync(path.join(tempDir, 'app', 'sitemap.ts'), 'export default function sitemap() { return []; }');

    report = await executeScan({
      options: { ...defaultOptions, targetPath: tempDir, categories: ['seo'] },
      registry,
    });

    const activeSeo = report.findings.filter((f) => f.category === 'seo');
    assert.strictEqual(activeSeo.length, 0, 'Clean SEO setup must emit 0 findings');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Rules Verification: Security rules (Positive and Negative Fixtures)', async () => {
  const tempDir = createTempDir('lg-fix-sec-');
  try {
    // Positive fixture
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'sec-app', dependencies: { next: '14.0.0' } })
    );
    fs.writeFileSync(path.join(tempDir, '.env.local'), 'SECRET_TOKEN=123');
    fs.writeFileSync(path.join(tempDir, '.env.example'), 'NEXT_PUBLIC_API_SECRET=abc');
    fs.writeFileSync(
      path.join(tempDir, 'next.config.js'),
      'module.exports = { productionBrowserSourceMaps: true };'
    );
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(
      path.join(tempDir, 'src', 'auth.ts'),
      'const apiKey = "sk-1234567890abcdef1234567890abcdef";'
    );

    const registry = createDefaultRegistry();
    let report = await executeScan({
      options: { ...defaultOptions, targetPath: tempDir, categories: ['security'] },
      registry,
    });

    const ruleIds = report.findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('security/env-not-ignored'), 'Must flag env-not-ignored');
    assert.ok(ruleIds.includes('security/secret-token-leak'), 'Must flag secret-token-leak');
    assert.ok(ruleIds.includes('security/public-env-leak'), 'Must flag public-env-leak');
    assert.ok(ruleIds.includes('security/security-headers-missing'), 'Must flag security-headers-missing');
    assert.ok(ruleIds.includes('security/source-maps-enabled'), 'Must flag source-maps-enabled');
    assert.ok(ruleIds.includes('security/powered-by-header'), 'Must flag powered-by-header');

    // Negative fixture: fix security issues
    fs.writeFileSync(path.join(tempDir, '.gitignore'), '/.env*\n.env.local\n');
    fs.writeFileSync(path.join(tempDir, '.env.example'), 'NEXT_PUBLIC_SITE_NAME=Example');
    fs.writeFileSync(
      path.join(tempDir, 'next.config.js'),
      `module.exports = {
        poweredByHeader: false,
        productionBrowserSourceMaps: false,
        headers: async () => [{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] }]
      };`
    );
    fs.writeFileSync(path.join(tempDir, 'src', 'auth.ts'), 'const apiKey = process.env.API_KEY;');

    report = await executeScan({
      options: { ...defaultOptions, targetPath: tempDir, categories: ['security'] },
      registry,
    });

    const activeSec = report.findings.filter((f) => f.category === 'security');
    assert.strictEqual(activeSec.length, 0, 'Clean Security setup must emit 0 findings');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Rules Verification: Code Quality, Deployment, Performance, and Dependencies', async () => {
  const tempDir = createTempDir('lg-fix-misc-');
  try {
    // Positive fixture: multiple issues across remaining modules
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'misc-app',
        dependencies: { next: '14.0.0', lodash: '*' },
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
      })
    );
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'console.log(process.env.UNTRACKED_KEY);');
    fs.writeFileSync(path.join(tempDir, '.env.local'), 'FOO=bar');
    fs.writeFileSync(path.join(tempDir, '.env.example'), 'FOO=bar');
    fs.mkdirSync(path.join(tempDir, 'public'));
    fs.writeFileSync(path.join(tempDir, 'public', 'heavy.png'), 'B'.repeat(600 * 1024)); // 600KB
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');

    const registry = createDefaultRegistry();
    let report = await executeScan({
      options: { ...defaultOptions, targetPath: tempDir },
      registry,
    });

    const ruleIds = report.findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('code-quality/typescript-config-missing'), 'Must flag tsconfig-missing');
    assert.ok(ruleIds.includes('code-quality/eslint-config-missing'), 'Must flag eslint-missing');
    assert.ok(ruleIds.includes('code-quality/build-script-missing'), 'Must flag build-script-missing');
    assert.ok(ruleIds.includes('code-quality/test-script-missing'), 'Must flag test-script-missing');
    assert.ok(ruleIds.includes('code-quality/node-version-missing'), 'Must flag node-version-missing');
    assert.ok(ruleIds.includes('deployment/env-var-untracked'), 'Must flag env-var-untracked');
    assert.ok(ruleIds.includes('deployment/start-script-missing'), 'Must flag start-script-missing');
    assert.ok(ruleIds.includes('performance/large-static-asset'), 'Must flag large-static-asset');
    assert.ok(ruleIds.includes('dependencies/multiple-lockfiles'), 'Must flag multiple-lockfiles');
    assert.ok(ruleIds.includes('dependencies/wildcard-version-range'), 'Must flag wildcard-version-range');

    // Negative fixture: clean up remaining modules
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'misc-app',
        dependencies: { next: '14.0.0', lodash: '^4.17.21' },
        scripts: { build: 'next build', start: 'next start', test: 'node --test' },
        engines: { node: '>=18.0.0' },
      })
    );
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
    fs.writeFileSync(path.join(tempDir, '.eslintrc.json'), JSON.stringify({ extends: 'next' }));
    fs.unlinkSync(path.join(tempDir, 'yarn.lock'));
    fs.unlinkSync(path.join(tempDir, 'public', 'heavy.png'));
    fs.appendFileSync(path.join(tempDir, '.env.example'), '\nUNTRACKED_KEY=\n');

    report = await executeScan({
      options: {
        ...defaultOptions,
        targetPath: tempDir,
        categories: ['code-quality', 'deployment', 'performance', 'dependencies'],
      },
      registry,
    });

    const remainingFindings = report.findings.filter((f) =>
      ['code-quality', 'deployment', 'performance', 'dependencies'].includes(f.category)
    );
    assert.strictEqual(remainingFindings.length, 0, 'Clean setup must emit 0 findings for these modules');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
