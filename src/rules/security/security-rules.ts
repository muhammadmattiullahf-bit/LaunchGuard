import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';
import { findSecretMatchInfo, formatSafeEvidence } from '../../core/redaction/redactor.ts';

export const securityEnvNotIgnoredRule: RuleDefinition = {
  id: 'security/env-not-ignored',
  candidateId: 'LG-SEC-R001',
  category: 'security',
  title: 'Environment file not covered by .gitignore',
  description: 'Unignored .env files can easily be accidentally committed to Git, leaking sensitive credentials.',
  defaultSeverity: 'high',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/security/env-not-ignored',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const envFiles = project.detectedConfigs.envFiles;
    if (envFiles.length === 0) return [];

    let gitignoreContent = '';
    if (project.detectedConfigs.gitignore) {
      gitignoreContent = (await readFile('.gitignore')) || '';
    }

    // Line-by-line gitignore pattern matching supporting leading slashes, wildcards, and comments
    const gitignoreLines = gitignoreContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    const hasEnvIgnore = gitignoreLines.some((line) => {
      // Matches: .env, /.env, .env*, /.env*, *.env, /*.env, .env.local, /.env.local, etc.
      return /^\/?(?:\*?\.env|\.env\*)/.test(line);
    });

    if (!hasEnvIgnore) {
      for (const envFile of envFiles) {
        findings.push({
          title: `Environment file "${envFile}" is not covered by .gitignore`,
          description: `The file "${envFile}" exists in the project root, but .gitignore does not contain ignore patterns covering .env files.`,
          location: { file: envFile, line: 1 },
          recommendation: 'Add `.env*` or `.env.local` to `.gitignore` to prevent committing sensitive environment variables.',
          evidenceAnchor: `env-not-ignored-${envFile}`,
        });
      }
    }

    return findings;
  },
};

export const securitySecretLeakRule: RuleDefinition = {
  id: 'security/secret-token-leak',
  candidateId: 'LG-SEC-R002',
  category: 'security',
  title: 'Secret-like value detected in source file',
  description: 'Hardcoded API keys, private keys, or tokens in source code can be extracted from public bundles or repositories.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/security/secret-token-leak',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    // Scan source files (.ts, .tsx, .js, .jsx, .json, .env.example)
    const candidates = files.filter(
      (f) =>
        (f.relativePath.endsWith('.ts') ||
          f.relativePath.endsWith('.tsx') ||
          f.relativePath.endsWith('.js') ||
          f.relativePath.endsWith('.jsx') ||
          f.relativePath.endsWith('.json') ||
          f.relativePath === '.env.example' ||
          f.relativePath === 'next.config.js' ||
          f.relativePath === 'next.config.mjs' ||
          f.relativePath === 'next.config.ts') &&
        !f.relativePath.startsWith('.env') &&
        f.relativePath !== 'package.json' &&
        f.relativePath !== 'package-lock.json' &&
        f.relativePath !== 'tsconfig.json' &&
        !f.relativePath.startsWith('tests/fixtures/')
    );

    for (const f of candidates) {
      const content = await readFile(f.relativePath, 500 * 1024); // max 500KB per file for regex
      if (!content) continue;

      const secretInfo = findSecretMatchInfo(content);
      if (secretInfo) {
        // Extract a snippet around the matched secret line
        const lines = content.split('\n');
        const matchLine = lines[secretInfo.line - 1] || '';
        const evidenceSnippet = formatSafeEvidence(matchLine.trim().slice(0, 200));

        findings.push({
          title: `Potential hardcoded secret detected in ${f.relativePath}`,
          description: 'A pattern matching an API key, private key, or credential was detected in this file.',
          location: { file: f.relativePath, line: secretInfo.line },
          recommendation: 'Store secrets in server-side environment variables and access them via process.env.',
          evidence: evidenceSnippet,
          evidenceAnchor: `secret-leak-${f.relativePath}`,
        });
      }
    }

    return findings;
  },
};

export const securityHeadersRule: RuleDefinition = {
  id: 'security/security-headers-missing',
  candidateId: 'LG-SEC-R004',
  category: 'security',
  title: 'No security headers configured in next.config',
  description: 'Security headers (Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, X-Frame-Options) protect against cross-site scripting, framing/clickjacking, and MIME confusion attacks.',
  defaultSeverity: 'medium',
  defaultConfidence: 'low',
  documentationUrl: 'https://launchguard.dev/rules/security/security-headers-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readFile }) => {
    // Note: Confidence is low because headers may be applied at CDN, hosting, or reverse proxy level (DOC-001 Section 14.2)
    if (!project.detectedConfigs.nextConfig) {
      return [
        {
          title: 'Missing next.config and security headers',
          description: 'No next.config.* was found configuring standard HTTP security response headers.',
          recommendation: 'Configure a `headers()` function in `next.config.*` to set Content-Security-Policy, X-Content-Type-Options, and Referrer-Policy.',
          evidenceAnchor: 'security-headers-missing',
          limitationsNote: 'Security headers may be supplied by edge infrastructure (CDN, reverse proxy). Absence in next.config does not guarantee absence in production.',
        },
      ];
    }

    const content = await readFile(project.detectedConfigs.nextConfig);
    if (!content) return [];

    // Strip comments before checking
    const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const hasHeadersConfig =
      /headers\s*[:(]/i.test(stripped) ||
      /async\s+headers/i.test(stripped) ||
      /Content-Security-Policy/i.test(stripped) ||
      /X-Frame-Options/i.test(stripped);

    if (!hasHeadersConfig) {
      return [
        {
          title: 'No security headers configured in next.config',
          description: 'No `headers` function or security header declarations were detected in your Next.js configuration.',
          location: { file: project.detectedConfigs.nextConfig, line: 1 },
          recommendation: 'Add standard security headers (CSP, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, X-Frame-Options: DENY) to `next.config.*`.',
          evidenceAnchor: 'security-headers-missing',
          limitationsNote: 'Security headers may be supplied by edge infrastructure (Cloudflare, Vercel, Nginx). Absence in next.config does not guarantee absence in production.',
        },
      ];
    }

    return [];
  },
};

export const securityPublicEnvLeakRule: RuleDefinition = {
  id: 'security/public-env-leak',
  candidateId: 'LG-SEC-R003',
  category: 'security',
  title: 'Secret-like identifier exposed with NEXT_PUBLIC_ prefix',
  description: 'Next.js inlines NEXT_PUBLIC_ environment variables directly into client-side JavaScript bundles visible to anyone.',
  defaultSeverity: 'high',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/security/public-env-leak',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const sensitiveTerms = [
      'SECRET',
      'PRIVATE_KEY',
      'API_KEY',
      'TOKEN',
      'PASSWORD',
      'AUTH',
      'DB_PASS',
      'CREDENTIAL',
    ];

    // Check env files and env.example
    const envCandidateFiles = [
      ...project.detectedConfigs.envFiles,
      project.detectedConfigs.envTemplate,
    ].filter(Boolean) as string[];

    for (const envFile of envCandidateFiles) {
      const content = await readFile(envFile);
      if (!content) continue;

      const lines = content.split('\n');
      for (const [idx, line] of lines.entries()) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;

        const [key] = trimmed.split('=');
        if (key && key.startsWith('NEXT_PUBLIC_')) {
          const upperKey = key.toUpperCase();
          for (const term of sensitiveTerms) {
            if (upperKey.includes(term)) {
              findings.push({
                title: `Client-exposed variable "${key}" has a sensitive identifier`,
                description: `Variables prefixed with NEXT_PUBLIC_ are bundled into client JavaScript. Naming a secret with this prefix implies intended or accidental public exposure.`,
                location: { file: envFile, line: idx + 1 },
                recommendation: `Rename this variable without the NEXT_PUBLIC_ prefix and read it exclusively in Server Components or API route handlers.`,
                evidence: `${key}=[REDACTED:SECRET]`,
                evidenceAnchor: `public-env-${key}`,
              });
              break;
            }
          }
        }
      }
    }

    return findings;
  },
};

export const securitySourceMapsRule: RuleDefinition = {
  id: 'security/source-maps-enabled',
  candidateId: 'LG-SEC-R005',
  category: 'security',
  title: 'Production browser source maps enabled in next.config',
  description: 'Enabling productionBrowserSourceMaps publishes full original source code and comments to client browsers in production.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/security/source-maps-enabled',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readFile }) => {
    if (!project.detectedConfigs.nextConfig) return [];

    const content = await readFile(project.detectedConfigs.nextConfig);
    if (!content) return [];

    if (/productionBrowserSourceMaps\s*:\s*true/i.test(content)) {
      return [
        {
          title: 'productionBrowserSourceMaps is set to true',
          description: 'Client-side source maps will be deployed, exposing original source code, internal logic, and comments.',
          location: { file: project.detectedConfigs.nextConfig, line: 1 },
          recommendation: 'Remove `productionBrowserSourceMaps: true` or set it to `false` in production builds.',
          evidence: 'productionBrowserSourceMaps: true',
          evidenceAnchor: 'source-maps-true',
        },
      ];
    }

    return [];
  },
};

export const securityPoweredByRule: RuleDefinition = {
  id: 'security/powered-by-header',
  candidateId: 'LG-SEC-R006',
  category: 'security',
  title: 'X-Powered-By header not explicitly disabled',
  description: 'The X-Powered-By header reveals that your server is running Next.js, aiding targeted technology-specific attacks.',
  defaultSeverity: 'informational',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/security/powered-by-header',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, readFile }) => {
    if (!project.detectedConfigs.nextConfig) return [];

    const content = await readFile(project.detectedConfigs.nextConfig);
    if (!content) return [];

    if (!/poweredByHeader\s*:\s*false/i.test(content)) {
      return [
        {
          title: 'poweredByHeader: false is not set in next.config',
          description: 'Next.js adds `X-Powered-By: Next.js` by default unless explicitly disabled with `poweredByHeader: false`.',
          location: { file: project.detectedConfigs.nextConfig, line: 1 },
          recommendation: 'Set `poweredByHeader: false` in your `next.config.*` object.',
          evidenceAnchor: 'powered-by-header-missing',
        },
      ];
    }

    return [];
  },
};

export const securityRules: RuleDefinition[] = [
  securityEnvNotIgnoredRule,
  securitySecretLeakRule,
  securityPublicEnvLeakRule,
  securityHeadersRule,
  securitySourceMapsRule,
  securityPoweredByRule,
];
