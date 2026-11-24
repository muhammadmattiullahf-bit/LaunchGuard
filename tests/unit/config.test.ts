import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadConfig,
  validateConfig,
  initConfig,
  ConfigError,
} from '../../src/core/config/config-loader.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('Config: Rejects unknown top-level keys', () => {
  assert.throws(
    () => validateConfig({ unknownOption: true }),
    (err: unknown) => {
      assert.ok(err instanceof ConfigError);
      assert.strictEqual(err.code, 'UNKNOWN_KEY');
      return true;
    }
  );
});

test('Config: Rejects invalid category name', () => {
  assert.throws(
    () => validateConfig({ categories: ['invalid-cat'] }),
    (err: unknown) => {
      assert.ok(err instanceof ConfigError);
      assert.strictEqual(err.code, 'INVALID_CATEGORY');
      return true;
    }
  );
});

test('Config: Rejects suppression without reason (DOC-001 LG-FR-011)', () => {
  assert.throws(
    () => validateConfig({ suppressions: [{ ruleId: 'seo/title-missing', reason: '' }] }),
    (err: unknown) => {
      assert.ok(err instanceof ConfigError);
      assert.strictEqual(err.code, 'INVALID_SUPPRESSION');
      return true;
    }
  );
});

test('Config: initConfig creates file and refuses overwrite without --force', async () => {
  const tempDir = createTempDir('lg-cfg-init-');
  try {
    const res1 = await initConfig(tempDir);
    assert.strictEqual(res1.created, true);
    assert.strictEqual(fs.existsSync(res1.filePath), true);

    // Re-run without force should fail
    await assert.rejects(
      async () => await initConfig(tempDir, false),
      (err: unknown) => {
        assert.ok(err instanceof ConfigError);
        assert.strictEqual(err.code, 'ALREADY_EXISTS');
        return true;
      }
    );

    // Re-run with force succeeds
    const res2 = await initConfig(tempDir, true);
    assert.strictEqual(res2.created, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Config: loadConfig loads valid config from .launchguardrc.json', async () => {
  const tempDir = createTempDir('lg-cfg-load-');
  try {
    fs.writeFileSync(
      path.join(tempDir, '.launchguardrc.json'),
      JSON.stringify({ failOn: 'critical', minConfidence: 'high' })
    );

    const { config, configSource } = await loadConfig(tempDir);
    assert.strictEqual(config.failOn, 'critical');
    assert.strictEqual(config.minConfidence, 'high');
    assert.ok(configSource?.endsWith('.launchguardrc.json'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
