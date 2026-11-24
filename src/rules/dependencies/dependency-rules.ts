import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';

export const dependencyLockfileMissingRule: RuleDefinition = {
  id: 'dependencies/lockfile-missing',
  candidateId: 'LG-DEP-R001',
  category: 'dependencies',
  title: 'No lockfile detected in project root',
  description: 'Missing lockfiles result in non-deterministic dependency resolution across builds, risking supply-chain drift.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/dependencies/lockfile-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    if (project.detectedConfigs.lockfiles.length === 0) {
      return [
        {
          title: 'Missing package lockfile',
          description: 'No package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lockb was detected. Deployments may install different transitive package versions over time.',
          recommendation: 'Generate and commit a lockfile using your chosen package manager (`npm install`, `pnpm install`, or `yarn install`).',
          evidenceAnchor: 'missing-lockfile',
        },
      ];
    }
    return [];
  },
};

export const dependencyMultipleLockfilesRule: RuleDefinition = {
  id: 'dependencies/multiple-lockfiles',
  candidateId: 'LG-DEP-R002',
  category: 'dependencies',
  title: 'Multiple conflicting lockfiles detected',
  description: 'Having multiple lockfiles (e.g. package-lock.json and yarn.lock) causes confusion on CI systems and unpredictable dependency installation.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/dependencies/multiple-lockfiles',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    const lockfiles = project.detectedConfigs.lockfiles;
    if (lockfiles.length > 1) {
      return [
        {
          title: `Conflicting lockfiles found: ${lockfiles.join(', ')}`,
          description: `Multiple lockfiles (${lockfiles.join(', ')}) exist in the repository root. Different CI/CD runners or developers may use conflicting package managers.`,
          recommendation: `Choose one primary package manager for your team and delete the unused lockfiles.`,
          evidence: lockfiles.join(', '),
          evidenceAnchor: 'multiple-lockfiles',
        },
      ];
    }
    return [];
  },
};

export const dependencyWildcardRangeRule: RuleDefinition = {
  id: 'dependencies/wildcard-version-range',
  candidateId: 'LG-DEP-R003',
  category: 'dependencies',
  title: 'Wildcard or latest dependency range declared',
  description: 'Using `*` or `latest` allows unpinned upstream dependency versions to break builds or introduce security vulnerabilities without warning.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/dependencies/wildcard-version-range',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project }) => {
    const findings: RuleFindingInput[] = [];

    const checkDeps = (section: string, deps: Record<string, string> = {}) => {
      for (const [pkg, version] of Object.entries(deps)) {
        if (version === '*' || version === 'latest' || version === '') {
          findings.push({
            title: `Wildcard version range used for "${pkg}" in ${section}`,
            description: `Package "${pkg}" specifies version "${version}". This allows any release, including breaking or compromised versions, to be installed automatically.`,
            location: { file: 'package.json', line: 1 },
            recommendation: `Pin "${pkg}" to a specific semantic version range (e.g. ^1.2.3 or 1.2.3).`,
            evidence: `"${pkg}": "${version}"`,
            evidenceAnchor: `wildcard-${pkg}`,
          });
        }
      }
    };

    checkDeps('dependencies', (project.packageJson.dependencies ?? {}) as Record<string, string>);
    checkDeps('devDependencies', (project.packageJson.devDependencies ?? {}) as Record<string, string>);

    return findings;
  },
};

export const dependencyRules: RuleDefinition[] = [
  dependencyLockfileMissingRule,
  dependencyMultipleLockfilesRule,
  dependencyWildcardRangeRule,
];
