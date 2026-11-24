import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { discoverFilesSafely, isPathContained } from '../../src/core/discovery/safe-file-discovery.ts';
import { discoverProject } from '../../src/core/discovery/project-discovery.ts';
import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Filesystem Deep: Hard Links within repository root', async () => {
  const tempDir = createTempDir('lg-fs-hardlink-');
  try {
    const fileA = path.join(tempDir, 'original.ts');
    const fileB = path.join(tempDir, 'hardlink.ts');
    fs.writeFileSync(fileA, 'export const val = 42;');

    let canHardLink = false;
    try {
      fs.linkSync(fileA, fileB);
      canHardLink = true;
    } catch {
      // Platform / privilege might prohibit
    }

    if (canHardLink) {
      const discovery = await discoverFilesSafely(tempDir);
      // Hardlinks within root must be discovered normally
      assert.ok(discovery.files.some((f) => f.relativePath === 'original.ts'));
      assert.ok(discovery.files.some((f) => f.relativePath === 'hardlink.ts'));
      assert.strictEqual(discovery.skippedFiles.length, 0);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Filesystem Deep: Windows Directory Junctions and External Reparse Points', async () => {
  const tempDir = createTempDir('lg-fs-junction-');
  const externalDir = createTempDir('lg-fs-external-');
  fs.writeFileSync(path.join(externalDir, 'host-confidential.txt'), 'SUPER_SECRET_EXTERNAL_DATA');

  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'junction-test', dependencies: { next: '14.2.0' } })
    );

    let canJunction = false;
    const junctionPath = path.join(tempDir, 'ext-junction');
    try {
      fs.symlinkSync(externalDir, junctionPath, 'junction');
      canJunction = true;
    } catch {
      // Skip if permissions insufficient
    }

    if (canJunction) {
      const discovery = await discoverFilesSafely(tempDir);
      // Ensure no external files leaked into project files
      assert.strictEqual(
        discovery.files.some((f) => f.relativePath.includes('host-confidential.txt')),
        false,
        'External files linked via junction must NOT be included in discovered files'
      );
      assert.ok(
        discovery.skippedFiles.some((s) => s.reason.includes('Symlink points outside')),
        'External junction must be recorded in skippedFiles'
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
});

test('Filesystem Deep: Unicode Normalization (NFC and NFD characters in filenames)', async () => {
  const tempDir = createTempDir('lg-fs-unicode-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'unicode-test', dependencies: { next: '14.2.0' } })
    );

    // NFC: composed é (\u00E9)
    const nfcFile = path.join(tempDir, 'caf\u00E9.ts');
    fs.writeFileSync(nfcFile, 'export const item = "coffee";');

    // NFD: decomposed e + acute accent (e\u0301)
    const nfdFile = path.join(tempDir, 'resum\u0065\u0301.ts');
    fs.writeFileSync(nfdFile, 'export const role = "engineer";');

    const discovery = await discoverFilesSafely(tempDir);
    // Filesystem crawler must safely discover Unicode paths without crashing
    assert.ok(discovery.files.length >= 3);
    for (const f of discovery.files) {
      assert.ok(isPathContained(tempDir, path.join(tempDir, f.relativePath)));
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Filesystem Deep: Case Sensitivity and Router layout detection', async () => {
  const tempDir = createTempDir('lg-fs-case-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'case-test', dependencies: { next: '14.2.0' } })
    );

    // App Router directory
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(path.join(tempDir, 'app', 'layout.tsx'), 'export default function L({children}:any){return children;}');
    fs.writeFileSync(path.join(tempDir, 'app', 'page.tsx'), 'export default function P(){return <div>Case</div>;}');

    const project = await discoverProject(tempDir);
    assert.strictEqual(project.isNextJs, true);
    assert.strictEqual(project.routerType, 'app');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Filesystem Deep: Complex Path Traversal Attempts in safeReadFile', async () => {
  const tempDir = createTempDir('lg-fs-traversal-');
  const outsideSecret = path.join(os.tmpdir(), 'secret-' + Date.now() + '.txt');
  fs.writeFileSync(outsideSecret, 'ROOT_RESTRICTED');

  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'traversal-target', dependencies: { next: '14.2.0' } })
    );

    let readResult1: string | null = 'not-called';
    let readResult2: string | null = 'not-called';
    let readResult3: string | null = 'not-called';

    const testRule = {
      id: 'test/traversal-probe',
      candidateId: 'LG-TEST-TRAV',
      category: 'security' as const,
      title: 'Probe',
      description: 'Probe',
      defaultSeverity: 'high' as const,
      defaultConfidence: 'high' as const,
      documentationUrl: 'https://launchguard.dev',
      releaseClass: 'mvp' as const,
      requiresNetwork: false,
      execute: async ({ readFile }: any) => {
        readResult1 = await readFile(`../../${path.basename(outsideSecret)}`);
        readResult2 = await readFile(`....//....//${path.basename(outsideSecret)}`);
        readResult3 = await readFile(outsideSecret); // Absolute path outside root
        return [];
      },
    };

    const registry = {
      getAllRules: () => [testRule],
      filterRules: () => [testRule],
    } as any;

    await executeScan({
      options: {
        targetPath: tempDir,
        format: 'terminal',
        timeoutMs: 5000,
        maxFileSize: 10 * 1024 * 1024,
        noColor: true,
        verbose: false,
        quiet: true,
      },
      registry,
    });

    assert.strictEqual(readResult1, null, 'Relative ../ must return null');
    assert.strictEqual(readResult2, null, 'Malformed dots must return null');
    assert.strictEqual(readResult3, null, 'Absolute external path must return null');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(outsideSecret, { force: true });
  }
});

test('Filesystem Deep: Cancellation and AbortSignal Timeout during scanning', async () => {
  const tempDir = createTempDir('lg-fs-cancel-');
  try {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'cancel-app', dependencies: { next: '14.2.0' } })
    );

    // Rule that sleeps longer than timeout
    const slowRule = {
      id: 'test/slow-rule',
      candidateId: 'LG-TEST-SLOW',
      category: 'performance' as const,
      title: 'Slow rule',
      description: 'Sleeps',
      defaultSeverity: 'low' as const,
      defaultConfidence: 'high' as const,
      documentationUrl: 'https://launchguard.dev',
      releaseClass: 'mvp' as const,
      requiresNetwork: false,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return [];
      },
    };

    const registry = {
      getAllRules: () => [slowRule],
      filterRules: () => [slowRule],
    } as any;

    const report = await executeScan({
      options: {
        targetPath: tempDir,
        format: 'terminal',
        timeoutMs: 50, // 50ms timeout < 500ms sleep
        maxFileSize: 10 * 1024 * 1024,
        noColor: true,
        verbose: false,
        quiet: true,
      },
      registry,
    });

    assert.strictEqual(report.status, 'incomplete', 'Scan must be incomplete on timeout');
    assert.ok(
      report.faults.some((f) => f.ruleId === 'test/slow-rule' || f.error.toLowerCase().includes('timeout') || f.error.includes('exceeded')),
      'Timeout fault must be recorded'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
