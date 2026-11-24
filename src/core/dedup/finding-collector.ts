import crypto from 'node:crypto';
import type {
  Finding,
  SuppressedFinding,
  RuleFindingInput,
  RuleDefinition,
  EffectiveScanOptions,
  LaunchGuardConfig,
  Severity,
  Confidence,
} from '../types.ts';
import { formatSafeEvidence, redactSecrets } from '../redaction/redactor.ts';

const CONFIDENCE_LEVELS: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_LEVELS: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

/**
 * Computes deterministic SHA-256 fingerprint for a finding.
 * Excludes volatile line numbers to maintain stable identity across code edits (DOC-001 Section 20.5).
 */
export function computeFindingFingerprint(
  ruleId: string,
  filePath: string | undefined,
  evidenceAnchor: string | undefined
): string {
  const normPath = filePath ? filePath.replace(/\\/g, '/').toLowerCase() : 'project';
  const normAnchor = evidenceAnchor ? redactSecrets(evidenceAnchor.trim()) : '';
  const hash = crypto.createHash('sha256');
  hash.update(`${ruleId}::${normPath}::${normAnchor}`);
  return hash.digest('hex').substring(0, 16);
}

export function isSeverityAtOrAbove(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_LEVELS[severity] >= SEVERITY_LEVELS[threshold];
}

export function isConfidenceAtOrAbove(confidence: Confidence, minConfidence: Confidence): boolean {
  return CONFIDENCE_LEVELS[confidence] >= CONFIDENCE_LEVELS[minConfidence];
}

export interface CollectionResult {
  activeFindings: Finding[];
  suppressedFindings: SuppressedFinding[];
}

export class FindingCollector {
  private readonly rawFindings = new Map<string, Finding>();

  public addRawFinding(
    rule: RuleDefinition,
    input: RuleFindingInput,
    config?: LaunchGuardConfig
  ): void {
    const rawSeverity = (config?.rules?.[rule.id]?.severity as Severity) ||
      input.severity ||
      rule.defaultSeverity;

    const rawConfidence = input.confidence || rule.defaultConfidence;

    const filePath = input.location?.file?.replace(/\\/g, '/');
    const fingerprint = computeFindingFingerprint(rule.id, filePath, input.evidenceAnchor);

    const safeEvidence = formatSafeEvidence(input.evidence);

    const finding: Finding = {
      id: fingerprint,
      ruleId: rule.id,
      candidateId: rule.candidateId,
      title: redactSecrets(input.title),
      description: redactSecrets(input.description),
      severity: rawSeverity,
      category: rule.category,
      confidence: rawConfidence,
      location: input.location
        ? {
            file: filePath,
            line: input.location.line,
            column: input.location.column,
          }
        : undefined,
      recommendation: redactSecrets(input.recommendation),
      documentation: rule.documentationUrl,
      autofix: false,
      evidence: safeEvidence,
      limitationsNote: input.limitationsNote ? redactSecrets(input.limitationsNote) : undefined,
    };

    // Deduplication: if fingerprint already exists, keep it without duplication
    if (!this.rawFindings.has(fingerprint)) {
      this.rawFindings.set(fingerprint, finding);
    }
  }

  public processFindings(
    options: EffectiveScanOptions,
    config?: LaunchGuardConfig
  ): CollectionResult {
    const activeFindings: Finding[] = [];
    const suppressedFindings: SuppressedFinding[] = [];

    const suppressions = config?.suppressions ?? [];
    const minConfidence = options.minConfidence ?? config?.minConfidence ?? 'low';

    for (const finding of this.rawFindings.values()) {
      // 1. Check confidence filter
      if (!isConfidenceAtOrAbove(finding.confidence, minConfidence)) {
        continue;
      }

      // 2. Check rule enabled state in config
      if (config?.rules?.[finding.ruleId]?.enabled === false) {
        continue;
      }

      // 3. Check suppressions
      let suppressionMatch: string | null = null;
      for (const s of suppressions) {
        if (s.ruleId === finding.ruleId) {
          if (!s.path && !s.pattern) {
            suppressionMatch = s.reason;
            break;
          }
          if (s.path && finding.location?.file === s.path) {
            suppressionMatch = s.reason;
            break;
          }
          if (s.pattern && finding.location?.file && new RegExp(s.pattern).test(finding.location.file)) {
            suppressionMatch = s.reason;
            break;
          }
        }
      }

      if (suppressionMatch) {
        suppressedFindings.push({
          ...finding,
          suppressionReason: suppressionMatch,
        });
      } else {
        activeFindings.push(finding);
      }
    }

    // Deterministic sorting: severity desc, category asc, file asc, line asc, id asc
    const sortFn = (a: Finding, b: Finding) => {
      const sevDiff = SEVERITY_LEVELS[b.severity] - SEVERITY_LEVELS[a.severity];
      if (sevDiff !== 0) return sevDiff;
      const catDiff = a.category.localeCompare(b.category);
      if (catDiff !== 0) return catDiff;
      const fileA = a.location?.file ?? '';
      const fileB = b.location?.file ?? '';
      const fileDiff = fileA.localeCompare(fileB);
      if (fileDiff !== 0) return fileDiff;
      const lineA = a.location?.line ?? 0;
      const lineB = b.location?.line ?? 0;
      if (lineA !== lineB) return lineA - lineB;
      return a.id.localeCompare(b.id);
    };

    activeFindings.sort(sortFn);
    suppressedFindings.sort(sortFn);

    return { activeFindings, suppressedFindings };
  }
}
