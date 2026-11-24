import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverProject, ProjectDiscoveryError } from '../../src/core/discovery/project-discovery.ts';
import { discoverFilesSafely, isPathContained } from '../../src/core/discovery/safe-file-discovery.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Project Discovery: Throws on non-existent path', async () => {
  const fakePath = path.join(os.tmpdir(), 'non-existent-launchguard-' + Date.now());
  await assert.rejects(
    async () => await discoverProject(fakePath),
    (err: unknown) => {
      assert.ok(err instanceof ProjectDiscoveryError);
      assert.strictEqual(err.code, 'INVALID_PATH');
      return true;
    }
  );
});

test('Project Discovery: Throws on missing package.json', async () => {
  const tempDir = createTempDir('lg-no-pkg-');
  try {
    await assert.rejects(
      async () => await discoverProject(tempDir),
      (err: unknown) => {
        assert.ok(err instanceof ProjectDiscoveryError);
        assert.strictEqual(err.code, 'MISSING_PACKAGE_JSON');
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Project Discovery: Throws on non-Next.js project', async () => {
  const tempDir = createTempDir('lg-not-next-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-app', dependencies: { express: '^4.18.0' } })
    );
    await assert.rejects(
      async () => await discoverProject(tempDir),
      (err: unknown) => {
        assert.ok(err instanceof ProjectDiscoveryError);
        assert.strictEqual(err.code, 'NOT_NEXTJS_PROJECT');
        return true;
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Project Discovery: Successfully discovers App Router Next.js project and configs', async () => {
  const tempDir = createTempDir('lg-valid-next-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'next-test-app',
        dependencies: { next: '14.2.0', react: '18.2.0' },
      })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(path.join(tempDir, 'app', 'page.tsx'), 'export default function Page() {}');
    fs.writeFileSync(path.join(tempDir, 'next.config.mjs'), 'export default {};');
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules\n.next');
    fs.writeFileSync(path.join(tempDir, '.env.local'), 'FOO=bar');
    fs.writeFileSync(path.join(tempDir, '.env.example'), 'FOO=');

    const desc = await discoverProject(tempDir);
    assert.strictEqual(desc.isNextJs, true);
    assert.strictEqual(desc.routerType, 'app');
    assert.strictEqual(desc.detectedConfigs.nextConfig, 'next.config.mjs');
    assert.strictEqual(desc.detectedConfigs.tsconfig, 'tsconfig.json');
    assert.deepStrictEqual(desc.detectedConfigs.lockfiles, ['package-lock.json']);
    assert.strictEqual(desc.detectedConfigs.gitignore, true);
    assert.strictEqual(desc.detectedConfigs.envFiles.includes('.env.local'), true);
    assert.strictEqual(desc.detectedConfigs.envTemplate, '.env.example');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Safe File Discovery: Traversal prevention and skips default directories', async () => {
  const tempDir = createTempDir('lg-fs-safe-');
  try {
    // Regular file
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'console.log("hi");');
    
    // Ignored directories
    fs.mkdirSync(path.join(tempDir, 'node_modules'));
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'dep.js'), 'ignored');
    fs.mkdirSync(path.join(tempDir, '.next'));
    fs.writeFileSync(path.join(tempDir, '.next', 'build.js'), 'ignored');
    
    // Subdirectory file
    fs.mkdirSync(path.join(tempDir, 'public'));
    fs.writeFileSync(path.join(tempDir, 'public', 'logo.png'), 'image-bytes');

    const result = await discoverFilesSafely(tempDir);
    const relPaths = result.files.map(f => f.relativePath);

    assert.strictEqual(relPaths.includes('index.ts'), true);
    assert.strictEqual(relPaths.includes('public/logo.png'), true);
    assert.strictEqual(relPaths.some(p => p.startsWith('node_modules')), false);
    assert.strictEqual(relPaths.some(p => p.startsWith('.next')), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Safe File Discovery: Skips files exceeding max size', async () => {
  const tempDir = createTempDir('lg-fs-size-');
  try {
    fs.writeFileSync(path.join(tempDir, 'small.txt'), 'hello');
    fs.writeFileSync(path.join(tempDir, 'large.txt'), 'x'.repeat(1000));

    // Limit to 500 bytes
    const result = await discoverFilesSafely(tempDir, { maxFileSize: 500 });
    const relPaths = result.files.map(f => f.relativePath);
    assert.strictEqual(relPaths.includes('small.txt'), true);
    assert.strictEqual(relPaths.includes('large.txt'), false);

    const skipped = result.skippedFiles.find(s => s.path === 'large.txt');
    assert.ok(skipped);
    assert.strictEqual(skipped.reason.includes('exceeds limit'), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Safe File Discovery: isPathContained helper check', () => {
  const root = path.resolve('/var/app/project');
  assert.strictEqual(isPathContained(root, path.resolve('/var/app/project/src/index.ts')), true);
  assert.strictEqual(isPathContained(root, path.resolve('/var/app/other/index.ts')), false);
  assert.strictEqual(isPathContained(root, path.resolve('/etc/passwd')), false);
});
