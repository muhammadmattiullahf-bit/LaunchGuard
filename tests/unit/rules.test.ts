import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { ALL_MVP_RULES, createDefaultRegistry } from '../../src/rules/index.ts';
import { RuleRegistry, RuleRegistryError } from '../../src/core/rules/rule-registry.ts';

test('Rule Registry: All MVP rules have required metadata fields (DOC-001 LG-FR-004)', () => {
  const registry = createDefaultRegistry();
  assert.ok(registry.count() >= 15);

  for (const rule of ALL_MVP_RULES) {
    assert.ok(rule.id, 'Rule must have id');
    assert.ok(rule.candidateId.startsWith('LG-'), `Candidate ID must start with LG-: ${rule.candidateId}`);
    assert.ok(rule.title, 'Rule must have title');
    assert.ok(rule.description, 'Rule must have description');
    assert.ok(rule.defaultSeverity, 'Rule must have defaultSeverity');
    assert.ok(rule.defaultConfidence, 'Rule must have defaultConfidence');
    assert.ok(rule.documentationUrl.startsWith('https://launchguard.dev'), 'Documentation reference must be stable URL');
    assert.strictEqual(rule.releaseClass, 'mvp');
    assert.strictEqual(rule.requiresNetwork, false, 'MVP rules must never require network');
  }
});

test('Rule Documentation Check: Every registered rule has corresponding docs (LG-FR-028)', () => {
  const registry = createDefaultRegistry();
  assert.strictEqual(registry.count(), 34);
  assert.strictEqual(ALL_MVP_RULES.length, 27, 'All 27 original MVP rules must remain in ALL_MVP_RULES');

  for (const rule of registry.getAllRules()) {
    const docPath = `docs/rules/${rule.id}.md`;
    assert.strictEqual(
      fs.existsSync(docPath),
      true,
      `Rule "${rule.id}" must have documentation at "${docPath}" (DOC-001 LG-FR-028)`
    );
  }
});

test('Rule Registry: Error handling on invalid rule registration and lookup', () => {
  const reg = new RuleRegistry();

  assert.throws(() => reg.register({} as any), (err: any) => err instanceof RuleRegistryError && err.code === 'INVALID_RULE_ID');
  assert.throws(() => reg.register({ id: 'test' } as any), (err: any) => err.code === 'MISSING_CANDIDATE_ID');
  assert.throws(() => reg.register({ id: 'test', candidateId: 'LG-1' } as any), (err: any) => err.code === 'MISSING_CATEGORY');
  assert.throws(() => reg.register({ id: 'test', candidateId: 'LG-1', category: 'seo' } as any), (err: any) => err.code === 'MISSING_TITLE');
  assert.throws(() => reg.register({ id: 'test', candidateId: 'LG-1', category: 'seo', title: 'T' } as any), (err: any) => err.code === 'MISSING_DESCRIPTION');
  assert.throws(() => reg.register({ id: 'test', candidateId: 'LG-1', category: 'seo', title: 'T', description: 'D' } as any), (err: any) => err.code === 'MISSING_SEVERITY');
  assert.throws(() => reg.register({ id: 'test', candidateId: 'LG-1', category: 'seo', title: 'T', description: 'D', defaultSeverity: 'high' } as any), (err: any) => err.code === 'MISSING_CONFIDENCE');
  assert.throws(() => reg.register({ id: 'test', candidateId: 'LG-1', category: 'seo', title: 'T', description: 'D', defaultSeverity: 'high', defaultConfidence: 'high' } as any), (err: any) => err.code === 'MISSING_EXECUTE');

  const validRule = {
    id: 'test/valid',
    candidateId: 'LG-VALID',
    category: 'seo' as const,
    title: 'Valid',
    description: 'Valid rule',
    defaultSeverity: 'low' as const,
    defaultConfidence: 'high' as const,
    documentationUrl: 'https://launchguard.dev',
    releaseClass: 'mvp' as const,
    requiresNetwork: false,
    execute: () => [],
  };

  reg.register(validRule);
  assert.throws(() => reg.register(validRule), (err: any) => err.code === 'DUPLICATE_RULE_ID');

  assert.strictEqual(reg.getRule('test/valid')?.id, 'test/valid');
  assert.strictEqual(reg.getRule('non-existent'), undefined);
  assert.strictEqual(reg.getRulesByCategory('seo').length, 1);
  assert.strictEqual(reg.getRulesByCategory('security').length, 0);

  const filtered = reg.filterRules(['seo'], ['security']);
  assert.strictEqual(filtered.length, 1);
  const skipped = reg.filterRules(undefined, ['seo']);
  assert.strictEqual(skipped.length, 0);
});
