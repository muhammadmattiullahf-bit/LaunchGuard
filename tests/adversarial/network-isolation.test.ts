import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';

import { runCli } from '../../src/cli/cli.ts';
import { executeScan } from '../../src/core/orchestrator/scan-orchestrator.ts';
import { createDefaultRegistry } from '../../src/rules/index.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Network Isolation: Scans initiate 0 outbound DNS, HTTP, HTTPS, TCP or TLS connections', async () => {
  const tempDir = createTempDir('lg-net-iso-');
  const networkEvents: string[] = [];

  // 1. Instrument / Spy on all native networking modules
  const originalDnsLookup = dns.lookup;
  const originalDnsResolve = dns.resolve;
  const originalHttpRequest = http.request;
  const originalHttpGet = http.get;
  const originalHttpsRequest = https.request;
  const originalHttpsGet = https.get;
  const originalNetConnect = net.connect;
  const originalSocketConnect = net.Socket.prototype.connect;
  const originalTlsConnect = tls.connect;
  const originalFetch = globalThis.fetch;

  try {
    dns.lookup = ((...args: any[]) => {
      networkEvents.push(`dns.lookup(${args[0]})`);
      throw new Error(`Unauthorized network call: dns.lookup(${args[0]})`);
    }) as any;

    dns.resolve = ((...args: any[]) => {
      networkEvents.push(`dns.resolve(${args[0]})`);
      throw new Error(`Unauthorized network call: dns.resolve(${args[0]})`);
    }) as any;

    http.request = ((..._args: any[]) => {
      networkEvents.push('http.request');
      throw new Error('Unauthorized network call: http.request');
    }) as any;

    http.get = ((..._args: any[]) => {
      networkEvents.push('http.get');
      throw new Error('Unauthorized network call: http.get');
    }) as any;

    https.request = ((..._args: any[]) => {
      networkEvents.push('https.request');
      throw new Error('Unauthorized network call: https.request');
    }) as any;

    https.get = ((..._args: any[]) => {
      networkEvents.push('https.get');
      throw new Error('Unauthorized network call: https.get');
    }) as any;

    net.connect = ((..._args: any[]) => {
      networkEvents.push('net.connect');
      throw new Error('Unauthorized network call: net.connect');
    }) as any;

    net.Socket.prototype.connect = function (..._args: any[]) {
      networkEvents.push('net.Socket.connect');
      throw new Error('Unauthorized network call: net.Socket.connect');
    };

    tls.connect = ((..._args: any[]) => {
      networkEvents.push('tls.connect');
      throw new Error('Unauthorized network call: tls.connect');
    }) as any;

    if (globalThis.fetch) {
      globalThis.fetch = ((..._args: any[]) => {
        networkEvents.push('globalThis.fetch');
        return Promise.reject(new Error('Unauthorized network call: globalThis.fetch'));
      }) as any;
    }

    // 2. Setup standard fixture project
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'network-isolated-app',
        dependencies: { next: '14.2.0', react: '18.2.0' },
        scripts: { build: 'next build', start: 'next start' },
      })
    );
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(path.join(tempDir, 'app', 'layout.tsx'), 'export default function L({children}: any){return children;}');
    fs.writeFileSync(path.join(tempDir, 'app', 'page.tsx'), 'export default function P(){return <div>Page</div>;}');
    fs.writeFileSync(path.join(tempDir, 'next.config.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    // 3. Run full CLI scan
    const cliExitCode = await runCli(['scan', tempDir]);
    assert.strictEqual(cliExitCode, 0, 'Scan must succeed offline');

    // 4. Run programmatic scan across all 27 rules
    const registry = createDefaultRegistry();
    const report = await executeScan({
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

    assert.strictEqual(report.status, 'complete');
    assert.strictEqual(report.scan.networkUsed, false, 'networkUsed must be false');

    // 5. Assert ZERO network attempts occurred
    assert.strictEqual(
      networkEvents.length,
      0,
      `Expected 0 network events, but observed: ${JSON.stringify(networkEvents)}`
    );
  } finally {
    // Restore original networking APIs
    dns.lookup = originalDnsLookup;
    dns.resolve = originalDnsResolve;
    http.request = originalHttpRequest;
    http.get = originalHttpGet;
    https.request = originalHttpsRequest;
    https.get = originalHttpsGet;
    net.connect = originalNetConnect;
    net.Socket.prototype.connect = originalSocketConnect;
    tls.connect = originalTlsConnect;
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
