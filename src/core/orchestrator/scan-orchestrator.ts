import fs from 'node:fs';
import path from 'node:path';
import type {
  ReportModel,
  EffectiveScanOptions,
  RuleFault,
  ScanStatus,
  RuleExecutionContext,
  RuleFindingInput,
  RuleCategory,
} from '../types.ts';
import { discoverProject } from '../discovery/project-discovery.ts';
import { discoverFilesSafely, isPathContained, resolveCanonicalPath } from '../discovery/safe-file-discovery.ts';
import { loadConfig } from '../config/config-loader.ts';
import { RuleRegistry } from '../rules/rule-registry.ts';
import { FindingCollector } from '../dedup/finding-collector.ts';
import { calculateReadinessScore } from '../scoring/readiness-score.ts';

const TOOL_NAME = 'launchguard' as const;
const TOOL_VERSION = '0.1.0';
const REPORT_SCHEMA_VERSION = '1.0.0';

export interface OrchestratorRunOptions {
  options: EffectiveScanOptions;
  registry: RuleRegistry;
}

/**
 * Runs a promise with a timeout limit.
 */
function withTimeout<T>(promise: Promise<T> | T, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${label} exceeded ${timeoutMs}ms limit`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Executes a full LaunchGuard scan with strict safety, fault isolation, and deterministic reporting.
 */
export async function executeScan(runOptions: OrchestratorRunOptions): Promise<ReportModel> {
  const { options, registry } = runOptions;
  const startTime = new Date();
  const faults: RuleFault[] = [];
  let scanStatus: ScanStatus = 'complete';

  // 1. Discover target project (LG-FR-001)
  const project = await discoverProject(options.targetPath);

  // 2. Load configuration (LG-FR-006)
  const { config } = await loadConfig(project.root, options.config);

  // 3. Safe file discovery (LG-FR-005)
  const maxFileSize = options.maxFileSize || config.limits?.maxFileSize;
  const fileDiscoveryResult = await discoverFilesSafely(project.root, {
    maxFileSize,
  });

  // 4. Select rules (LG-FR-003, LG-FR-004)
  const categories = options.categories || config.categories;
  const skip = options.skip || config.skip;
  const rulesToExecute = registry.filterRules(categories, skip);

  const executedCategories = Array.from(new Set(rulesToExecute.map((r) => r.category))) as RuleCategory[];

  // 5. Initialize safe context helpers
  const canonicalRoot = project.root;

  const safeReadFile = async (relativePath: string, maxBytes?: number): Promise<string | null> => {
    const resolved = path.resolve(canonicalRoot, relativePath);
    if (!isPathContained(canonicalRoot, resolved)) {
      return null;
    }
    try {
      // Symlink escape check: ensure canonical native target is strictly contained within root (LG-SEC-003, LG-SEC-004)
      const realTarget = resolveCanonicalPath(resolved);
      if (!isPathContained(canonicalRoot, realTarget)) {
        return null;
      }

      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) {
        return null; // Skip directories, sockets, devices, FIFOs
      }

      const limit = maxBytes || maxFileSize || 10 * 1024 * 1024;
      if (stat.size > limit) {
        return null;
      }
      return await fs.promises.readFile(resolved, 'utf-8');
    } catch {
      return null;
    }
  };

  const safeReadJson = async <T = unknown>(relativePath: string): Promise<T | null> => {
    const text = await safeReadFile(relativePath);
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  };

  const ruleContext: RuleExecutionContext = {
    project,
    files: fileDiscoveryResult.files,
    readFile: safeReadFile,
    readJson: safeReadJson,
    options,
  };

  // 6. Execute rules with fault isolation & timeouts (LG-FR-017, LG-FR-020)
  const collector = new FindingCollector();
  const perRuleTimeoutMs = Math.min(options.timeoutMs, 10000);

  for (const rule of rulesToExecute) {
    const ruleStart = Date.now();
    try {
      const result: RuleFindingInput[] = await withTimeout(
        rule.execute(ruleContext),
        perRuleTimeoutMs,
        `Rule "${rule.id}"`
      );

      for (const item of result) {
        collector.addRawFinding(rule, item, config);
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - ruleStart;
      const message = err instanceof Error ? err.message : String(err);
      faults.push({
        ruleId: rule.id,
        error: message,
        durationMs,
      });
      // A failing rule does NOT abort unrelated scanning, but marks scan as incomplete (LG-FR-020)
      scanStatus = 'incomplete';
    }
  }

  // 7. Process findings: dedup, suppression, confidence filtering
  const { activeFindings, suppressedFindings } = collector.processFindings(options, config);

  // 8. Calculate readiness score (LG-FR-012)
  const readinessScore = calculateReadinessScore(activeFindings, executedCategories);

  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();

  // 9. Count severities
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };
  for (const f of activeFindings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  const report: ReportModel = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: {
      name: TOOL_NAME,
      version: TOOL_VERSION,
    },
    status: scanStatus,
    scan: {
      targetPath: options.targetPath,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      categoriesExecuted: executedCategories,
      rulesExecutedCount: rulesToExecute.length,
      filesScannedCount: fileDiscoveryResult.files.length,
      networkUsed: false, // Network is strictly 0 in MVP (LG-FR-019)
    },
    summary: {
      totalFindings: activeFindings.length,
      bySeverity,
      suppressedCount: suppressedFindings.length,
      readinessScore,
    },
    findings: activeFindings,
    suppressed: suppressedFindings,
    faults,
    skippedFiles: fileDiscoveryResult.skippedFiles,
  };

  return report;
}
