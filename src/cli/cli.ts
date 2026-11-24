import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type {
  EffectiveScanOptions,
  RuleCategory,
  Severity,
  Confidence,
  ReportModel,
} from '../core/types.ts';
import { executeScan } from '../core/orchestrator/scan-orchestrator.ts';
import { createDefaultRegistry } from '../rules/index.ts';
import { initConfig, VALID_CATEGORIES, VALID_SEVERITIES, ConfigError } from '../core/config/config-loader.ts';
import { ProjectDiscoveryError } from '../core/discovery/project-discovery.ts';
import { formatTerminalReport } from '../reporters/terminal-reporter.ts';
import { formatJsonReport } from '../reporters/json-reporter.ts';
import { formatSarifReport } from '../reporters/sarif-reporter.ts';
import { isSeverityAtOrAbove } from '../core/dedup/finding-collector.ts';

const VERSION = '0.1.0';

export function showHelp(): string {
  return `
LaunchGuard v${VERSION} — Local-first Next.js Production-Readiness Audit

USAGE:
  launchguard <command> [options]

COMMANDS:
  scan [path]        Run static audit against a Next.js project (default path: current directory)
  rules list         List all available audit rules with metadata
  init [path]        Create a starter .launchguardrc.json configuration file

OPTIONS:
  --only <cats>          Comma-separated list of categories to run (seo, security, code-quality, performance, dependencies, deployment, routing, structured-data)
  --skip <cats>          Comma-separated list of categories to skip
  --format <fmt>         Output format: "terminal" (default), "json", "sarif"
  --output <file>        Write output to the specified file path
  --fail-on <severity>   Exit with code 1 if findings meet or exceed severity (critical, high, medium, low, informational)
  --min-confidence <lvl> Minimum confidence level to include in findings (high, medium, low)
  --config <file>        Path to custom data-only configuration file
  --timeout <ms>         Global scan timeout in milliseconds (default: 60000)
  --max-file-size <bpx>  Per-file read limit in bytes (default: 10485760 / 10MB)
  --no-color             Disable color output in terminal mode
  --quiet                Suppress all non-report diagnostic output
  --verbose              Print verbose diagnostic and timing logs to stderr
  --help                 Show this help message
  --version              Show tool version
`;
}

/**
 * Main CLI entrypoint. Returns an exit code conforming to DOC-001 Section 19.4.
 */
export async function runCli(argv: string[]): Promise<number> {
  // Handle interrupt signal (SIGINT)
  const sigintHandler = () => {
    process.stderr.write('\nScan cancelled by user interrupt.\n');
    process.exit(130);
  };
  process.on('SIGINT', sigintHandler);

  try {
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
      process.stdout.write(showHelp());
      return 0;
    }

    if (argv.includes('--version') || argv.includes('-v')) {
      process.stdout.write(`launchguard v${VERSION}\n`);
      return 0;
    }

    const command = argv[0];

    // Command: rules list
    if (command === 'rules') {
      const subCommand = argv[1];
      if (subCommand !== 'list') {
        process.stderr.write(`Error: Unknown rules subcommand "${subCommand}". Did you mean "rules list"?\n`);
        return 2;
      }

      const registry = createDefaultRegistry();
      const rules = registry.getAllRules();

      const formatIndex = argv.indexOf('--format');
      const format = formatIndex !== -1 ? argv[formatIndex + 1] : 'terminal';

      if (format === 'json') {
        process.stdout.write(JSON.stringify(rules, null, 2) + '\n');
      } else {
        process.stdout.write(`\nLaunchGuard Available Rules (${rules.length}):\n\n`);
        for (const r of rules) {
          process.stdout.write(`• [${r.id}] (${r.candidateId})\n`);
          process.stdout.write(`  Category: ${r.category} | Default Severity: ${r.defaultSeverity} | Confidence: ${r.defaultConfidence}\n`);
          process.stdout.write(`  Description: ${r.description}\n`);
          process.stdout.write(`  Docs: ${r.documentationUrl}\n\n`);
        }
      }
      return 0;
    }

    // Command: init
    if (command === 'init') {
      const targetDir = argv[1] && !argv[1].startsWith('-') ? argv[1] : '.';
      const force = argv.includes('--force');

      try {
        const { filePath } = await initConfig(targetDir, force);
        process.stdout.write(`✔ Created starter configuration file at: ${filePath}\n`);
        return 0;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error during init: ${message}\n`);
        return 2;
      }
    }

    // Command: scan
    let targetPath = '.';
    let optionStartIndex = 0;

    if (command === 'scan') {
      optionStartIndex = 1;
      if (argv[1] && !argv[1].startsWith('-')) {
        targetPath = argv[1];
        optionStartIndex = 2;
      }
    } else if (command && !command.startsWith('-')) {
      targetPath = command;
      optionStartIndex = 1;
    }

    const scanArgs = argv.slice(optionStartIndex);

    // Parse options with strict flag checking (DOC-001 Section 19.5 Item 5)
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs({
        args: scanArgs,
        options: {
          only: { type: 'string' },
          skip: { type: 'string' },
          format: { type: 'string', default: 'terminal' },
          output: { type: 'string' },
          'fail-on': { type: 'string' },
          'min-confidence': { type: 'string' },
          config: { type: 'string' },
          timeout: { type: 'string' },
          'max-file-size': { type: 'string' },
          'no-color': { type: 'boolean', default: false },
          quiet: { type: 'boolean', default: false },
          verbose: { type: 'boolean', default: false },
        },
        strict: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      return 2;
    }

    const values = parsed.values;

    // Reject combining --only and --skip (DOC-001 LG-FR-003, OQ-018)
    if (values.only && values.skip) {
      process.stderr.write(`Error: Cannot combine --only and --skip options (DOC-001 LG-FR-003, OQ-018). Choose either --only to include categories or --skip to exclude them.\n`);
      return 2;
    }

    // Validate categories in --only and --skip
    let categories: RuleCategory[] | undefined;
    if (values.only) {
      categories = (values.only as string).split(',').map((s) => s.trim()) as RuleCategory[];
      for (const cat of categories) {
        if (!VALID_CATEGORIES.includes(cat)) {
          process.stderr.write(`Error: Unknown category "${cat}" in --only. Valid categories: ${VALID_CATEGORIES.join(', ')}\n`);
          return 2;
        }
      }
    }

    let skip: RuleCategory[] | undefined;
    if (values.skip) {
      skip = (values.skip as string).split(',').map((s) => s.trim()) as RuleCategory[];
      for (const cat of skip) {
        if (!VALID_CATEGORIES.includes(cat)) {
          process.stderr.write(`Error: Unknown category "${cat}" in --skip. Valid categories: ${VALID_CATEGORIES.join(', ')}\n`);
          return 2;
        }
      }
    }

    // Validate that category selection does not produce empty rule set (DOC-001 LG-FR-003)
    const registry = createDefaultRegistry();
    const candidateRules = registry.filterRules(categories, skip);
    if (candidateRules.length === 0) {
      process.stderr.write(`Error: Category selection produced an empty rule set (DOC-001 LG-FR-003).\n`);
      return 2;
    }

    // Validate fail-on
    const failOn = values['fail-on'] as Severity | undefined;
    if (failOn && !VALID_SEVERITIES.includes(failOn)) {
      process.stderr.write(`Error: Invalid --fail-on severity "${failOn}". Valid severities: ${VALID_SEVERITIES.join(', ')}\n`);
      return 2;
    }

    const minConfidence = values['min-confidence'] as Confidence | undefined;
    const format = (values.format as 'terminal' | 'json' | 'sarif') || 'terminal';
    if (!['terminal', 'json', 'sarif'].includes(format)) {
      process.stderr.write(`Error: Unsupported format "${format}". Supported formats: terminal, json, sarif\n`);
      return 2;
    }

    const noColor = Boolean(values['no-color'] || process.env.NO_COLOR !== undefined);
    const timeoutMs = values.timeout ? parseInt(values.timeout as string, 10) : 60000;
    const maxFileSize = values['max-file-size'] ? parseInt(values['max-file-size'] as string, 10) : 10 * 1024 * 1024;

    const scanOptions: EffectiveScanOptions = {
      targetPath,
      categories,
      skip,
      format,
      output: values.output as string | undefined,
      failOn,
      minConfidence,
      config: values.config as string | undefined,
      timeoutMs,
      maxFileSize,
      noColor,
      verbose: Boolean(values.verbose),
      quiet: Boolean(values.quiet),
    };

    // Execute scan
    let report: ReportModel;
    try {
      report = await executeScan({ options: scanOptions, registry });
    } catch (err: unknown) {
      if (err instanceof ProjectDiscoveryError || err instanceof ConfigError) {
        process.stderr.write(`Error: ${err.message}\n`);
        return 2;
      }
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Internal Error: ${message}\n`);
      return 4;
    }

    // Format output
    let outputContent = '';
    if (format === 'json') {
      outputContent = formatJsonReport(report);
    } else if (format === 'sarif') {
      outputContent = formatSarifReport(report);
    } else {
      outputContent = formatTerminalReport(report, noColor);
    }

    // Output destination: file or stdout
    if (scanOptions.output) {
      try {
        const outPath = path.resolve(scanOptions.output);

        // Security check (LG-SEC-014): Disallow writing through symbolic links
        try {
          const lstat = await fs.promises.lstat(outPath);
          if (lstat.isSymbolicLink()) {
            process.stderr.write(`Error: Output destination "${scanOptions.output}" is a symbolic link. Writing through symlinks is prohibited for security (LG-SEC-014).\n`);
            return 2;
          }
        } catch {
          // File does not exist yet; safe to write
        }

        await fs.promises.writeFile(outPath, outputContent, 'utf-8');
        if (!scanOptions.quiet) {
          process.stderr.write(`✔ Report saved to: ${outPath}\n`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error writing output file "${scanOptions.output}": ${message}\n`);
        return 2;
      }
    } else {
      process.stdout.write(outputContent + '\n');
    }

    // Determine exit code (DOC-001 Section 19.4 & ADR-007)
    // 1. Check fail-on threshold
    if (failOn) {
      const hasThresholdBreach = report.findings.some((f) => isSeverityAtOrAbove(f.severity, failOn));
      if (hasThresholdBreach) {
        return 1;
      }
    }

    // 2. Incomplete scan
    if (report.status === 'incomplete') {
      return 3;
    }

    // 3. Success
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Unexpected CLI failure: ${message}\n`);
    return 4;
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}
