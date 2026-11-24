import fs from 'node:fs';
import path from 'node:path';
import type { DiscoveredFile, SkippedFile } from '../types.ts';

export interface FileDiscoveryOptions {
  maxFileSize?: number | undefined; // bytes, default 10MB
  maxFileCount?: number | undefined; // default 10,000
  maxDepth?: number | undefined; // default 30
  skipDirectories?: string[] | undefined;
}

export interface FileDiscoveryResult {
  files: DiscoveredFile[];
  skippedFiles: SkippedFile[];
}

const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
  'coverage',
  '.idea',
  '.vscode',
]);

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILE_COUNT = 10000;
const DEFAULT_MAX_DEPTH = 30;

/**
 * Normalizes filesystem path separators to forward slashes.
 */
export function normalizeRelativePath(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Resolves the canonical, native long path of a file or directory (handles Windows 8.3 short names).
 */
export function resolveCanonicalPath(p: string): string {
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p);
  } catch {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  }
}

/**
 * Checks whether targetPath is strictly contained within canonicalRoot.
 */
export function isPathContained(canonicalRoot: string, targetPath: string): boolean {
  const normRoot = path.resolve(canonicalRoot);
  const normTarget = path.resolve(targetPath);
  const relative = path.relative(normRoot, normTarget);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Enumerates project files safely according to DOC-001 LG-FR-005 & LG-SEC-003.
 * Prevents traversal, symlink escapes, infinite recursion, and bounded resource limits.
 */
export async function discoverFilesSafely(
  projectRoot: string,
  options: FileDiscoveryOptions = {}
): Promise<FileDiscoveryResult> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const maxFileCount = options.maxFileCount ?? DEFAULT_MAX_FILE_COUNT;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const skipDirs = new Set([
    ...DEFAULT_SKIP_DIRS,
    ...(options.skipDirectories ?? []),
  ]);

  const files: DiscoveredFile[] = [];
  const skippedFiles: SkippedFile[] = [];
  const visitedRealPaths = new Set<string>();

  // Resolve canonical root
  let canonicalRoot: string;
  try {
    canonicalRoot = resolveCanonicalPath(projectRoot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to resolve canonical project root: ${message}`);
  }

  visitedRealPaths.add(canonicalRoot);

  async function walk(currentDir: string, currentDepth: number): Promise<void> {
    if (currentDepth > maxDepth) {
      skippedFiles.push({
        path: normalizeRelativePath(path.relative(canonicalRoot, currentDir)),
        reason: `Exceeded maximum directory depth limit (${maxDepth})`,
      });
      return;
    }

    if (files.length >= maxFileCount) {
      skippedFiles.push({
        path: normalizeRelativePath(path.relative(canonicalRoot, currentDir)),
        reason: `Exceeded maximum file count limit (${maxFileCount})`,
      });
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      skippedFiles.push({
        path: normalizeRelativePath(path.relative(canonicalRoot, currentDir)),
        reason: `Unreadable directory: ${message}`,
      });
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFileCount) break;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = normalizeRelativePath(path.relative(canonicalRoot, fullPath));

      if (entry.isSymbolicLink()) {
        try {
          const resolvedPath = fs.realpathSync(fullPath);
          // Symlink escaping root?
          if (!isPathContained(canonicalRoot, resolvedPath) && resolvedPath !== canonicalRoot) {
            skippedFiles.push({
              path: relPath,
              reason: 'Symlink points outside canonical project root',
            });
            continue;
          }
          // Cyclic symlink protection
          if (visitedRealPaths.has(resolvedPath)) {
            skippedFiles.push({
              path: relPath,
              reason: 'Circular symlink detected',
            });
            continue;
          }

          const stat = await fs.promises.stat(resolvedPath);
          if (stat.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            visitedRealPaths.add(resolvedPath);
            await walk(resolvedPath, currentDepth + 1);
          } else if (stat.isFile()) {
            if (stat.size > maxFileSize) {
              skippedFiles.push({
                path: relPath,
                reason: `File size (${stat.size} bytes) exceeds limit (${maxFileSize} bytes)`,
              });
              continue;
            }
            files.push({
              relativePath: relPath,
              absolutePath: fullPath,
              sizeBytes: stat.size,
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          skippedFiles.push({
            path: relPath,
            reason: `Broken or unresolvable symlink: ${message}`,
          });
        }
        continue;
      }

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) {
          continue;
        }
        try {
          const realDirPath = fs.realpathSync(fullPath);
          if (visitedRealPaths.has(realDirPath)) {
            continue;
          }
          visitedRealPaths.add(realDirPath);
        } catch {
          // ignore realpath errors on directory
        }
        await walk(fullPath, currentDepth + 1);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.size > maxFileSize) {
            skippedFiles.push({
              path: relPath,
              reason: `File size (${stat.size} bytes) exceeds limit (${maxFileSize} bytes)`,
            });
            continue;
          }
          files.push({
            relativePath: relPath,
            absolutePath: fullPath,
            sizeBytes: stat.size,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          skippedFiles.push({
            path: relPath,
            reason: `Unreadable file: ${message}`,
          });
        }
      } else {
        // Special files: sockets, FIFOs, character/block devices (LG-FR-005, LG-SEC-006)
        skippedFiles.push({
          path: relPath,
          reason: 'Skipped non-regular special file (device, socket, or FIFO)',
        });
      }
    }
  }

  await walk(canonicalRoot, 0);

  // Deterministic sorting by relative path
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  skippedFiles.sort((a, b) => a.path.localeCompare(b.path));

  return { files, skippedFiles };
}
