import type { RuleDefinition, RuleFindingInput } from '../../core/types.ts';

function isRootLayout(p: string): boolean {
  return (
    p === 'app/layout.tsx' ||
    p === 'app/layout.jsx' ||
    p === 'app/layout.js' ||
    p === 'app/layout.mjs' ||
    p === 'src/app/layout.tsx' ||
    p === 'src/app/layout.jsx' ||
    p === 'src/app/layout.js' ||
    p === 'src/app/layout.mjs'
  );
}

export const seoTitleRule: RuleDefinition = {
  id: 'seo/title-missing',
  candidateId: 'LG-SEO-R001',
  category: 'seo',
  title: 'No title metadata found for page or layout',
  description: 'Pages missing title metadata suffer poor search engine visibility and unclear browser tab labeling.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/seo/title-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    // 1. App Router
    if (project.routerType === 'app' || project.routerType === 'both') {
      const rootLayoutFile = files.find((f) => isRootLayout(f.relativePath));

      if (rootLayoutFile) {
        const content = await readFile(rootLayoutFile.relativePath);
        if (content) {
          const hasTitle =
            /title\s*:/i.test(content) ||
            /<title>/i.test(content) ||
            /generateMetadata/i.test(content);

          if (!hasTitle) {
            findings.push({
              title: 'Root layout is missing title metadata',
              description: 'The root layout does not export a metadata title, risking missing titles across all child pages.',
              location: { file: rootLayoutFile.relativePath, line: 1 },
              recommendation: 'Export a static `metadata` object with a `title` property (e.g. `title: { default: "My App", template: "%s | My App" }`).',
              evidenceAnchor: 'root-layout-title',
            });
          }
        }
      } else {
        // App router detected but no root layout
        findings.push({
          title: 'Missing root layout metadata file',
          description: 'No root layout (app/layout.tsx or src/app/layout.tsx) was detected.',
          recommendation: 'Create a root layout exporting base metadata with a title.',
          evidenceAnchor: 'missing-root-layout',
        });
      }
    }

    // 2. Pages Router
    if (project.routerType === 'pages') {
      const pageFiles = files.filter(
        (f) =>
          f.relativePath.startsWith('pages/') ||
          f.relativePath.startsWith('src/pages/')
      );
      const appFile = pageFiles.find(
        (f) =>
          f.relativePath.includes('_app.tsx') ||
          f.relativePath.includes('_app.jsx') ||
          f.relativePath.includes('_app.js')
      );
      const indexFile = pageFiles.find(
        (f) =>
          f.relativePath.includes('index.tsx') ||
          f.relativePath.includes('index.jsx') ||
          f.relativePath.includes('index.js')
      );

      let hasTitleInPages = false;
      for (const target of [appFile, indexFile].filter(Boolean)) {
        if (!target) continue;
        const content = await readFile(target.relativePath);
        if (content && (/<title>/i.test(content) || /Head/i.test(content))) {
          hasTitleInPages = true;
          break;
        }
      }

      if (!hasTitleInPages) {
        findings.push({
          title: 'No document title found in Pages router index or _app',
          description: 'Pages router project does not configure a document <title> tag via next/head.',
          location: { file: (indexFile || appFile)?.relativePath || 'pages/index.tsx', line: 1 },
          recommendation: 'Import `Head` from `next/head` and provide a `<title>` tag inside `pages/_app.tsx` or `pages/index.tsx`.',
          evidenceAnchor: 'pages-title-missing',
        });
      }
    }

    return findings;
  },
};

export const seoDescriptionRule: RuleDefinition = {
  id: 'seo/description-missing',
  candidateId: 'LG-SEO-R002',
  category: 'seo',
  title: 'No meta description found in layout or page metadata',
  description: 'A meta description provides search engines with a concise summary to show in search result snippets.',
  defaultSeverity: 'medium',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/seo/description-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    if (project.routerType === 'app' || project.routerType === 'both') {
      const rootLayout = files.find((f) => isRootLayout(f.relativePath));
      if (rootLayout) {
        const content = await readFile(rootLayout.relativePath);
        if (content) {
          const hasDesc =
            /description\s*:/i.test(content) ||
            /name=["']description["']/i.test(content) ||
            /generateMetadata/i.test(content);

          if (!hasDesc) {
            findings.push({
              title: 'Root layout is missing meta description',
              description: 'The root layout does not declare a `description` in its exported metadata object.',
              location: { file: rootLayout.relativePath, line: 1 },
              recommendation: 'Add `description: "Your application description"` to the metadata export in root layout.',
              evidenceAnchor: 'root-layout-description',
            });
          }
        }
      }
    }

    return findings;
  },
};

export const seoCanonicalRule: RuleDefinition = {
  id: 'seo/canonical-missing',
  candidateId: 'LG-SEO-R004',
  category: 'seo',
  title: 'No canonical URL metadata configured',
  description: 'Canonical URLs prevent search engines from penalizing duplicate or faceted URL variations for the same content.',
  defaultSeverity: 'low',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/seo/canonical-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    if (project.routerType === 'app' || project.routerType === 'both') {
      const rootLayout = files.find((f) => isRootLayout(f.relativePath));
      if (rootLayout) {
        const content = await readFile(rootLayout.relativePath);
        if (content) {
          const hasCanonical =
            /alternates\s*:\s*\{[^}]*canonical/i.test(content) ||
            /rel=["']canonical["']/i.test(content);

          if (!hasCanonical) {
            findings.push({
              title: 'Canonical URL configuration missing in root metadata',
              description: 'No `alternates: { canonical: "..." }` was found in root layout metadata.',
              location: { file: rootLayout.relativePath, line: 1 },
              recommendation: 'Configure `alternates: { canonical: "https://yourdomain.com" }` in metadata to specify the authoritative URL.',
              evidenceAnchor: 'canonical-url-missing',
              limitationsNote: 'Canonical URLs can also be configured per-route or dynamically generated.',
            });
          }
        }
      }
    }

    return findings;
  },
};

export const seoRobotsRule: RuleDefinition = {
  id: 'seo/robots-missing',
  candidateId: 'LG-SEO-R005',
  category: 'seo',
  title: 'No robots configuration detected',
  description: 'Search engine crawlers need instructions on which routes to crawl or avoid.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/seo/robots-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ files }) => {
    const hasRobots = files.some(
      (f) =>
        f.relativePath === 'public/robots.txt' ||
        f.relativePath === 'app/robots.ts' ||
        f.relativePath === 'app/robots.js' ||
        f.relativePath === 'app/robots.tsx' ||
        f.relativePath === 'app/robots.jsx' ||
        f.relativePath === 'src/app/robots.ts' ||
        f.relativePath === 'src/app/robots.js' ||
        f.relativePath === 'src/app/robots.tsx' ||
        f.relativePath === 'src/app/robots.jsx'
    );

    if (!hasRobots) {
      return [
        {
          title: 'Missing robots.txt or app/robots metadata route',
          description: 'No robots configuration was found in public/ or App Router convention routes.',
          recommendation: 'Add `public/robots.txt` or an `app/robots.ts` metadata route to control search engine indexing.',
          evidenceAnchor: 'missing-robots',
        },
      ];
    }
    return [];
  },
};

export const seoSiteWideNoIndexRule: RuleDefinition = {
  id: 'seo/site-wide-noindex',
  candidateId: 'LG-SEO-R006',
  category: 'seo',
  title: 'Site-wide noindex or disallow-all detected',
  description: 'A site-wide noindex tag or disallow in robots.txt will de-index the entire site from search engines.',
  defaultSeverity: 'high',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/seo/site-wide-noindex',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    // Check robots.txt or app/robots.ts
    const robotsFile = files.find(
      (f) =>
        f.relativePath === 'public/robots.txt' ||
        f.relativePath === 'app/robots.ts' ||
        f.relativePath === 'app/robots.js' ||
        f.relativePath === 'src/app/robots.ts' ||
        f.relativePath === 'src/app/robots.js'
    );
    if (robotsFile) {
      const content = await readFile(robotsFile.relativePath);
      if (
        content &&
        ((/Disallow:\s*\/\s*$/m.test(content) && /User-agent:\s*\*/m.test(content)) ||
          (/disallow:\s*['"]\/['"]/i.test(content) && /userAgent:\s*['"]\*['"]/i.test(content)))
      ) {
        findings.push({
          title: 'Robots configuration disallows all crawling',
          description: 'A wildcard user-agent rule with `disallow: "/"` completely blocks search engine crawlers.',
          location: { file: robotsFile.relativePath, line: 1 },
          recommendation: 'Verify that blocking all crawlers is intentional; remove `Disallow: /` before deploying to production.',
          evidence: 'Disallow: /',
          evidenceAnchor: 'robots-disallow-all',
        });
      }
    }

    // Check root layout for robots: { index: false }
    const rootLayout = files.find((f) => isRootLayout(f.relativePath));
    if (rootLayout) {
      const content = await readFile(rootLayout.relativePath);
      if (content && /index:\s*false/i.test(content)) {
        findings.push({
          title: 'Root layout sets index: false',
          description: 'Setting `index: false` in root layout metadata instructs search engines not to index any page.',
          location: { file: rootLayout.relativePath, line: 1 },
          recommendation: 'Remove `index: false` from root layout before production deployment.',
          evidence: 'robots: { index: false }',
          evidenceAnchor: 'root-layout-noindex',
        });
      }
    }

    return findings;
  },
};

export const seoSitemapRule: RuleDefinition = {
  id: 'seo/sitemap-missing',
  candidateId: 'LG-SEO-R007',
  category: 'seo',
  title: 'No sitemap configuration detected',
  description: 'A sitemap helps search engines discover and index all public URLs in your application.',
  defaultSeverity: 'low',
  defaultConfidence: 'high',
  documentationUrl: 'https://launchguard.dev/rules/seo/sitemap-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ files }) => {
    const hasSitemap = files.some(
      (f) =>
        f.relativePath === 'public/sitemap.xml' ||
        f.relativePath === 'app/sitemap.xml' ||
        f.relativePath === 'app/sitemap.ts' ||
        f.relativePath === 'app/sitemap.js' ||
        f.relativePath === 'app/sitemap.tsx' ||
        f.relativePath === 'app/sitemap.jsx' ||
        f.relativePath === 'src/app/sitemap.xml' ||
        f.relativePath === 'src/app/sitemap.ts' ||
        f.relativePath === 'src/app/sitemap.js' ||
        f.relativePath === 'src/app/sitemap.tsx' ||
        f.relativePath === 'src/app/sitemap.jsx'
    );

    if (!hasSitemap) {
      return [
        {
          title: 'Missing sitemap.xml or app/sitemap metadata route',
          description: 'No sitemap was found in public/ or App Router route files.',
          recommendation: 'Provide a `public/sitemap.xml` or `app/sitemap.ts` export for search engine indexing.',
          evidenceAnchor: 'missing-sitemap',
        },
      ];
    }
    return [];
  },
};

export const seoOpenGraphRule: RuleDefinition = {
  id: 'seo/opengraph-missing',
  candidateId: 'LG-SEO-R009',
  category: 'seo',
  title: 'Open Graph metadata missing',
  description: 'Open Graph tags control how URLs appear when shared on social media, messaging apps, and previews.',
  defaultSeverity: 'low',
  defaultConfidence: 'medium',
  documentationUrl: 'https://launchguard.dev/rules/seo/opengraph-missing',
  releaseClass: 'mvp',
  requiresNetwork: false,
  execute: async ({ project, files, readFile }) => {
    const findings: RuleFindingInput[] = [];

    if (project.routerType === 'app' || project.routerType === 'both') {
      const rootLayout = files.find((f) => isRootLayout(f.relativePath));
      if (rootLayout) {
        const content = await readFile(rootLayout.relativePath);
        if (content) {
          const hasOg =
            /openGraph\s*:\s*\{/i.test(content) ||
            /property=["']og:/i.test(content);

          if (!hasOg) {
            findings.push({
              title: 'Open Graph metadata not configured in root layout',
              description: 'No `openGraph: { title, description, url, siteName }` was detected in root layout metadata.',
              location: { file: rootLayout.relativePath, line: 1 },
              recommendation: 'Add an `openGraph` configuration object to your root metadata export to control preview cards.',
              evidenceAnchor: 'opengraph-missing',
            });
          }
        }
      }
    }

    return findings;
  },
};

export const seoRules: RuleDefinition[] = [
  seoTitleRule,
  seoDescriptionRule,
  seoCanonicalRule,
  seoRobotsRule,
  seoSiteWideNoIndexRule,
  seoSitemapRule,
  seoOpenGraphRule,
];
