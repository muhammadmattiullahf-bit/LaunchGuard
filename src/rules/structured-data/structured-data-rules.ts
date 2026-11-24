import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';
import {
  extractJsonLdBlocks,
  parseJsonLdBlock,
  validateSchemaEntity,
} from '../../core/structured-data/index.ts';

const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.html']);

/**
 * Filter scannable candidate files.
 */
function getCandidateFiles(files: { relativePath: string }[]): { relativePath: string }[] {
  return files.filter(
    (f) =>
      SOURCE_EXTENSIONS.has(f.relativePath.slice(f.relativePath.lastIndexOf('.'))) &&
      !f.relativePath.startsWith('node_modules/') &&
      !f.relativePath.startsWith('.next/') &&
      !f.relativePath.startsWith('dist/') &&
      !f.relativePath.startsWith('tests/fixtures/')
  );
}

/**
 * LG-SDT-R001: Invalid JSON syntax in JSON-LD script block.
 */
export const structuredDataInvalidJsonRule: RuleDefinition = {
  id: 'structured-data/invalid-json-ld',
  candidateId: 'LG-SDT-R001',
  category: 'structured-data',
  title: 'Invalid JSON syntax in JSON-LD script block',
  description: 'A <script type="application/ld+json"> tag contains syntax errors and cannot be parsed as valid JSON.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/structured-data/invalid-json-ld',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ files, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const candidates = getCandidateFiles(files);

    for (const f of candidates) {
      const content = await readFile(f.relativePath, 1024 * 1024);
      if (!content || !content.includes('application/ld+json')) continue;

      const blocks = extractJsonLdBlocks(content, f.relativePath);
      for (const block of blocks) {
        if (block.classification === 'indeterminate' || block.classification === 'empty') {
          continue;
        }

        const parsed = parseJsonLdBlock(block);
        if (!parsed.isValidJson && !parsed.isEmpty) {
          findings.push({
            title: `Syntax error in JSON-LD block in ${f.relativePath}`,
            description: `The JSON-LD block contains invalid JSON syntax: ${parsed.parseError || 'Parse error'}. Search engines will fail to parse this markup.`,
            location: {
              file: block.sourceFile,
              line: block.line,
              column: block.column,
            },
            recommendation: 'Fix JSON syntax errors, ensure proper double-quote string escaping, and remove trailing commas.',
            evidence: block.rawSnippet,
            evidenceAnchor: `invalid-jsonld-${f.relativePath}-${block.line}-${block.column}`,
            severity: 'medium',
            confidence: 'high',
          });
        }
      }
    }

    return findings;
  },
};

/**
 * LG-SDT-R002: Missing context or type in JSON-LD entity.
 */
export const structuredDataMissingContextOrTypeRule: RuleDefinition = {
  id: 'structured-data/missing-context-or-type',
  candidateId: 'LG-SDT-R002',
  category: 'structured-data',
  title: 'JSON-LD entity is missing required @context or @type',
  description: 'A structured data entity or @graph item does not specify an @context or @type declaration.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/structured-data/missing-context-or-type',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ files, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const candidates = getCandidateFiles(files);

    for (const f of candidates) {
      const content = await readFile(f.relativePath, 1024 * 1024);
      if (!content || !content.includes('application/ld+json')) continue;

      const blocks = extractJsonLdBlocks(content, f.relativePath);
      for (const block of blocks) {
        if (block.classification === 'indeterminate' || block.classification === 'empty') {
          continue;
        }

        const parsed = parseJsonLdBlock(block);
        if (!parsed.isValidJson || parsed.isEmpty) continue;

        for (const entity of parsed.entities) {
          const issues = validateSchemaEntity(entity);
          for (const issue of issues) {
            if (
              issue.code === 'missing-context' ||
              issue.code === 'missing-type' ||
              issue.code === 'invalid-context'
            ) {
              findings.push({
                title: issue.message,
                description: `Schema.org structured data requires "@context": "https://schema.org" and a valid "@type" to establish vocabulary context.`,
                location: {
                  file: block.sourceFile,
                  line: block.line,
                  column: block.column,
                },
                recommendation: issue.recommendation,
                evidence: block.rawSnippet,
                evidenceAnchor: `missing-ctx-type-${f.relativePath}-${block.line}-${issue.code}`,
                severity: issue.severity,
                confidence: issue.confidence,
              });
            }
          }
        }
      }
    }

    return findings;
  },
};

/**
 * LG-SDT-R003: Missing recommended properties for supported Schema.org types.
 */
export const structuredDataMissingRequiredPropertyRule: RuleDefinition = {
  id: 'structured-data/missing-required-property',
  candidateId: 'LG-SDT-R003',
  category: 'structured-data',
  title: 'Missing recommended property for Schema.org entity',
  description: 'A supported Schema.org entity is missing standard recommended properties for search engine rich results.',
  defaultSeverity: 'low',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/structured-data/missing-required-property',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ files, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const candidates = getCandidateFiles(files);

    for (const f of candidates) {
      const content = await readFile(f.relativePath, 1024 * 1024);
      if (!content || !content.includes('application/ld+json')) continue;

      const blocks = extractJsonLdBlocks(content, f.relativePath);
      for (const block of blocks) {
        if (block.classification === 'indeterminate' || block.classification === 'empty') {
          continue;
        }

        const parsed = parseJsonLdBlock(block);
        if (!parsed.isValidJson || parsed.isEmpty) continue;

        for (const entity of parsed.entities) {
          const issues = validateSchemaEntity(entity);
          for (const issue of issues) {
            if (issue.code === 'missing-property') {
              findings.push({
                title: issue.message,
                description: `The "${issue.entityType}" entity lacks the recommended "${issue.property}" property. While not strictly required by core JSON-LD syntax, search engines rely on it for rich snippet eligibility.`,
                location: {
                  file: block.sourceFile,
                  line: block.line,
                  column: block.column,
                },
                recommendation: issue.recommendation,
                evidence: block.rawSnippet,
                evidenceAnchor: `missing-prop-${f.relativePath}-${block.line}-${issue.entityType}-${issue.property}`,
                severity: issue.severity,
                confidence: issue.confidence,
              });
            }
          }
        }
      }
    }

    return findings;
  },
};

/**
 * LG-SDT-R004: Malformed schema structure, empty object, or invalid property value type.
 */
export const structuredDataSchemaSyntaxErrorRule: RuleDefinition = {
  id: 'structured-data/schema-syntax-error',
  candidateId: 'LG-SDT-R004',
  category: 'structured-data',
  title: 'Malformed schema structure, empty object, or invalid property value type',
  description: 'A structured data block contains an empty entity, malformed @graph array, or invalid value type for standard properties.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/structured-data/schema-syntax-error',
  releaseClass: 'post-mvp',
  requiresNetwork: false,
  execute: async ({ files, readFile }) => {
    const findings: RuleFindingInput[] = [];
    const candidates = getCandidateFiles(files);

    for (const f of candidates) {
      const content = await readFile(f.relativePath, 1024 * 1024);
      if (!content || !content.includes('application/ld+json')) continue;

      const blocks = extractJsonLdBlocks(content, f.relativePath);
      for (const block of blocks) {
        if (block.classification === 'indeterminate') {
          continue;
        }

        if (block.classification === 'empty') {
          findings.push({
            title: `Empty JSON-LD script block in ${f.relativePath}`,
            description: 'The <script type="application/ld+json"> tag contains no content or an empty body.',
            location: {
              file: block.sourceFile,
              line: block.line,
              column: block.column,
            },
            recommendation: 'Provide a valid Schema.org entity inside the JSON-LD script or remove the empty tag.',
            evidence: block.rawSnippet,
            evidenceAnchor: `empty-jsonld-${f.relativePath}-${block.line}-${block.column}`,
            severity: 'medium',
            confidence: 'high',
          });
          continue;
        }

        const parsed = parseJsonLdBlock(block);
        if (!parsed.isValidJson) continue;

        if (parsed.isEmpty) {
          findings.push({
            title: `Empty structured data object in ${f.relativePath}`,
            description: 'The JSON-LD block defines an empty object {} or empty array [].',
            location: {
              file: block.sourceFile,
              line: block.line,
              column: block.column,
            },
            recommendation: 'Populate standard Schema.org entity properties or remove the empty object.',
            evidence: block.rawSnippet,
            evidenceAnchor: `empty-object-${f.relativePath}-${block.line}-${block.column}`,
            severity: 'medium',
            confidence: 'high',
          });
          continue;
        }

        if (parsed.malformedGraph) {
          findings.push({
            title: `Malformed @graph array in ${f.relativePath}`,
            description: 'The "@graph" property must contain a non-empty array of Schema.org entity objects.',
            location: {
              file: block.sourceFile,
              line: block.line,
              column: block.column,
            },
            recommendation: 'Ensure "@graph" is an array containing valid entity objects with "@type" declarations.',
            evidence: block.rawSnippet,
            evidenceAnchor: `malformed-graph-${f.relativePath}-${block.line}`,
            severity: 'medium',
            confidence: 'high',
          });
        }

        for (const entity of parsed.entities) {
          const issues = validateSchemaEntity(entity);
          for (const issue of issues) {
            if (
              issue.code === 'empty-entity' ||
              issue.code === 'invalid-property-type' ||
              issue.code === 'empty-property-value'
            ) {
              findings.push({
                title: issue.message,
                description: `Schema structural issue: ${issue.message}`,
                location: {
                  file: block.sourceFile,
                  line: block.line,
                  column: block.column,
                },
                recommendation: issue.recommendation,
                evidence: block.rawSnippet,
                evidenceAnchor: `schema-syntax-${f.relativePath}-${block.line}-${issue.code}-${issue.property || ''}`,
                severity: issue.severity,
                confidence: issue.confidence,
              });
            }
          }
        }
      }
    }

    return findings;
  },
};

export const structuredDataRules: RuleDefinition[] = [
  structuredDataInvalidJsonRule,
  structuredDataMissingContextOrTypeRule,
  structuredDataMissingRequiredPropertyRule,
  structuredDataSchemaSyntaxErrorRule,
];
