import test from 'node:test';
import assert from 'node:assert';
import { redactSecrets, containsSecretPattern, formatSafeEvidence } from '../../src/core/redaction/redactor.ts';

test('Redactor: Masks OpenAI API keys', () => {
  const secret = 'sk-1234567890abcdef1234567890abcdef';
  const text = `const apiKey = "${secret}";`;
  const redacted = redactSecrets(text);
  assert.strictEqual(redacted.includes(secret), false);
  assert.strictEqual(redacted.includes('[REDACTED:OPENAI_API_KEY]'), true);
  assert.strictEqual(containsSecretPattern(secret), true);
});

test('Redactor: Masks GitHub Personal Access Tokens', () => {
  const pat = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const text = `export GITHUB_TOKEN="${pat}"`;
  const redacted = redactSecrets(text);
  assert.strictEqual(redacted.includes(pat), false);
  assert.strictEqual(redacted.includes('[REDACTED:GITHUB_TOKEN]'), true);
});

test('Redactor: Masks AWS Access Keys and Secret Keys', () => {
  const awsKey = 'AKIAIOSFODNN7EXAMPLE';
  const text = `AWS_ACCESS_KEY_ID=${awsKey}`;
  const redacted = redactSecrets(text);
  assert.strictEqual(redacted.includes(awsKey), false);
  assert.strictEqual(redacted.includes('[REDACTED:AWS_ACCESS_KEY]'), true);
});

test('Redactor: Masks Database Connection Passwords', () => {
  const url = 'postgres://admin:SuperSecretPass123!@localhost:5432/mydb';
  const redacted = redactSecrets(url);
  assert.strictEqual(redacted.includes('SuperSecretPass123!'), false);
  assert.strictEqual(redacted.includes('admin:[REDACTED:PASSWORD]@localhost'), true);
});

test('Redactor: Truncates overly long evidence snippets', () => {
  const longText = 'A'.repeat(500);
  const formatted = formatSafeEvidence(longText);
  assert.ok(formatted && formatted.length < 350);
  assert.ok(formatted?.includes('[truncated]'));
});
