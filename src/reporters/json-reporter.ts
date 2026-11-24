import type { ReportModel } from '../core/types.ts';

/**
 * Formats a scan report as deterministic, pretty JSON (DOC-001 LG-FR-014).
 */
export function formatJsonReport(report: ReportModel): string {
  return JSON.stringify(report, null, 2);
}
