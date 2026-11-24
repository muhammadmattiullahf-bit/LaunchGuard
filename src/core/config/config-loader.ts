import fs from 'node:fs';
import path from 'node:path';
import type { LaunchGuardConfig, RuleCategory, Severity, Confidence } from '../types.ts';

export class ConfigError extends Error {
  public code: string;
  constructor(message: string, code = 'CONFIG_ERROR') {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
  }
}

export const VALID_CATEGORIES: RuleCategory[] = [
  'seo',
  'security',
  'code-quality',
  'performance',
  'dependencies',
  'deployment',
  'routing',
  'structured-data',
];

export const VALID_SEVERITIES: Severity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'informational',
];

export const VALID_CONFIDENCES: Confidence[] = ['high', 'medium', 'low'];

export const DEFAULT_CONFIG_FILENAME = '.launchguardrc.json';

const DEFAULT_CONFIG_TEMPLATE: LaunchGuardConfig = {
  $schema: 'https://launchguard.dev/schema/v1/config.json',
  categories: [
    'seo',
    'security',
    'code-quality',
    'performance',
    'dependencies',
    'deployment',
  ],
  skip: [],
  failOn: 'high',
  minConfidence: 'low',
  rules: {},
  suppressions: [],
  limits: {
    maxFileSize: 10485760, // 10MB
    timeoutMs: 60000, // 60s
  },
};

/**
 * Validates the loaded JSON object against LaunchGuard's configuration schema.
 */
export function validateConfig(raw: Record<string, unknown>, configPath = 'config'): LaunchGuardConfig {
  const allowedKeys = new Set([
    '$schema',
    'categories',
    'skip',
    'failOn',
    'minConfidence',
    'rules',
    'suppressions',
    'limits',
  ]);

  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      throw new ConfigError(
        `Unknown configuration key "${key}" in ${configPath}. Supported keys: ${Array.from(allowedKeys).join(', ')}`,
        'UNKNOWN_KEY'
      );
    }
  }

  // Validate categories
  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories)) {
      throw new ConfigError(`"categories" must be an array of strings in ${configPath}`, 'INVALID_SCHEMA');
    }
    for (const cat of raw.categories) {
      if (!VALID_CATEGORIES.includes(cat as RuleCategory)) {
        throw new ConfigError(
          `Invalid category "${cat}" in ${configPath}. Valid categories: ${VALID_CATEGORIES.join(', ')}`,
          'INVALID_CATEGORY'
        );
      }
    }
  }

  // Validate skip
  if (raw.skip !== undefined) {
    if (!Array.isArray(raw.skip)) {
      throw new ConfigError(`"skip" must be an array of strings in ${configPath}`, 'INVALID_SCHEMA');
    }
    for (const cat of raw.skip) {
      if (!VALID_CATEGORIES.includes(cat as RuleCategory)) {
        throw new ConfigError(
          `Invalid skip category "${cat}" in ${configPath}. Valid categories: ${VALID_CATEGORIES.join(', ')}`,
          'INVALID_CATEGORY'
        );
      }
    }
  }

  // Validate failOn
  if (raw.failOn !== undefined && !VALID_SEVERITIES.includes(raw.failOn as Severity)) {
    throw new ConfigError(
      `Invalid "failOn" severity "${raw.failOn}" in ${configPath}. Valid severities: ${VALID_SEVERITIES.join(', ')}`,
      'INVALID_SEVERITY'
    );
  }

  // Validate minConfidence
  if (raw.minConfidence !== undefined && !VALID_CONFIDENCES.includes(raw.minConfidence as Confidence)) {
    throw new ConfigError(
      `Invalid "minConfidence" "${raw.minConfidence}" in ${configPath}. Valid values: ${VALID_CONFIDENCES.join(', ')}`,
      'INVALID_CONFIDENCE'
    );
  }

  // Validate rules
  if (raw.rules !== undefined) {
    if (typeof raw.rules !== 'object' || raw.rules === null || Array.isArray(raw.rules)) {
      throw new ConfigError(`"rules" must be an object in ${configPath}`, 'INVALID_SCHEMA');
    }
    for (const [ruleId, ruleConf] of Object.entries(raw.rules)) {
      if (typeof ruleConf !== 'object' || ruleConf === null) {
        throw new ConfigError(`Configuration for rule "${ruleId}" must be an object in ${configPath}`, 'INVALID_SCHEMA');
      }
      const r = ruleConf as Record<string, unknown>;
      if (r.severity !== undefined && !VALID_SEVERITIES.includes(r.severity as Severity)) {
        throw new ConfigError(`Invalid severity override for rule "${ruleId}" in ${configPath}`, 'INVALID_SEVERITY');
      }
      if (r.enabled !== undefined && typeof r.enabled !== 'boolean') {
        throw new ConfigError(`"enabled" override for rule "${ruleId}" must be a boolean in ${configPath}`, 'INVALID_SCHEMA');
      }
    }
  }

  // Validate suppressions
  if (raw.suppressions !== undefined) {
    if (!Array.isArray(raw.suppressions)) {
      throw new ConfigError(`"suppressions" must be an array in ${configPath}`, 'INVALID_SCHEMA');
    }
    for (const [idx, item] of raw.suppressions.entries()) {
      if (typeof item !== 'object' || item === null) {
        throw new ConfigError(`Suppression entry at index ${idx} must be an object`, 'INVALID_SCHEMA');
      }
      if (!item.ruleId || typeof item.ruleId !== 'string') {
        throw new ConfigError(`Suppression entry at index ${idx} requires a "ruleId" string`, 'INVALID_SUPPRESSION');
      }
      if (!item.reason || typeof item.reason !== 'string' || item.reason.trim().length === 0) {
        throw new ConfigError(
          `Suppression entry for "${item.ruleId}" at index ${idx} must have a non-empty "reason" (DOC-001 LG-FR-011)`,
          'INVALID_SUPPRESSION'
        );
      }
    }
  }

  return raw as LaunchGuardConfig;
}

/**
 * Loads and validates configuration from the project root or specified config file path.
 */
export async function loadConfig(
  projectRoot: string,
  explicitConfigPath?: string
): Promise<{ config: LaunchGuardConfig; configSource?: string }> {
  let resolvedPath: string | undefined;

  if (explicitConfigPath) {
    resolvedPath = path.isAbsolute(explicitConfigPath)
      ? explicitConfigPath
      : path.join(projectRoot, explicitConfigPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new ConfigError(`Specified configuration file does not exist: "${explicitConfigPath}"`, 'CONFIG_NOT_FOUND');
    }
  } else {
    const candidates = [
      path.join(projectRoot, '.launchguardrc.json'),
      path.join(projectRoot, 'launchguard.json'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        resolvedPath = c;
        break;
      }
    }
  }

  if (!resolvedPath) {
    return { config: DEFAULT_CONFIG_TEMPLATE };
  }

  // Check file size (max 1MB)
  const stat = await fs.promises.stat(resolvedPath);
  if (stat.size > 1024 * 1024) {
    throw new ConfigError(
      `Configuration file exceeds maximum allowed size of 1MB (${stat.size} bytes)`,
      'CONFIG_OVERSIZED'
    );
  }

  let rawJson: Record<string, unknown>;
  try {
    const text = await fs.promises.readFile(resolvedPath, 'utf-8');
    rawJson = JSON.parse(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to parse configuration file "${resolvedPath}": ${message}`, 'MALFORMED_JSON');
  }

  const validated = validateConfig(rawJson, resolvedPath);
  return { config: validated, configSource: resolvedPath };
}

/**
 * Initializes a starter configuration file (DOC-001 LG-FR-007).
 */
export async function initConfig(
  targetDir: string,
  force = false
): Promise<{ filePath: string; created: boolean }> {
  const filePath = path.join(targetDir, DEFAULT_CONFIG_FILENAME);

  if (fs.existsSync(filePath) && !force) {
    throw new ConfigError(
      `Configuration file already exists at "${filePath}". Use --force to overwrite.`,
      'ALREADY_EXISTS'
    );
  }

  const content = JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2) + '\n';
  await fs.promises.writeFile(filePath, content, 'utf-8');

  return { filePath, created: true };
}
