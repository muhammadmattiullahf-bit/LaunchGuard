import test from 'node:test';
import assert from 'node:assert';
import { redactSecrets, formatSafeEvidence, containsSecretPattern } from '../../src/core/redaction/redactor.ts';
import { FindingCollector } from '../../src/core/dedup/finding-collector.ts';
import { formatJsonReport } from '../../src/reporters/json-reporter.ts';
import { formatSarifReport } from '../../src/reporters/sarif-reporter.ts';
import type { RuleDefinition, ReportModel } from '../../src/core/types.ts';

test('Secret Redaction Deep: SSH private keys (OpenSSH and RSA multiline)', () => {
  const openSshKey = `
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
NhAAAAAwEAAQAAAYEAvz17e358bXJkcmZkZ2hoamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3
ODkw...
-----END OPENSSH PRIVATE KEY-----
`;
  const rsaKey = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1234567890abcdefghijklmnopqrstuvwxyz1234567890...
-----END RSA PRIVATE KEY-----
`;

  assert.ok(containsSecretPattern(openSshKey), 'OpenSSH key must be detected');
  assert.ok(containsSecretPattern(rsaKey), 'RSA key must be detected');

  const redactedOpenSsh = redactSecrets(openSshKey);
  assert.strictEqual(redactedOpenSsh.includes('b3BlbnNzaC1rZXktdjE'), false);
  assert.ok(redactedOpenSsh.includes('[REDACTED:PRIVATE_KEY]'));

  const redactedRsa = redactSecrets(rsaKey);
  assert.strictEqual(redactedRsa.includes('MIIEowIBAAKCAQEA0Y1234567890'), false);
  assert.ok(redactedRsa.includes('[REDACTED:PRIVATE_KEY]'));
});

test('Secret Redaction Deep: JSON Web Tokens (JWTs)', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const text = `const authHeader = "Bearer ${jwt}";`;

  assert.ok(containsSecretPattern(text), 'JWT must be detected');
  const redacted = redactSecrets(text);
  assert.strictEqual(redacted.includes('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'), false);
  assert.ok(redacted.includes('[REDACTED:JWT_TOKEN]') || redacted.includes('[REDACTED:BEARER_TOKEN]'));
});

test('Secret Redaction Deep: URL credentials across multiple protocols', () => {
  const urls = [
    'https://admin:superSecret123@internal.corp.net/api',
    'http://deployer:p@ssw0rd!@staging.example.com',
    'postgres://db_user:mySecretDbPassword@db.internal:5432/production',
    'mongodb+srv://app_user:mongoSuperPass99@cluster0.mongodb.net/prod',
    'redis://default:redisSecretToken@cache.internal:6379',
    'ftp://backupuser:backupFtpPass2026@ftp.storage.org',
  ];

  for (const u of urls) {
    assert.ok(containsSecretPattern(u), `URL credential must be detected: ${u}`);
    const redacted = redactSecrets(u);
    assert.strictEqual(redacted.includes('superSecret123'), false);
    assert.strictEqual(redacted.includes('p@ssw0rd!'), false);
    assert.strictEqual(redacted.includes('mySecretDbPassword'), false);
    assert.strictEqual(redacted.includes('mongoSuperPass99'), false);
    assert.strictEqual(redacted.includes('redisSecretToken'), false);
    assert.strictEqual(redacted.includes('backupFtpPass2026'), false);
    assert.ok(redacted.includes('[REDACTED:PASSWORD]'), `Must contain [REDACTED:PASSWORD]: ${redacted}`);
  }
});

test('Secret Redaction Deep: Generic API tokens, Anthropic, Google, Slack, Bearer', () => {
  const samples = [
    { type: 'Anthropic', raw: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz' },
    { type: 'Google', raw: 'AIzaSyA1234567890abcdefghijklmnopqrstuvw' },
    { type: 'Slack', raw: 'xoxb-123456789012-1234567890123-abcdefghijklmnop' },
    { type: 'Generic Token', raw: 'api_key = "abcdef9876543210zyxwvutsrqponmlkj"' },
    { type: 'Bearer Header', raw: 'Authorization: Bearer mySecretSessionToken1234567890' },
  ];

  for (const s of samples) {
    assert.ok(containsSecretPattern(s.raw), `Must detect ${s.type}`);
    const red = redactSecrets(s.raw);
    assert.strictEqual(red.includes(s.raw), false, `Plaintext secret must not survive in ${s.type}`);
    assert.ok(red.includes('[REDACTED:'), `Must have redacted marker in ${s.type}`);
  }
});

test('Secret Redaction Deep: Secrets in Exception Messages and Truncation', () => {
  const secret = 'ghp_CONFIDENTIAL_TOKEN_VALUE_123456789012345';
  const ex = new Error(`Connection failed to https://admin:${secret}@api.service.com`);
  const safeMessage = redactSecrets(ex.message);

  assert.strictEqual(safeMessage.includes(secret), false);
  assert.ok(safeMessage.includes('[REDACTED:PASSWORD]'));

  // Test evidence truncation
  const longBlob = 'A'.repeat(500);
  const formatted = formatSafeEvidence(longBlob);
  assert.ok(formatted && formatted.length <= 320, 'Evidence must be bounded and truncated');
  assert.ok(formatted && formatted.endsWith('... [truncated]'));
});

test('Secret Redaction Deep: Pre-emission verification in FindingCollector, JSON, and SARIF', () => {
  const plainSecret = 'sk-12345678901234567890abcdef1234567890';
  const rawCodeSnippet = `const client = new OpenAI({ apiKey: "${plainSecret}" });`;

  const dummyRule: RuleDefinition = {
    id: 'security/secret-token-leak',
    candidateId: 'LG-SEC-R002',
    category: 'security',
    title: 'Secret Leak',
    description: 'Found secret',
    defaultSeverity: 'critical',
    defaultConfidence: 'high',
    documentationUrl: 'https://launchguard.dev',
    releaseClass: 'mvp',
    requiresNetwork: false,
    execute: () => [],
  };

  const collector = new FindingCollector();
  collector.addRawFinding(dummyRule, {
    title: 'Exposed secret',
    description: 'Found apiKey',
    location: { file: 'src/api.ts', line: 5 },
    recommendation: 'Use process.env',
    evidenceAnchor: 'client-apiKey',
    evidence: rawCodeSnippet, // Raw unmasked evidence passed to collector
  });

  const processed = collector.processFindings({
    targetPath: '.',
    format: 'json',
    timeoutMs: 1000,
    maxFileSize: 1000,
    noColor: true,
    verbose: false,
    quiet: false,
  });

  // Verify that FindingCollector sanitized evidence before storage!
  assert.strictEqual(processed.activeFindings.length, 1);
  const storedFinding = processed.activeFindings[0]!;
  assert.strictEqual(storedFinding.evidence?.includes(plainSecret), false, 'Stored finding must NOT contain raw secret');
  assert.ok(storedFinding.evidence?.includes('[REDACTED:OPENAI_API_KEY]'));

  // Verify persistent Report structures
  const report: ReportModel = {
    schemaVersion: '1.0.0',
    tool: { name: 'launchguard', version: '0.1.0' },
    status: 'complete',
    scan: {
      targetPath: '.',
      startTime: '',
      endTime: '',
      durationMs: 10,
      categoriesExecuted: ['security'],
      rulesExecutedCount: 1,
      filesScannedCount: 1,
      networkUsed: false,
    },
    summary: {
      totalFindings: 1,
      bySeverity: { critical: 1, high: 0, medium: 0, low: 0, informational: 0 },
      suppressedCount: 0,
      readinessScore: { overall: 75, byCategory: { security: 75 }, disclaimer: 'disclaimer', methodVersion: '1.0' },
    },
    findings: processed.activeFindings,
    suppressed: [],
    faults: [],
    skippedFiles: [],
  };

  const jsonSerialized = formatJsonReport(report);
  const sarifSerialized = formatSarifReport(report);

  assert.strictEqual(jsonSerialized.includes(plainSecret), false, 'JSON output must never leak raw secret');
  assert.strictEqual(sarifSerialized.includes(plainSecret), false, 'SARIF output must never leak raw secret');
  assert.ok(jsonSerialized.includes('[REDACTED:OPENAI_API_KEY]'));
  assert.ok(sarifSerialized.includes('[REDACTED:OPENAI_API_KEY]'));
});

test('Secret Redaction Deep: SARIF region.snippet.text always receives redacted evidence on malformed or direct input', () => {
  const directSecret = 'ghp_DIRECTUNREDACTEDSECRETTOKEN1234567890';
  const malformedReport: any = {
    schemaVersion: '1.0.0',
    tool: { name: 'launchguard', version: '0.1.0' },
    status: 'complete',
    scan: { targetPath: '.', startTime: '', endTime: '', durationMs: 0, categoriesExecuted: [], rulesExecutedCount: 1, filesScannedCount: 1, networkUsed: false },
    summary: { totalFindings: 1, bySeverity: { critical: 1, high: 0, medium: 0, low: 0, informational: 0 }, suppressedCount: 0, readinessScore: { overall: 0, byCategory: {}, disclaimer: '', methodVersion: '1.0' } },
    findings: [
      {
        id: 'f-direct',
        ruleId: 'security/secret-token-leak',
        candidateId: 'LG-SEC-R002',
        title: `Direct leak: ${directSecret}`,
        description: `Description with ${directSecret}`,
        severity: 'critical',
        category: 'security',
        confidence: 'high',
        location: { file: 'src/config.ts', line: 10, column: 1 },
        recommendation: `Fix secret ${directSecret}`,
        documentation: 'https://launchguard.dev',
        autofix: false,
        evidence: `const token = "${directSecret}";`, // Direct unredacted evidence
      },
    ],
    suppressed: [],
    faults: [],
    skippedFiles: [],
  };

  const sarif = formatSarifReport(malformedReport);
  assert.strictEqual(sarif.includes(directSecret), false, 'SARIF must not contain raw secret even when fed directly');
  assert.ok(sarif.includes('[REDACTED:GITHUB_TOKEN]'), 'SARIF must contain redacted replacement in snippet and message');
  
  const parsedSarif = JSON.parse(sarif);
  const snippetText = parsedSarif.runs[0].results[0].locations[0].physicalLocation.region.snippet.text;
  assert.strictEqual(snippetText.includes(directSecret), false);
  assert.ok(snippetText.includes('[REDACTED:GITHUB_TOKEN]'));
});
