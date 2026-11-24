import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import type { DiscoveredFile } from '../../src/core/types.ts';
import {
  buildRouteManifest,
  extractLinksFromFile,
  matchLinkToRoute,
  normalizeLinkTarget,
} from '../../src/core/routing/index.ts';
import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';
import { createDefaultRegistry } from '../../src/rules/index.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Routing Adversarial: Path traversal in link targets does not escape root or crash', () => {
  const maliciousTargets = [
    '/../../../../etc/passwd',
    '/..\\..\\..\\windows\\win.ini',
    '/app/../../secret.env',
    '/%2e%2e/%2e%2e/etc/shadow',
    '//evil.com/phishing',
  ];

  const manifest = buildRouteManifest(
    {
      root: '/fake/root',
      isNextJs: true,
      routerType: 'app',
      hasSrc: false,
      packageJson: { name: 't', dependencies: { next: '14.0.0' } },
      detectedConfigs: { lockfiles: [], envFiles: [] },
      warnings: [],
    },
    [{ relativePath: 'app/page.tsx', absolutePath: '', sizeBytes: 100 }]
  );

  for (const target of maliciousTargets) {
    const normalized = normalizeLinkTarget(target);
    assert.ok(typeof normalized === 'string');
    assert.doesNotThrow(() => {
      const match = matchLinkToRoute(
        {
          target,
          sourceFile: 'app/page.tsx',
          line: 1,
          column: 1,
          kind: 'link-component',
          classification: 'literal',
          rawSnippet: target,
        },
        manifest
      );
      assert.strictEqual(typeof match.matched, 'boolean');
    });
  }
});

test('Routing Adversarial: ReDoS resistance on adversarial or oversized JSX content', () => {
  // Construct a 200KB file with repetitive, nested, and malformed Link tags
  let adversarialContent = '<nav>\n';
  for (let i = 0; i < 5000; i++) {
    adversarialContent += `<Link href="/item/${i}" className="btn-primary" data-attr="test">Link ${i}</Link>\n`;
  }
  adversarialContent += '<Link href={"/unclosed-quote}\n<a href="/nested<a>link</a>\n';
  adversarialContent += '</nav>';

  const start = performance.now();
  const extracted = extractLinksFromFile(adversarialContent, 'app/heavy.tsx');
  const duration = performance.now() - start;

  assert.ok(duration < 1000, `Regex extraction must be fast and bounded (took ${duration.toFixed(2)}ms)`);
  assert.ok(extracted.length >= 5000, 'Should extract all 5000 links safely');
});

test('Routing Adversarial: Deeply nested route structures (25 levels) handle gracefully', () => {
  const deepSegments = Array.from({ length: 25 }, (_, i) => `level${i}`);
  const deepPath = `app/${deepSegments.join('/')}/page.tsx`;

  const files: DiscoveredFile[] = [
    { relativePath: 'app/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: deepPath, absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(
    {
      root: '/fake/root',
      isNextJs: true,
      routerType: 'app',
      hasSrc: false,
      packageJson: { name: 't', dependencies: { next: '14.0.0' } },
      detectedConfigs: { lockfiles: [], envFiles: [] },
      warnings: [],
    },
    files
  );

  assert.strictEqual(manifest.pageRoutes.length, 2);
  const deepRoute = manifest.pageRoutes.find((r) => r.path.startsWith('/level0'));
  assert.ok(deepRoute, 'Deep route should be recognized');
  assert.strictEqual(deepRoute.path, '/' + deepSegments.join('/'));
});

test('Routing Adversarial: Target code execution prevention (ADR-002)', async () => {
  // Ensure that dangerous code in route files is NEVER evaluated
  let dangerousExecuted = false;
  (globalThis as any).__DANGEROUS_ROUTING_FLAG__ = () => {
    dangerousExecuted = true;
  };

  const maliciousCode = `
    // Malicious payload attempting execution during analysis
    globalThis.__DANGEROUS_ROUTING_FLAG__();
    process.exit(999);
    export default function Malicious() { return <div>Evil</div>; }
  `;

  const links = extractLinksFromFile(maliciousCode, 'app/evil/page.tsx');
  assert.strictEqual(dangerousExecuted, false, 'Target project code must never execute');
  assert.ok(Array.isArray(links));
  delete (globalThis as any).__DANGEROUS_ROUTING_FLAG__;
});

test('Routing Adversarial: Zero outbound network calls initiated during routing audit (ADR-006)', async () => {
  const networkEvents: string[] = [];

  const originalDnsLookup = dns.lookup;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalNetConnect = net.connect;

  try {
    dns.lookup = ((...args: any[]) => {
      networkEvents.push(`dns.lookup(${args[0]})`);
      throw new Error(`Unauthorized network call: dns.lookup(${args[0]})`);
    }) as any;

    http.request = ((..._args: any[]) => {
      networkEvents.push('http.request');
      throw new Error('Unauthorized network call: http.request');
    }) as any;

    https.request = ((..._args: any[]) => {
      networkEvents.push('https.request');
      throw new Error('Unauthorized network call: https.request');
    }) as any;

    net.connect = ((..._args: any[]) => {
      networkEvents.push('net.connect');
      throw new Error('Unauthorized network call: net.connect');
    }) as any;

    const tempDir = createTempDir('lg-route-net-');
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'route-net-test', dependencies: { next: '14.2.0' } })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(path.join(tempDir, 'app', 'page.tsx'), '<Link href="/about">About</Link>');
    fs.mkdirSync(path.join(tempDir, 'app', 'about'));
    fs.writeFileSync(path.join(tempDir, 'app', 'about', 'page.tsx'), '<Link href="/">Home</Link>');

    const registry = createDefaultRegistry();
    const report = await executeScan({
      options: {
        targetPath: tempDir,
        format: 'json',
        categories: ['routing'],
        timeoutMs: 5000,
        maxFileSize: 10 * 1024 * 1024,
        noColor: true,
        verbose: false,
        quiet: true,
      },
      registry,
    });

    assert.strictEqual(report.status, 'complete');
    assert.strictEqual(networkEvents.length, 0, 'No network events must occur');

    fs.rmSync(tempDir, { recursive: true, force: true });
  } finally {
    dns.lookup = originalDnsLookup;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    net.connect = originalNetConnect;
  }
});
