import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';

export const codeQualityTsConfigMissingRule: RuleDefinition = {
  id: 'code-quality/typescript-config-missing',
  candidateId: 'LG-COD-R001',
  category: 'code-quality',
  title: 'No tsconfig.json found in TypeScript project',
  description: 'TypeScript source files exist but no tsconfig.json is configured at the root.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/typescript-config-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files }) => {
    const hasTsFiles = files.some((f) => f.relativePath.endsWith('.ts') || f.relativePath.endsWith('.tsx'));
    if (hasTsFiles && !project.detectedConfigs.tsconfig) {
      return [
        {
          title: 'Missing tsconfig.json in TypeScript project',
          description: 'The project contains .ts or .tsx files, but no tsconfig.json was detected at the root.',
          recommendation: 'Add a valid `tsconfig.json` file configuring TypeScript compiler options.',
          evidenceAnchor: 'missing-tsconfig',
        },
      ];
    }
    return [];
  },
};

export const codeQualityTsStrictDisabledRule: RuleDefinition = {
  id: 'code-quality/typescript-strict-disabled',
  candidateId: 'LG-COD-R002',
  category: 'code-quality',
  title: 'TypeScript strict mode not enabled',
  description: 'Strict mode catches common type errors, undefined accesses, and null pointer issues at build time.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/typescript-strict-disabled',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readJson }) => {
    if (!project.detectedConfigs.tsconfig) return [];

    const tsconfig = await readJson<Record<string, unknown>>(project.detectedConfigs.tsconfig);
    if (!tsconfig) return [];

    const compilerOptions = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
    const strictEnabled = compilerOptions.strict === true;

    if (!strictEnabled) {
      return [
        {
          title: 'TypeScript "strict" mode is not enabled in tsconfig.json',
          description: 'Disabling strict type checking allows implicit any, nullable property access, and loose type safety.',
          location: { file: project.detectedConfigs.tsconfig, line: 1 },
          recommendation: 'Enable `"strict": true` under `compilerOptions` in `tsconfig.json`.',
          evidence: `"strict": ${compilerOptions.strict ?? 'not set'}`,
          evidenceAnchor: 'tsconfig-strict-disabled',
        },
      ];
    }

    return [];
  },
};

export const codeQualityEslintMissingRule: RuleDefinition = {
  id: 'code-quality/eslint-config-missing',
  candidateId: 'LG-COD-R003',
  category: 'code-quality',
  title: 'No ESLint configuration detected',
  description: 'ESLint enforces standard Next.js code rules, accessibility, and React Hooks conventions.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/eslint-config-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    if (!project.detectedConfigs.eslintConfig) {
      return [
        {
          title: 'Missing ESLint configuration file',
          description: 'No .eslintrc.* or eslint.config.* configuration was found at the project root.',
          recommendation: 'Create an ESLint configuration extending `next/core-web-vitals`.',
          evidenceAnchor: 'missing-eslint-config',
        },
      ];
    }
    return [];
  },
};

export const codeQualityBuildScriptMissingRule: RuleDefinition = {
  id: 'code-quality/build-script-missing',
  candidateId: 'LG-COD-R004',
  category: 'code-quality',
  title: 'No "build" script declared in package.json',
  description: 'Production hosting and CI runners require standard `npm run build` to compile the Next.js application.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/build-script-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    const scripts = (project.packageJson.scripts ?? {}) as Record<string, string>;
    if (!scripts.build) {
      return [
        {
          title: 'Missing "build" script in package.json',
          description: '`package.json` does not declare a "build" script for compiling Next.js.',
          location: { file: 'package.json', line: 1 },
          recommendation: 'Add `"build": "next build"` to `scripts` in `package.json`.',
          evidenceAnchor: 'missing-build-script',
        },
      ];
    }
    return [];
  },
};

export const codeQualityBuildErrorSuppressionRule: RuleDefinition = {
  id: 'code-quality/build-error-suppression',
  candidateId: 'LG-COD-R006',
  category: 'code-quality',
  title: 'TypeScript or ESLint errors suppressed during next build',
  description: 'Suppressing build-time errors hides serious syntax and runtime bugs from deployment blockers.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/build-error-suppression',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readFile }) => {
    if (!project.detectedConfigs.nextConfig) return [];
    const content = await readFile(project.detectedConfigs.nextConfig);
    if (!content) return [];

    const findings: RuleFindingInput[] = [];

    if (/ignoreBuildErrors\s*:\s*true/i.test(content)) {
      findings.push({
        title: 'ignoreBuildErrors is set to true in next.config',
        description: 'TypeScript compile errors will not stop production builds from succeeding, risking deployment of broken code.',
        location: { file: project.detectedConfigs.nextConfig, line: 1 },
        recommendation: 'Remove `typescript: { ignoreBuildErrors: true }` and resolve type errors before building.',
        evidence: 'ignoreBuildErrors: true',
        evidenceAnchor: 'ignore-build-errors',
      });
    }

    if (/ignoreDuringBuilds\s*:\s*true/i.test(content)) {
      findings.push({
        title: 'ignoreDuringBuilds is set to true in next.config',
        description: 'ESLint rule violations are ignored during production build.',
        location: { file: project.detectedConfigs.nextConfig, line: 1 },
        recommendation: 'Remove `eslint: { ignoreDuringBuilds: true }` and address linting warnings.',
        evidence: 'ignoreDuringBuilds: true',
        evidenceAnchor: 'ignore-during-builds',
      });
    }

    return findings;
  },
};

export const codeQualityNodeVersionMissingRule: RuleDefinition = {
  id: 'code-quality/node-version-missing',
  candidateId: 'LG-COD-R007',
  category: 'code-quality',
  title: 'No Node.js version constraint declared',
  description: 'Declaring an explicit Node.js version prevents subtle runtime divergences between local development and CI/production.',
  defaultSeverity: 'informational',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/node-version-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files }) => {
    const engines = (project.packageJson.engines ?? {}) as Record<string, string>;
    const hasEngineNode = Boolean(engines.node);
    const hasNvmrc = files.some((f) => f.relativePath === '.nvmrc' || f.relativePath === '.node-version');

    if (!hasEngineNode && !hasNvmrc) {
      return [
        {
          title: 'Missing Node.js runtime version specification',
          description: 'No `engines.node` in `package.json` or `.nvmrc`/`.node-version` file found.',
          location: { file: 'package.json', line: 1 },
          recommendation: 'Specify `"engines": { "node": ">=18.0.0" }` in `package.json` or add an `.nvmrc` file.',
          evidenceAnchor: 'missing-node-version',
        },
      ];
    }

    return [];
  },
};

export const codeQualityTestScriptMissingRule: RuleDefinition = {
  id: 'code-quality/test-script-missing',
  candidateId: 'LG-COD-R005',
  category: 'code-quality',
  title: 'No test script declared in package.json',
  description: 'Automated test suites catch functional regressions before code reaches production.',
  defaultSeverity: 'informational',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/code-quality/test-script-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    const scripts = (project.packageJson.scripts ?? {}) as Record<string, string>;
    const testScript = scripts.test?.trim();

    if (!testScript || testScript.includes('no test specified') || testScript === 'exit 1') {
      return [
        {
          title: 'Missing or placeholder "test" script in package.json',
          description: 'No functional automated test command is configured under `scripts.test` in `package.json`.',
          location: { file: 'package.json', line: 1 },
          recommendation: 'Configure an automated test runner (e.g., `"test": "node --test"` or `"test": "vitest"`).',
          evidence: testScript ? `"test": "${testScript}"` : undefined,
          evidenceAnchor: 'missing-test-script',
        },
      ];
    }
    return [];
  },
};

export const codeQualityRules: RuleDefinition[] = [
  codeQualityTsConfigMissingRule,
  codeQualityTsStrictDisabledRule,
  codeQualityEslintMissingRule,
  codeQualityBuildScriptMissingRule,
  codeQualityTestScriptMissingRule,
  codeQualityBuildErrorSuppressionRule,
  codeQualityNodeVersionMissingRule,
];
