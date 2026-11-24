import test from 'node:test';
import assert from 'node:assert';
import type { DiscoveredFile, ProjectDescriptor } from '../../src/core/types.ts';
import {
  extractJsonLdBlocks,
  parseJsonLdBlock,
  validateSchemaEntity,
} from '../../src/core/structured-data/index.ts';
import {
  structuredDataInvalidJsonRule,
  structuredDataMissingContextOrTypeRule,
  structuredDataMissingRequiredPropertyRule,
  structuredDataSchemaSyntaxErrorRule,
} from '../../src/rules/structured-data/structured-data-rules.ts';

const mockProject: ProjectDescriptor = {
  root: '/workspace/test-app',
  isNextJs: true,
  routerType: 'app',
  hasSrc: false,
  packageJson: { name: 'test-app', dependencies: { next: '14.2.0' } },
  detectedConfigs: { lockfiles: [], envFiles: [] },
  warnings: [],
};

test('JSON-LD Extractor: Extracts standard <script type="application/ld+json"> blocks', () => {
  const content = `
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Acme Corp",
          "url": "https://acme.org"
        }
        </script>
      </head>
    </html>
  `;

  const blocks = extractJsonLdBlocks(content, 'app/layout.tsx');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0]?.classification, 'literal');
  assert.strictEqual(blocks[0]?.line, 4);
  assert.ok(blocks[0]?.cleanJsonText.includes('Acme Corp'));
});

test('JSON-LD Extractor: Extracts Next.js dangerouslySetInnerHTML JSON.stringify blocks', () => {
  const content = `
    export default function Page() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'My Site',
              url: 'https://example.com'
            }),
          }}
        />
      );
    }
  `;

  const blocks = extractJsonLdBlocks(content, 'app/page.tsx');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0]?.classification, 'literal');
  assert.strictEqual(blocks[0]?.isDangerouslySet, true);

  const parsed = parseJsonLdBlock(blocks[0]!);
  assert.strictEqual(parsed.isValidJson, true);
  assert.strictEqual(parsed.entities.length, 1);
  assert.strictEqual(parsed.entities[0]?.type, 'WebSite');
});

test('JSON-LD Extractor: Extracts JSX template literal wrapped JSON-LD', () => {
  const content = `
    export default function Root() {
      return (
        <script type="application/ld+json">
          {\`{
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Static Title",
            "datePublished": "2026-11-20"
          }\`}
        </script>
      );
    }
  `;

  const blocks = extractJsonLdBlocks(content, 'app/article/page.tsx');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0]?.classification, 'literal');
  const parsed = parseJsonLdBlock(blocks[0]!);
  assert.strictEqual(parsed.isValidJson, true);
  assert.strictEqual(parsed.entities[0]?.type, 'Article');
});

test('JSON-LD Extractor: Extracts multiple blocks in one file', () => {
  const content = `
    <head>
      <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Organization", "name": "Org 1", "url": "https://org1.com" }
      </script>
      <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "WebSite", "name": "Site 2", "url": "https://site2.com" }
      </script>
    </head>
  `;

  const blocks = extractJsonLdBlocks(content, 'app/layout.tsx');
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0]?.line, 3);
  assert.strictEqual(blocks[1]?.line, 6);
});

test('JSON-LD Extractor: Flags dynamic variables as indeterminate (no false positives)', () => {
  const content = `
    export default function DynamicPage({ schemaData }) {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      );
    }
  `;

  const blocks = extractJsonLdBlocks(content, 'app/dynamic/page.tsx');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0]?.classification, 'indeterminate');

  const parsed = parseJsonLdBlock(blocks[0]!);
  assert.strictEqual(parsed.isIndeterminate, true);
  assert.strictEqual(parsed.isValidJson, true);
});

test('JSON-LD Parser: Handles top-level array and @graph structures', () => {
  const graphJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'Acme', url: 'https://acme.org' },
      { '@type': 'WebSite', name: 'Acme Web', url: 'https://acme.org' },
    ],
  });

  const parsed = parseJsonLdBlock({
    rawText: graphJson,
    cleanJsonText: graphJson,
    sourceFile: 'app/page.tsx',
    line: 1,
    column: 1,
    classification: 'literal',
    rawSnippet: graphJson,
  });

  assert.strictEqual(parsed.isValidJson, true);
  assert.strictEqual(parsed.entities.length, 2);
  assert.strictEqual(parsed.entities[0]?.type, 'Organization');
  assert.strictEqual(parsed.entities[0]?.context, 'https://schema.org');
  assert.strictEqual(parsed.entities[1]?.type, 'WebSite');
  assert.strictEqual(parsed.entities[1]?.context, 'https://schema.org');
});

test('JSON-LD Parser: Detects syntax errors and empty objects', () => {
  // Syntax error (unclosed brace)
  const invalidJson = '{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n';
  const parsedInvalid = parseJsonLdBlock({
    rawText: invalidJson,
    cleanJsonText: invalidJson,
    sourceFile: 'app/page.tsx',
    line: 1,
    column: 1,
    classification: 'literal',
    rawSnippet: invalidJson,
  });
  assert.strictEqual(parsedInvalid.isValidJson, false);
  assert.ok(parsedInvalid.parseError);

  // Empty object
  const emptyJson = '{}';
  const parsedEmpty = parseJsonLdBlock({
    rawText: emptyJson,
    cleanJsonText: emptyJson,
    sourceFile: 'app/page.tsx',
    line: 1,
    column: 1,
    classification: 'literal',
    rawSnippet: emptyJson,
  });
  assert.strictEqual(parsedEmpty.isEmpty, true);
});

test('Schema Validator: Validates @context, @type, and recommended properties', () => {
  // Missing context
  const missingContextIssues = validateSchemaEntity({
    type: 'Organization',
    rawObject: { '@type': 'Organization', name: 'Test' },
    isGraphMember: false,
  });
  assert.ok(missingContextIssues.some((i) => i.code === 'missing-context'));

  // Invalid context
  const invalidContextIssues = validateSchemaEntity({
    context: 'http://invalid-schema.org',
    type: 'Organization',
    rawObject: { '@context': 'http://invalid-schema.org', '@type': 'Organization', name: 'Test' },
    isGraphMember: false,
  });
  assert.ok(invalidContextIssues.some((i) => i.code === 'invalid-context'));

  // Missing type
  const missingTypeIssues = validateSchemaEntity({
    context: 'https://schema.org',
    rawObject: { '@context': 'https://schema.org', name: 'Test' },
    isGraphMember: false,
  });
  assert.ok(missingTypeIssues.some((i) => i.code === 'missing-type'));

  // Missing recommended property: Article missing headline and author
  const articleIssues = validateSchemaEntity({
    context: 'https://schema.org',
    type: 'Article',
    rawObject: { '@context': 'https://schema.org', '@type': 'Article', datePublished: '2026-11-20' },
    isGraphMember: false,
  });
  assert.ok(articleIssues.some((i) => i.code === 'missing-property' && i.property === 'headline'));
  assert.ok(articleIssues.some((i) => i.code === 'missing-property' && i.property === 'author'));

  // Invalid property value type: BreadcrumbList itemListElement should be array
  const breadcrumbIssues = validateSchemaEntity({
    context: 'https://schema.org',
    type: 'BreadcrumbList',
    rawObject: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: 'not-an-array' },
    isGraphMember: false,
  });
  assert.ok(breadcrumbIssues.some((i) => i.code === 'invalid-property-type' && i.property === 'itemListElement'));

  // Empty property value: Organization name is empty string
  const emptyPropIssues = validateSchemaEntity({
    context: 'https://schema.org',
    type: 'Organization',
    rawObject: { '@context': 'https://schema.org', '@type': 'Organization', name: '', url: 'https://example.com' },
    isGraphMember: false,
  });
  assert.ok(emptyPropIssues.some((i) => i.code === 'empty-property-value' && i.property === 'name'));
});

test('M6 Rules: Full rule suite execution across valid and invalid structured data', async () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/layout.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/blog/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/broken/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const fileContents: Record<string, string> = {
    // Valid Organization schema
    'app/layout.tsx': `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "LaunchGuard Inc",
        "url": "https://launchguard.dev"
      }
      </script>
    `,
    // Missing required properties (Article missing headline and author)
    'app/blog/page.tsx': `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "datePublished": "2026-11-20"
      }
      </script>
    `,
    // Syntax error & missing context/type
    'app/broken/page.tsx': `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Broken",
        trailingComma: true,
      }
      </script>
      <script type="application/ld+json">
      {}
      </script>
    `,
  };

  const context: any = {
    project: mockProject,
    files,
    readFile: async (p: string) => fileContents[p] || null,
  };

  // 1. Invalid JSON rule
  const invalidJsonFindings = await structuredDataInvalidJsonRule.execute(context);
  assert.strictEqual(invalidJsonFindings.length, 1);
  assert.ok(invalidJsonFindings[0]?.title.includes('app/broken/page.tsx'));
  assert.strictEqual(invalidJsonFindings[0]?.severity, 'medium');

  // 2. Missing Context / Type rule
  const missingCtxFindings = await structuredDataMissingContextOrTypeRule.execute(context);
  assert.strictEqual(missingCtxFindings.length, 0); // Both valid blocks declare context and type

  // 3. Missing Required Property rule
  const missingPropFindings = await structuredDataMissingRequiredPropertyRule.execute(context);
  assert.ok(missingPropFindings.length >= 2); // headline, author missing on Article
  assert.strictEqual(missingPropFindings[0]?.severity, 'low');
  assert.strictEqual(missingPropFindings[0]?.confidence, 'medium');

  // 4. Schema Syntax Error rule
  const syntaxFindings = await structuredDataSchemaSyntaxErrorRule.execute(context);
  assert.ok(syntaxFindings.some((f) => f.title.includes('Empty structured data object')));
});

test('M6 Rules: Detects missing context/type and structural schema syntax errors', async () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/malformed/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const fileContents: Record<string, string> = {
    'app/malformed/page.tsx': `
      // 1. Missing context & type
      <script type="application/ld+json">
      {
        "name": "No Context Or Type",
        "description": "Some description"
      }
      </script>

      // 2. Empty script tag
      <script type="application/ld+json"></script>

      // 3. Malformed @graph
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": "invalid-string"
      }
      </script>

      // 4. Invalid property type & empty property value
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": "should-be-array"
      }
      </script>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "",
        "url": "https://example.com"
      }
      </script>
    `,
  };

  const context: any = {
    project: mockProject,
    files,
    readFile: async (p: string) => fileContents[p] || null,
  };

  // Missing context or type findings
  const missingCtxFindings = await structuredDataMissingContextOrTypeRule.execute(context);
  assert.ok(missingCtxFindings.length >= 2, 'Should detect missing @context and @type');
  assert.strictEqual(missingCtxFindings[0]?.severity, 'low');

  // Schema syntax error findings
  const syntaxFindings = await structuredDataSchemaSyntaxErrorRule.execute(context);
  assert.ok(syntaxFindings.some((f) => f.title.includes('Empty JSON-LD script block')));
  assert.ok(syntaxFindings.some((f) => f.title.includes('Malformed @graph array')));
  assert.ok(syntaxFindings.some((f) => f.title.includes('itemListElement')));
  assert.ok(syntaxFindings.some((f) => f.title.includes('empty string value')));
});

test('JSON-LD Extractor: Handles inverted attributes, string literals, and JSX strings', () => {
  const content = `
    // Inverted attribute order
    <script
      dangerouslySetInnerHTML={{
        __html: '{"@context": "https://schema.org", "@type": "WebSite", "name": "Inverted"}'
      }}
      type="application/ld+json"
    />
    // JSX string child
    <script type="application/ld+json">
      {'{"@context": "https://schema.org", "@type": "Thing", "name": "JSX String"}'}
    </script>
  `;

  const blocks = extractJsonLdBlocks(content, 'app/inverted/page.tsx');
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0]?.classification, 'literal');
  assert.strictEqual(blocks[1]?.classification, 'literal');
});
