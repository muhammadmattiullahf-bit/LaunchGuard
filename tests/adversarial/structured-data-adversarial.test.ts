import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import {
  extractJsonLdBlocks,
  parseJsonLdBlock,
} from '../../src/core/structured-data/index.ts';
import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';
import { createDefaultRegistry } from '../../src/rules/index.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Structured Data Adversarial: Oversized payload (500KB) parses safely without memory exhaustion', () => {
  // Construct a 500KB valid JSON-LD structure with 1,000 items in a @graph
  const items = Array.from({ length: 1000 }, (_, i) => ({
    '@type': 'Article',
    headline: `Article ${i} with long descriptive title ${'x'.repeat(200)}`,
    url: `https://example.com/article/${i}`,
    datePublished: '2026-11-20',
  }));

  const payload = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': items,
  });

  const content = `<script type="application/ld+json">${payload}</script>`;

  const start = performance.now();
  const blocks = extractJsonLdBlocks(content, 'app/heavy.tsx');
  assert.strictEqual(blocks.length, 1);

  const parsed = parseJsonLdBlock(blocks[0]!);
  const duration = performance.now() - start;

  assert.strictEqual(parsed.isValidJson, true);
  assert.strictEqual(parsed.entities.length, 1000);
  assert.ok(duration < 1000, `Large payload parsing must be fast (took ${duration.toFixed(2)}ms)`);
});

test('Structured Data Adversarial: Deeply nested objects (30 levels) parse without stack overflow', () => {
  let nested: any = { '@type': 'Thing', name: 'Deepest' };
  for (let i = 0; i < 30; i++) {
    nested = { '@type': 'Thing', name: `Level ${i}`, child: nested };
  }

  const payload = JSON.stringify({
    '@context': 'https://schema.org',
    ...nested,
  });

  const content = `<script type="application/ld+json">${payload}</script>`;
  const blocks = extractJsonLdBlocks(content, 'app/deep.tsx');
  assert.strictEqual(blocks.length, 1);

  assert.doesNotThrow(() => {
    const parsed = parseJsonLdBlock(blocks[0]!);
    assert.strictEqual(parsed.isValidJson, true);
  });
});

test('Structured Data Adversarial: ReDoS resistance on adversarial script markup', () => {
  // Construct content with thousands of unclosed tags, malformed quotes, and noise
  let adversarialContent = '<head>\n';
  for (let i = 0; i < 2000; i++) {
    adversarialContent += `<script type="application/ld+json" data-attr="test-${i}">\n`;
    adversarialContent += `{"@context": "https://schema.org", "@type": "Thing", "id": ${i}}\n`;
    adversarialContent += '</script>\n';
  }
  adversarialContent += '<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: unclosedQuote\n';
  adversarialContent += '<script type="application/ld+json">{"unclosed: json\n</head>';

  const start = performance.now();
  const blocks = extractJsonLdBlocks(adversarialContent, 'app/adversarial.tsx');
  const duration = performance.now() - start;

  assert.ok(duration < 1000, `Regex extraction must execute under 1000ms (took ${duration.toFixed(2)}ms)`);
  assert.ok(blocks.length >= 2000, 'All valid blocks should be extracted');
});

test('Structured Data Adversarial: Target-project code execution prevention (ADR-002)', () => {
  let executed = false;
  (globalThis as any).__DANGEROUS_M6_FLAG__ = () => {
    executed = true;
  };

  const maliciousPayload = `
    // Attempt code execution inside source file
    globalThis.__DANGEROUS_M6_FLAG__();
    process.exit(999);
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "EvilSite"
      }
    </script>
  `;

  const blocks = extractJsonLdBlocks(maliciousPayload, 'app/evil.tsx');
  assert.strictEqual(executed, false, 'Target project code must NEVER execute during analysis');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0]?.classification, 'literal');
  delete (globalThis as any).__DANGEROUS_M6_FLAG__;
});

test('Structured Data Adversarial: Zero outbound network calls during scan (ADR-006)', async () => {
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

    const tempDir = createTempDir('lg-sdt-net-');
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'schema-net-test', dependencies: { next: '14.2.0' } })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(
      path.join(tempDir, 'app', 'page.tsx'),
      `
      export default function Page() {
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Offline Org',
                url: 'https://offline.org'
              })
            }}
          />
        );
      }
      `
    );

    const registry = createDefaultRegistry();
    const report = await executeScan({
      options: {
        targetPath: tempDir,
        format: 'json',
        categories: ['structured-data'],
        timeoutMs: 5000,
        maxFileSize: 10 * 1024 * 1024,
        noColor: true,
        verbose: false,
        quiet: true,
      },
      registry,
    });

    assert.strictEqual(report.status, 'complete');
    assert.strictEqual(networkEvents.length, 0, 'No outbound network calls must be initiated');

    fs.rmSync(tempDir, { recursive: true, force: true });
  } finally {
    dns.lookup = originalDnsLookup;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    net.connect = originalNetConnect;
  }
});
