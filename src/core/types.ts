/**
 * Core type definitions for LaunchGuard (DOC-001 Section 14, 15, 20)
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type Confidence = 'high' | 'medium' | 'low';

export type RuleCategory =
  | 'seo'
  | 'security'
  | 'code-quality'
  | 'performance'
  | 'dependencies'
  | 'deployment'
  | 'routing'
  | 'structured-data';

export type ScanStatus = 'complete' | 'incomplete' | 'cancelled';

export interface FindingLocation {
  file?: string | undefined;
  line?: number | undefined;
  column?: number | undefined;
}

export interface Finding {
  id: string; // Deterministic SHA-256 fingerprint
  ruleId: string; // e.g. "seo/title-missing"
  candidateId: string; // e.g. "LG-SEO-R001"
  title: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  confidence: Confidence;
  location?: FindingLocation | undefined;
  recommendation: string;
  documentation: string;
  autofix: false; // Always false in MVP (DOC-001 C-08)
  evidence?: string | undefined; // Always redacted (LG-FR-018)
  limitationsNote?: string | undefined;
}

export interface SuppressedFinding extends Finding {
  suppressionReason: string;
}

export interface RuleFault {
  ruleId: string;
  error: string;
  durationMs?: number;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ReadinessScore {
  overall: number;
  byCategory: Partial<Record<RuleCategory, number>>;
  disclaimer: string;
  methodVersion: string;
}

export interface ReportScanMetadata {
  targetPath: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  categoriesExecuted: RuleCategory[];
  rulesExecutedCount: number;
  filesScannedCount: number;
  networkUsed: boolean;
}

export interface ReportSummary {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  suppressedCount: number;
  readinessScore: ReadinessScore;
}

export interface ReportModel {
  schemaVersion: string;
  tool: {
    name: 'launchguard';
    version: string;
  };
  status: ScanStatus;
  scan: ReportScanMetadata;
  summary: ReportSummary;
  findings: Finding[];
  suppressed: SuppressedFinding[];
  faults: RuleFault[];
  skippedFiles: SkippedFile[];
}

export interface ProjectDescriptor {
  root: string;
  isNextJs: boolean;
  routerType: 'app' | 'pages' | 'both' | 'unknown';
  hasSrc: boolean;
  packageJson: Record<string, unknown>;
  detectedConfigs: {
    tsconfig?: string;
    eslintConfig?: string;
    nextConfig?: string;
    lockfiles: string[];
    envFiles: string[];
    gitignore?: boolean;
    envTemplate?: string;
  };
  warnings: string[];
}

export interface DiscoveredFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface RuleExecutionContext {
  project: ProjectDescriptor;
  files: DiscoveredFile[];
  readFile: (relativePath: string, maxBytes?: number) => Promise<string | null>;
  readJson: <T = unknown>(relativePath: string) => Promise<T | null>;
  options: EffectiveScanOptions;
  signal?: AbortSignal;
}

export interface RuleFindingInput {
  title: string;
  description: string;
  severity?: Severity | undefined;
  confidence?: Confidence | undefined;
  location?: FindingLocation | undefined;
  recommendation: string;
  evidenceAnchor?: string | undefined; // used to compute deterministic hash
  evidence?: string | undefined;
  limitationsNote?: string | undefined;
}

export interface RuleDefinition {
  id: string; // e.g. "seo/title-missing"
  candidateId: string; // e.g. "LG-SEO-R001"
  category: RuleCategory;
  title: string;
  description: string;
  defaultSeverity: Severity;
  defaultConfidence: Confidence;
  documentationUrl: string;
  releaseClass: 'mvp' | 'post-mvp';
  requiresNetwork: boolean; // Always false for MVP
  execute: (context: RuleExecutionContext) => Promise<RuleFindingInput[]> | RuleFindingInput[];
}

export interface SuppressionRule {
  ruleId: string;
  path?: string;
  pattern?: string;
  reason: string;
}

export interface LaunchGuardConfig {
  $schema?: string;
  categories?: RuleCategory[];
  skip?: RuleCategory[];
  failOn?: Severity;
  minConfidence?: Confidence;
  rules?: Record<string, { severity?: Severity; enabled?: boolean }>;
  suppressions?: SuppressionRule[];
  limits?: {
    maxFileSize?: number;
    timeoutMs?: number;
  };
}

export interface EffectiveScanOptions {
  targetPath: string;
  categories?: RuleCategory[] | undefined;
  skip?: RuleCategory[] | undefined;
  format: 'terminal' | 'json' | 'sarif';
  output?: string | undefined;
  failOn?: Severity | undefined;
  minConfidence?: Confidence | undefined;
  config?: string | undefined;
  timeoutMs: number;
  maxFileSize: number;
  noColor: boolean;
  verbose: boolean;
  quiet: boolean;
}
