import fs from 'node:fs';
import path from 'node:path';
import type { ProjectDescriptor } from '../types.ts';
import { resolveCanonicalPath } from './safe-file-discovery.ts';

export class ProjectDiscoveryError extends Error {
  public code: string;
  constructor(message: string, code = 'PROJECT_DISCOVERY_ERROR') {
    super(message);
    this.name = 'ProjectDiscoveryError';
    this.code = code;
  }
}

/**
 * Discovers and validates a Next.js project at the given path (DOC-001 LG-FR-001).
 * Never navigates upward beyond targetPath.
 */
export async function discoverProject(targetPath: string): Promise<ProjectDescriptor> {
  const absolutePath = path.resolve(targetPath);

  // Check target path existence
  let canonicalRoot: string;
  try {
    if (!fs.existsSync(absolutePath)) {
      throw new ProjectDiscoveryError(
        `Target path does not exist or cannot be accessed: "${targetPath}"`,
        'INVALID_PATH'
      );
    }
    canonicalRoot = resolveCanonicalPath(absolutePath);
    const stat = await fs.promises.stat(canonicalRoot);
    if (!stat.isDirectory()) {
      throw new ProjectDiscoveryError(
        `Target path is not a directory: "${targetPath}"`,
        'NOT_A_DIRECTORY'
      );
    }
  } catch (err: unknown) {
    if (err instanceof ProjectDiscoveryError) {
      throw err;
    }
    throw new ProjectDiscoveryError(
      `Target path does not exist or cannot be accessed: "${targetPath}"`,
      'INVALID_PATH'
    );
  }

  // 1. Must have package.json at root
  const packageJsonPath = path.join(canonicalRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new ProjectDiscoveryError(
      `No package.json found at project root: "${canonicalRoot}". LaunchGuard audits Next.js projects requiring a root package.json.`,
      'MISSING_PACKAGE_JSON'
    );
  }

  // Prevent resource exhaustion via oversized package.json (LG-SEC-006)
  const pkgStat = await fs.promises.stat(packageJsonPath);
  if (pkgStat.size > 5 * 1024 * 1024) {
    throw new ProjectDiscoveryError(
      `package.json exceeds maximum allowed size of 5MB (${pkgStat.size} bytes)`,
      'OVERSIZED_PACKAGE_JSON'
    );
  }

  let packageJson: Record<string, unknown>;
  try {
    const raw = await fs.promises.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(raw);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProjectDiscoveryError(
      `Failed to parse package.json as valid JSON: ${message}`,
      'MALFORMED_PACKAGE_JSON'
    );
  }

  // 2. Validate Next.js dependency declaration
  const deps = (packageJson.dependencies ?? {}) as Record<string, string>;
  const devDeps = (packageJson.devDependencies ?? {}) as Record<string, string>;
  const isNextJs = Boolean(deps['next'] || devDeps['next']);

  if (!isNextJs) {
    throw new ProjectDiscoveryError(
      `Target project does not declare Next.js ("next") in dependencies or devDependencies. LaunchGuard MVP supports Next.js projects only.`,
      'NOT_NEXTJS_PROJECT'
    );
  }

  // 3. Detect src/ layout directory
  const hasSrc = fs.existsSync(path.join(canonicalRoot, 'src')) &&
    fs.statSync(path.join(canonicalRoot, 'src')).isDirectory();

  // 4. Detect Router Type
  const hasAppRouter =
    fs.existsSync(path.join(canonicalRoot, 'app')) ||
    (hasSrc && fs.existsSync(path.join(canonicalRoot, 'src', 'app')));

  const hasPagesRouter =
    fs.existsSync(path.join(canonicalRoot, 'pages')) ||
    (hasSrc && fs.existsSync(path.join(canonicalRoot, 'src', 'pages')));

  let routerType: 'app' | 'pages' | 'both' | 'unknown' = 'unknown';
  if (hasAppRouter && hasPagesRouter) {
    routerType = 'both';
  } else if (hasAppRouter) {
    routerType = 'app';
  } else if (hasPagesRouter) {
    routerType = 'pages';
  }

  // 5. Detect configuration files
  const detectedConfigs: ProjectDescriptor['detectedConfigs'] = {
    lockfiles: [],
    envFiles: [],
  };

  const warnings: string[] = [];

  // Next config candidates
  const nextConfigCandidates = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'next.config.cjs',
  ];
  for (const candidate of nextConfigCandidates) {
    if (fs.existsSync(path.join(canonicalRoot, candidate))) {
      detectedConfigs.nextConfig = candidate;
      break;
    }
  }

  // TypeScript config
  const tsConfigCandidates = ['tsconfig.json', 'tsconfig.base.json'];
  for (const candidate of tsConfigCandidates) {
    if (fs.existsSync(path.join(canonicalRoot, candidate))) {
      detectedConfigs.tsconfig = candidate;
      break;
    }
  }

  // ESLint config
  const eslintCandidates = [
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintrc',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.ts',
  ];
  for (const candidate of eslintCandidates) {
    if (fs.existsSync(path.join(canonicalRoot, candidate))) {
      detectedConfigs.eslintConfig = candidate;
      break;
    }
  }

  // Lockfiles
  const lockfileCandidates = [
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
  ];
  for (const candidate of lockfileCandidates) {
    if (fs.existsSync(path.join(canonicalRoot, candidate))) {
      detectedConfigs.lockfiles.push(candidate);
    }
  }

  // Env files
  try {
    const rootFiles = await fs.promises.readdir(canonicalRoot);
    for (const f of rootFiles) {
      if (f.startsWith('.env') && f !== '.env.example' && f !== '.env.template' && f !== '.env.sample') {
        detectedConfigs.envFiles.push(f);
      }
      if (f === '.env.example' || f === '.env.template' || f === '.env.sample') {
        detectedConfigs.envTemplate = f;
      }
    }
  } catch {
    // Non-fatal
  }

  // .gitignore presence
  detectedConfigs.gitignore = fs.existsSync(path.join(canonicalRoot, '.gitignore'));

  return {
    root: canonicalRoot,
    isNextJs,
    routerType,
    hasSrc,
    packageJson,
    detectedConfigs,
    warnings,
  };
}
