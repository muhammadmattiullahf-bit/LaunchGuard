import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';

export const deploymentEnvTemplateMissingRule: RuleDefinition = {
  id: 'deployment/env-template-missing',
  candidateId: 'LG-DPL-R001',
  category: 'deployment',
  title: 'No environment variable template file found',
  description: 'Team members and deployment systems need a documented .env.example template to configure necessary environment variables.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/deployment/env-template-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    const hasEnvFiles = project.detectedConfigs.envFiles.length > 0;
    const hasTemplate = Boolean(project.detectedConfigs.envTemplate);

    if (hasEnvFiles && !hasTemplate) {
      return [
        {
          title: 'Missing .env.example or environment variable template',
          description: 'The project contains local environment files, but no .env.example or .env.template file documents the expected keys.',
          recommendation: 'Create a `.env.example` file listing all required environment keys with placeholder values.',
          evidenceAnchor: 'missing-env-template',
        },
      ];
    }

    return [];
  },
};

export const deploymentStartScriptMissingRule: RuleDefinition = {
  id: 'deployment/start-script-missing',
  candidateId: 'LG-DPL-R003',
  category: 'deployment',
  title: 'No "start" script declared in package.json',
  description: 'Production Node servers need `npm start` (which runs `next start`) to launch the compiled application.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/deployment/start-script-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    const scripts = (project.packageJson.scripts ?? {}) as Record<string, string>;
    if (!scripts.start) {
      return [
        {
          title: 'Missing "start" script in package.json',
          description: '`package.json` does not declare a "start" script for running the production server.',
          location: { file: 'package.json', line: 1 },
          recommendation: 'Add `"start": "next start"` to `scripts` in `package.json`.',
          evidenceAnchor: 'missing-start-script',
        },
      ];
    }
    return [];
  },
};

export const deploymentUntrackedEnvRule: RuleDefinition = {
  id: 'deployment/env-var-untracked',
  candidateId: 'LG-DPL-R002',
  category: 'deployment',
  title: 'Environment variable referenced in code but absent from template',
  description: 'Environment variables accessed in source code must be documented in .env.example so deployments and team members know they are required.',
  defaultSeverity: 'low',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/deployment/env-var-untracked',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const templateName = project.detectedConfigs.envTemplate;
    if (!templateName) return [];

    const templateContent = await readFile(templateName);
    if (templateContent === null) return [];

    // Parse keys documented in template
    const documentedKeys = new Set<string>();
    for (const line of templateContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key] = trimmed.split('=');
        if (key) documentedKeys.add(key.trim());
      }
    }

    // Standard built-in variables to ignore
    const ignoredKeys = new Set(['NODE_ENV', 'PORT', 'HOSTNAME', 'TZ']);

    // Check source files for process.env.<KEY>
    const codeFiles = files.filter(
      (f) =>
        (f.relativePath.endsWith('.ts') ||
          f.relativePath.endsWith('.tsx') ||
          f.relativePath.endsWith('.js') ||
          f.relativePath.endsWith('.jsx')) &&
        !f.relativePath.startsWith('node_modules')
    );

    const reportedKeys = new Set<string>();

    for (const f of codeFiles) {
      const content = await readFile(f.relativePath, 200 * 1024);
      if (!content) continue;

      const regex = /process\.env\.([A-Z0-9_]+)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const envKey = match[1];
        if (envKey && !ignoredKeys.has(envKey) && !documentedKeys.has(envKey) && !reportedKeys.has(envKey)) {
          reportedKeys.add(envKey);
          findings.push({
            title: `Environment variable "${envKey}" is referenced in code but not documented in ${templateName}`,
            description: `Source file "${f.relativePath}" references \`process.env.${envKey}\`, but this variable is missing from the template file "${templateName}".`,
            location: { file: f.relativePath, line: content.slice(0, match.index).split('\n').length },
            recommendation: `Add \`${envKey}=\` to \`${templateName}\` with an explanatory placeholder.`,
            evidenceAnchor: `untracked-env-${envKey}`,
            limitationsNote: 'Pattern-based extraction identifies statically referenced process.env keys only.',
          });
        }
      }
    }

    return findings;
  },
};

export const deploymentRules: RuleDefinition[] = [
  deploymentEnvTemplateMissingRule,
  deploymentUntrackedEnvRule,
  deploymentStartScriptMissingRule,
];
