import type { ReportModel, Severity } from '../core/types.ts';
import { redactSecrets } from '../core/redaction/redactor.ts';

/**
 * Maps LaunchGuard severities to SARIF level values (DOC-001 Section 20.3).
 */
function mapSeverityToSarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'informational':
      return 'note';
  }
}

/**
 * Generates an OASIS SARIF v2.1.0 JSON document from the LaunchGuard report model (LG-FR-015).
 */
export function formatSarifReport(report: ReportModel): string {
  // Collect unique rules for the driver
  const ruleMap = new Map<
    string,
    {
      id: string;
      name: string;
      shortDescription: { text: string };
      helpUri: string;
      defaultConfiguration: { level: 'error' | 'warning' | 'note' };
    }
  >();

  for (const f of report.findings) {
    if (!ruleMap.has(f.ruleId)) {
      ruleMap.set(f.ruleId, {
        id: f.ruleId,
        name: f.candidateId,
        shortDescription: { text: redactSecrets(f.title) },
        helpUri: f.documentation,
        defaultConfiguration: {
          level: mapSeverityToSarifLevel(f.severity),
        },
      });
    }
  }

  // Convert findings to SARIF results
  const results = report.findings.map((f) => {
    const sarifLevel = mapSeverityToSarifLevel(f.severity);

    const result: Record<string, unknown> = {
      ruleId: f.ruleId,
      level: sarifLevel,
      message: {
        text: redactSecrets(`${f.title}\n\nWhy it matters: ${f.description}\n\nFix: ${f.recommendation}`),
      },
      partialFingerprints: {
        launchguardFingerprint: f.id,
      },
    };

    if (f.location?.file) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: {
              uri: f.location.file.replace(/\\/g, '/'),
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: f.location.line ?? 1,
              startColumn: f.location.column ?? 1,
              ...(f.evidence ? { snippet: { text: redactSecrets(f.evidence) } } : {}),
            },
          },
        },
      ];
    }

    return result;
  });

  const sarifDoc = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: report.tool.name,
            version: report.tool.version,
            informationUri: 'https://launchguard.dev',
            rules: Array.from(ruleMap.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarifDoc, null, 2);
}
