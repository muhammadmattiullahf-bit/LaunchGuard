import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../../src/cli/cli.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('CLI: --help returns exit code 0', async () => {
  const code = await runCli(['--help']);
  assert.strictEqual(code, 0);
});

test('CLI: --version returns exit code 0', async () => {
  const code = await runCli(['--version']);
  assert.strictEqual(code, 0);
});

test('CLI: rules list returns exit code 0', async () => {
  const code = await runCli(['rules', 'list']);
  assert.strictEqual(code, 0);
});

test('CLI: rules unknown-subcommand returns exit code 2 (usage error)', async () => {
  const code = await runCli(['rules', 'badcommand']);
  assert.strictEqual(code, 2);
});

test('CLI: scan on non-existent path returns exit code 2', async () => {
  const code = await runCli(['scan', '/path/does/not/exist/for/launchguard']);
  assert.strictEqual(code, 2);
});

test('CLI: scan on non-Next.js project returns exit code 2', async () => {
  const tempDir = createTempDir('lg-cli-not-next-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'regular-node-app' })
    );
    const code = await runCli(['scan', tempDir]);
    assert.strictEqual(code, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI: Full scan on valid Next.js project succeeds with code 0', async () => {
  const tempDir = createTempDir('lg-cli-valid-');
  try {
    // Setup clean Next.js project
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'clean-next-app',
        scripts: { build: 'next build', start: 'next start' },
        dependencies: { next: '14.2.0', react: '18.2.0' },
        devDependencies: { typescript: '^5.0.0' },
        engines: { node: '>=18.0.0' },
      })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(
      path.join(tempDir, 'app', 'layout.tsx'),
      'export const metadata = { title: "Clean App", description: "A clean app" }; export default function L({children}) { return children; }'
    );
    fs.writeFileSync(path.join(tempDir, 'app', 'page.tsx'), 'export default function P() { return <div>Home</div>; }');
    fs.writeFileSync(path.join(tempDir, 'app', 'robots.ts'), 'export default function robots() { return {}; }');
    fs.writeFileSync(path.join(tempDir, 'app', 'sitemap.ts'), 'export default function sitemap() { return []; }');
    fs.writeFileSync(path.join(tempDir, 'next.config.mjs'), 'export default { poweredByHeader: false };');
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
    fs.writeFileSync(path.join(tempDir, '.eslintrc.json'), JSON.stringify({ extends: 'next/core-web-vitals' }));
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), JSON.stringify({ name: 'clean-next-app', lockfileVersion: 3 }));
    fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules\n.next\n.env*\n');

    const outJsonPath = path.join(tempDir, 'report.json');
    const code = await runCli(['scan', tempDir, '--format', 'json', '--output', outJsonPath]);
    assert.strictEqual(code, 0);

    assert.strictEqual(fs.existsSync(outJsonPath), true);
    const report = JSON.parse(fs.readFileSync(outJsonPath, 'utf-8'));
    assert.strictEqual(report.status, 'complete');
    assert.strictEqual(report.summary.readinessScore.overall >= 80, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI: --fail-on exits with code 1 when threshold breached', async () => {
  const tempDir = createTempDir('lg-cli-fail-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'leaky-app',
        dependencies: { next: '14.2.0' },
      })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(
      path.join(tempDir, 'app', 'page.tsx'),
      'export default function P() { const token = "sk-1234567890abcdef1234567890abcdef"; }'
    );

    const code = await runCli(['scan', tempDir, '--fail-on', 'critical']);
    // Critical finding triggered -> exit code 1
    assert.strictEqual(code, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
