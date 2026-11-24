import type { ReportModel, Severity } from '../core/types.ts';

// ANSI escape helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Strips ANSI escape codes and dangerous control characters to prevent terminal injection (LG-SEC-016).
 */
export function sanitizeTerminalString(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

function formatSeverityTag(severity: Severity, noColor: boolean): string {
  const upper = severity.toUpperCase().padEnd(13, ' ');
  if (noColor) return `[${upper.trim()}]`;

  switch (severity) {
    case 'critical':
      return `${colors.bold}${colors.red}[CRITICAL]${colors.reset}     `;
    case 'high':
      return `${colors.bold}${colors.red}[HIGH]${colors.reset}         `;
    case 'medium':
      return `${colors.bold}${colors.yellow}[MEDIUM]${colors.reset}       `;
    case 'low':
      return `${colors.cyan}[LOW]${colors.reset}          `;
    case 'informational':
      return `${colors.gray}[INFO]${colors.reset}         `;
  }
}

export function formatTerminalReport(report: ReportModel, noColor = false): string {
  const c = noColor
    ? {
        reset: '',
        bold: '',
        dim: '',
        red: '',
        green: '',
        yellow: '',
        blue: '',
        magenta: '',
        cyan: '',
        white: '',
        gray: '',
      }
    : colors;

  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${c.bold}LaunchGuard${c.reset} v${report.tool.version} — Next.js Production-Readiness Audit`);
  lines.push(`${c.dim}Target: ${report.scan.targetPath} | Scanned ${report.scan.filesScannedCount} files across ${report.scan.rulesExecutedCount} rules (${report.scan.durationMs}ms)${c.reset}`);
  lines.push('─'.repeat(78));

  // Status notice if incomplete or cancelled
  if (report.status !== 'complete') {
    lines.push('');
    lines.push(`${c.bold}${c.yellow}⚠ NOTICE: Scan finished with status "${report.status.toUpperCase()}".${c.reset}`);
    if (report.faults.length > 0) {
      lines.push(`${c.yellow}  Faults encountered in ${report.faults.length} rule(s):${c.reset}`);
      for (const fault of report.faults) {
        lines.push(`   - ${fault.ruleId}: ${fault.error}`);
      }
    }
  }

  // Findings list
  if (report.findings.length === 0) {
    lines.push('');
    lines.push(`${c.bold}${c.green}✔ No production-readiness issues detected.${c.reset}`);
  } else {
    lines.push('');
    lines.push(`${c.bold}FINDINGS (${report.findings.length}):${c.reset}`);
    lines.push('');

    for (const f of report.findings) {
      const tag = formatSeverityTag(f.severity, noColor);
      const safeFile = sanitizeTerminalString(f.location?.file);
      const loc = safeFile
        ? `${safeFile}${f.location?.line ? `:${f.location.line}` : ''}`
        : 'Project Configuration';

      const safeTitle = sanitizeTerminalString(f.title);
      const safeDesc = sanitizeTerminalString(f.description);
      const safeRec = sanitizeTerminalString(f.recommendation);
      const safeEv = sanitizeTerminalString(f.evidence);

      lines.push(`${tag} ${c.bold}${safeTitle}${c.reset}`);
      lines.push(`  ${c.dim}Rule:${c.reset} ${f.ruleId} (${f.candidateId}) | ${c.dim}Category:${c.reset} ${f.category} | ${c.dim}Confidence:${c.reset} ${f.confidence}`);
      lines.push(`  ${c.dim}Location:${c.reset} ${loc}`);
      lines.push(`  ${c.dim}Why it matters:${c.reset} ${safeDesc}`);
      lines.push(`  ${c.green}Fix:${c.reset} ${safeRec}`);
      if (safeEv) {
        lines.push(`  ${c.dim}Evidence:${c.reset} ${safeEv}`);
      }
      lines.push(`  ${c.dim}Docs:${c.reset} ${f.documentation}`);
      lines.push('');
    }
  }

  // Suppressed summary
  if (report.suppressed.length > 0) {
    lines.push('─'.repeat(78));
    lines.push(`${c.dim}Suppressed Findings (${report.suppressed.length}):${c.reset}`);
    for (const s of report.suppressed) {
      const safeLoc = sanitizeTerminalString(s.location?.file || 'project');
      const safeReason = sanitizeTerminalString(s.suppressionReason);
      lines.push(`  - [${s.ruleId}] ${safeLoc} — Reason: "${safeReason}"`);
    }
    lines.push('');
  }

  // Summary & Score
  lines.push('═'.repeat(78));
  lines.push(`${c.bold}SUMMARY & READINESS SCORE${c.reset}`);
  lines.push(`Findings by Severity: Critical: ${report.summary.bySeverity.critical} | High: ${report.summary.bySeverity.high} | Medium: ${report.summary.bySeverity.medium} | Low: ${report.summary.bySeverity.low} | Info: ${report.summary.bySeverity.informational}`);

  const score = report.summary.readinessScore;
  const scoreColor = score.overall >= 85 ? c.green : score.overall >= 60 ? c.yellow : c.red;
  lines.push(`Readiness Score: ${c.bold}${scoreColor}${score.overall} / 100${c.reset}`);

  if (Object.keys(score.byCategory).length > 0) {
    const catScores = Object.entries(score.byCategory)
      .map(([cat, val]) => `${cat}: ${val}`)
      .join(' | ');
    lines.push(`Category Breakdown: ${catScores}`);
  }

  lines.push('');
  lines.push(`${c.dim}Disclaimer: ${score.disclaimer}${c.reset}`);
  lines.push('═'.repeat(78));

  return lines.join('\n');
}
