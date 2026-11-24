import test from 'node:test';
import assert from 'node:assert';
import type { ProjectDescriptor, DiscoveredFile } from '../../src/core/types.ts';
import {
  buildRouteManifest,
  extractLinksFromFile,
  classifyLinkTarget,
  matchLinkToRoute,
  normalizeLinkTarget,
  buildNavigationGraph,
} from '../../src/core/routing/index.ts';
import {
  routingBrokenInternalLinkRule,
  routingOrphanedPageRule,
  routingRouteConflictRule,
} from '../../src/rules/routing/routing-rules.ts';

const mockAppProject: ProjectDescriptor = {
  root: '/workspace/my-app',
  isNextJs: true,
  routerType: 'app',
  hasSrc: false,
  packageJson: { name: 'my-app', dependencies: { next: '14.2.0' } },
  detectedConfigs: { lockfiles: [], envFiles: [] },
  warnings: [],
};

const mockPagesProject: ProjectDescriptor = {
  root: '/workspace/my-pages-app',
  isNextJs: true,
  routerType: 'pages',
  hasSrc: false,
  packageJson: { name: 'my-pages-app', dependencies: { next: '14.2.0' } },
  detectedConfigs: { lockfiles: [], envFiles: [] },
  warnings: [],
};

const mockSrcAppProject: ProjectDescriptor = {
  root: '/workspace/my-src-app',
  isNextJs: true,
  routerType: 'app',
  hasSrc: true,
  packageJson: { name: 'my-src-app', dependencies: { next: '14.2.0' } },
  detectedConfigs: { lockfiles: [], envFiles: [] },
  warnings: [],
};

test('Link Classification: Correctly categorizes external, ignored, and internal targets', () => {
  const ext = classifyLinkTarget('https://external.com');
  assert.strictEqual(ext.classification, 'external');

  const mail = classifyLinkTarget('mailto:test@example.com');
  assert.strictEqual(mail.classification, 'ignored');

  const hash = classifyLinkTarget('#section');
  assert.strictEqual(hash.classification, 'ignored');

  const internal = classifyLinkTarget('/dashboard');
  assert.strictEqual(internal.classification, 'literal');
  assert.strictEqual(internal.cleanTarget, '/dashboard');
});

test('Route Manifest: Discovers App Router page routes, layouts, and route handlers', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/page.tsx', absolutePath: '/workspace/app/page.tsx', sizeBytes: 100 },
    { relativePath: 'app/layout.tsx', absolutePath: '/workspace/app/layout.tsx', sizeBytes: 200 },
    { relativePath: 'app/loading.tsx', absolutePath: '/workspace/app/loading.tsx', sizeBytes: 100 },
    { relativePath: 'app/error.tsx', absolutePath: '/workspace/app/error.tsx', sizeBytes: 100 },
    { relativePath: 'app/about/page.tsx', absolutePath: '/workspace/app/about/page.tsx', sizeBytes: 150 },
    { relativePath: 'app/api/health/route.ts', absolutePath: '/workspace/app/api/health/route.ts', sizeBytes: 80 },
    { relativePath: 'app/_components/Header.tsx', absolutePath: '/workspace/app/_components/Header.tsx', sizeBytes: 300 },
  ];

  const manifest = buildRouteManifest(mockAppProject, files);

  assert.strictEqual(manifest.routerType, 'app');
  assert.strictEqual(manifest.pageRoutes.length, 2, 'Should only discover page.tsx files as page routes');
  assert.strictEqual(manifest.apiRoutes.length, 1, 'Should discover route.ts as an api route');

  const rootRoute = manifest.pageRoutes.find((r) => r.path === '/');
  assert.ok(rootRoute, 'Root route "/" must be present');
  assert.strictEqual(rootRoute.sourceFile, 'app/page.tsx');
  assert.strictEqual(rootRoute.kind, 'page');
  assert.strictEqual(rootRoute.isDynamic, false);

  const aboutRoute = manifest.pageRoutes.find((r) => r.path === '/about');
  assert.ok(aboutRoute, 'About route "/about" must be present');
  assert.strictEqual(aboutRoute.sourceFile, 'app/about/page.tsx');

  const apiRoute = manifest.apiRoutes.find((r) => r.path === '/api/health');
  assert.ok(apiRoute, 'API route "/api/health" must be present');
  assert.strictEqual(apiRoute.isApi, true);
  assert.strictEqual(apiRoute.kind, 'api');

  // Private folders should be completely excluded
  const privateRoute = manifest.routes.find((r) => r.path.includes('_components'));
  assert.strictEqual(privateRoute, undefined, 'Private folder files must not generate routes');
});

test('Route Manifest: App Router route groups, parallel slots, and dynamic routes', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/(marketing)/pricing/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/(auth)/login/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/products/[id]/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/blog/[...slug]/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/shop/[[...slug]]/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/@modal/default.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(mockAppProject, files);

  // Route groups must not appear in the URL path
  const pricing = manifest.pageRoutes.find((r) => r.path === '/pricing');
  assert.ok(pricing, 'Route group (marketing) should be omitted -> "/pricing"');
  assert.strictEqual(pricing.sourceFile, 'app/(marketing)/pricing/page.tsx');

  const login = manifest.pageRoutes.find((r) => r.path === '/login');
  assert.ok(login, 'Route group (auth) should be omitted -> "/login"');

  // Dynamic route [id]
  const product = manifest.pageRoutes.find((r) => r.path === '/products/[id]');
  assert.ok(product, 'Dynamic route "/products/[id]" must be found');
  assert.strictEqual(product.isDynamic, true);
  assert.strictEqual(product.dynamicType, 'standard');
  assert.deepStrictEqual(product.paramNames, ['id']);

  // Catch-all route [...slug]
  const blog = manifest.pageRoutes.find((r) => r.path === '/blog/[...slug]');
  assert.ok(blog, 'Catch-all route "/blog/[...slug]" must be found');
  assert.strictEqual(blog.isDynamic, true);
  assert.strictEqual(blog.dynamicType, 'catch-all');
  assert.deepStrictEqual(blog.paramNames, ['slug']);

  // Optional catch-all route [[...slug]]
  const shop = manifest.pageRoutes.find((r) => r.path === '/shop/[[...slug]]');
  assert.ok(shop, 'Optional catch-all route "/shop/[[...slug]]" must be found');
  assert.strictEqual(shop.isDynamic, true);
  assert.strictEqual(shop.dynamicType, 'optional-catch-all');
});

test('Route Manifest: Pages Router conventions and API routes', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'pages/index.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'pages/_app.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'pages/_document.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'pages/contact.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'pages/blog/index.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'pages/blog/[slug].tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'pages/api/user.ts', absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(mockPagesProject, files);

  assert.strictEqual(manifest.routerType, 'pages');
  assert.strictEqual(manifest.pageRoutes.length, 4);
  assert.strictEqual(manifest.apiRoutes.length, 1);

  // _app and _document must be excluded
  assert.strictEqual(manifest.routes.some((r) => r.path.includes('_app')), false);
  assert.strictEqual(manifest.routes.some((r) => r.path.includes('_document')), false);

  assert.ok(manifest.pageRoutes.find((r) => r.path === '/'));
  assert.ok(manifest.pageRoutes.find((r) => r.path === '/contact'));
  assert.ok(manifest.pageRoutes.find((r) => r.path === '/blog'));
  assert.ok(manifest.pageRoutes.find((r) => r.path === '/blog/[slug]'));
  assert.ok(manifest.apiRoutes.find((r) => r.path === '/api/user'));
});

test('Route Manifest: Supports src/ directory prefix', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'src/app/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'src/app/dashboard/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(mockSrcAppProject, files);

  assert.strictEqual(manifest.pageRoutes.length, 2);
  assert.ok(manifest.pageRoutes.find((r) => r.path === '/'));
  assert.ok(manifest.pageRoutes.find((r) => r.path === '/dashboard'));
});

test('Route Manifest: Detects route conflicts and collisions', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/(marketing)/pricing/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/(sales)/pricing/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(mockAppProject, files);

  assert.strictEqual(manifest.conflicts.length, 1);
  assert.strictEqual(manifest.conflicts[0]?.path, '/pricing');
  assert.strictEqual(manifest.conflicts[0]?.conflictingFiles.length, 2);
});

test('Link Extractor: Extracts JSX <Link>, anchor tags, and router calls', () => {
  const code = `
    import Link from 'next/link';
    import { useRouter } from 'next/navigation';

    export default function Nav() {
      const router = useRouter();
      return (
        <nav>
          <Link href="/about">About Us</Link>
          <Link href={'/contact'}>Contact</Link>
          <Link href={\`/products/\${id}\`}>Product</Link>
          <Link href={userUrl}>User</Link>
          <a href="/pricing">Pricing</a>
          <a href="https://external.com">External</a>
          <a href="mailto:support@test.com">Email</a>
          <button onClick={() => router.push('/dashboard')}>Dashboard</button>
          <button onClick={() => router.replace('/logout')}>Logout</button>
        </nav>
      );
    }
  `;

  const links = extractLinksFromFile(code, 'app/components/Nav.tsx');

  assert.strictEqual(links.length, 9);

  // Link 1: /about
  assert.strictEqual(links[0]?.target, '/about');
  assert.strictEqual(links[0]?.classification, 'literal');
  assert.strictEqual(links[0]?.kind, 'link-component');

  // Link 2: /contact
  assert.strictEqual(links[1]?.target, '/contact');
  assert.strictEqual(links[1]?.classification, 'literal');

  // Link 3: `/products/${id}`
  assert.strictEqual(links[2]?.classification, 'dynamic-template');
  assert.strictEqual(links[2]?.templatePrefix, '/products/');

  // Link 4: {userUrl}
  assert.strictEqual(links[3]?.classification, 'indeterminate');

  // Link 5: <a href="/pricing">
  assert.strictEqual(links[4]?.target, '/pricing');
  assert.strictEqual(links[4]?.kind, 'anchor-tag');

  // Link 6: External
  assert.strictEqual(links[5]?.classification, 'external');

  // Link 7: mailto
  assert.strictEqual(links[6]?.classification, 'ignored');

  // Link 8: router.push('/dashboard')
  assert.strictEqual(links[7]?.target, '/dashboard');
  assert.strictEqual(links[7]?.kind, 'router-call');

  // Link 9: router.replace('/logout')
  assert.strictEqual(links[8]?.target, '/logout');
  assert.strictEqual(links[8]?.kind, 'router-call');
});

test('Route Matcher: Normalizes targets with query strings, hashes, and trailing slashes', () => {
  assert.strictEqual(normalizeLinkTarget('/about?ref=nav#top'), '/about');
  assert.strictEqual(normalizeLinkTarget('/pricing/'), '/pricing');
  assert.strictEqual(normalizeLinkTarget('/'), '/');
  assert.strictEqual(normalizeLinkTarget('about'), '/about');
  assert.strictEqual(normalizeLinkTarget('./contact', 'app/team/page.tsx'), '/team/contact');
});

test('Route Matcher: Matches static and dynamic routes accurately', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/about/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/products/[id]/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/blog/[...slug]/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/shop/[[...slug]]/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(mockAppProject, files);

  // Exact static match
  const match1 = matchLinkToRoute(
    { target: '/about', sourceFile: 'app/page.tsx', line: 1, column: 1, kind: 'link-component', classification: 'literal', rawSnippet: '' },
    manifest
  );
  assert.strictEqual(match1.matched, true);
  assert.strictEqual(match1.matchedRoute?.path, '/about');

  // Dynamic match
  const match2 = matchLinkToRoute(
    { target: '/products/widget-42', sourceFile: 'app/page.tsx', line: 1, column: 1, kind: 'link-component', classification: 'literal', rawSnippet: '' },
    manifest
  );
  assert.strictEqual(match2.matched, true);
  assert.strictEqual(match2.matchedRoute?.path, '/products/[id]');

  // Catch-all match
  const match3 = matchLinkToRoute(
    { target: '/blog/2026/11/release-notes', sourceFile: 'app/page.tsx', line: 1, column: 1, kind: 'link-component', classification: 'literal', rawSnippet: '' },
    manifest
  );
  assert.strictEqual(match3.matched, true);
  assert.strictEqual(match3.matchedRoute?.path, '/blog/[...slug]');

  // Optional catch-all match with 0 extra segments
  const match4 = matchLinkToRoute(
    { target: '/shop', sourceFile: 'app/page.tsx', line: 1, column: 1, kind: 'link-component', classification: 'literal', rawSnippet: '' },
    manifest
  );
  assert.strictEqual(match4.matched, true);
  assert.strictEqual(match4.matchedRoute?.path, '/shop/[[...slug]]');

  // Broken link match
  const matchBroken = matchLinkToRoute(
    { target: '/does-not-exist', sourceFile: 'app/page.tsx', line: 1, column: 1, kind: 'link-component', classification: 'literal', rawSnippet: '' },
    manifest
  );
  assert.strictEqual(matchBroken.matched, false);
  assert.strictEqual(matchBroken.isIndeterminate, false);
});

test('Navigation Graph & Orphan Detection: Identifies unlinked pages conservatively', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/about/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/orphaned/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/api/data/route.ts', absolutePath: '', sizeBytes: 100 },
  ];

  const manifest = buildRouteManifest(mockAppProject, files);

  // Link exists only to /about
  const links = [
    {
      target: '/about',
      sourceFile: 'app/page.tsx',
      line: 5,
      column: 10,
      kind: 'link-component' as const,
      classification: 'literal' as const,
      rawSnippet: '<Link href="/about">About</Link>',
    },
  ];

  const graph = buildNavigationGraph(manifest, links);

  // /about has 1 inbound link -> not orphaned
  assert.strictEqual(graph.nodes.get('/about')?.inboundCount, 1);
  assert.strictEqual(graph.nodes.get('/about')?.isOrphaned, false);

  // / has 0 inbound links but is root -> not orphaned
  assert.strictEqual(graph.nodes.get('/')?.isOrphaned, false);

  // /orphaned has 0 inbound links -> ORPHANED
  assert.strictEqual(graph.orphanedPages.length, 1);
  assert.strictEqual(graph.orphanedPages[0]?.path, '/orphaned');
});

test('M5 Rules: Broken link, orphaned page, and route conflict rules execute properly', async () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/about/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/isolated/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];

  const mockFileContent: Record<string, string> = {
    'app/page.tsx': '<Link href="/about">About</Link><Link href="/broken-404">Missing</Link>',
    'app/about/page.tsx': '<Link href="/">Home</Link>',
    'app/isolated/page.tsx': 'export default function Isolated() { return <div>Isolated</div>; }',
  };

  const context: any = {
    project: mockAppProject,
    files,
    readFile: async (p: string) => mockFileContent[p] || null,
  };

  // 1. Broken internal link rule
  const brokenFindings = await routingBrokenInternalLinkRule.execute(context);
  assert.strictEqual(brokenFindings.length, 1);
  assert.ok(brokenFindings[0]?.title.includes('/broken-404'));
  assert.strictEqual(brokenFindings[0]?.severity, 'medium');
  assert.strictEqual(brokenFindings[0]?.confidence, 'high');

  // 2. Orphaned page rule
  const orphanFindings = await routingOrphanedPageRule.execute(context);
  assert.strictEqual(orphanFindings.length, 1);
  assert.ok(orphanFindings[0]?.title.includes('/isolated'));
  assert.strictEqual(orphanFindings[0]?.severity, 'low');
  assert.strictEqual(orphanFindings[0]?.confidence, 'medium');

  // 3. Route conflict rule (clean project -> 0 findings)
  const conflictFindingsClean = await routingRouteConflictRule.execute(context);
  assert.strictEqual(conflictFindingsClean.length, 0);

  // 4. Route conflict rule with conflicting files
  const conflictingFiles: DiscoveredFile[] = [
    { relativePath: 'app/(marketing)/pricing/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/(sales)/pricing/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];
  const conflictContext: any = {
    project: mockAppProject,
    files: conflictingFiles,
    readFile: async () => null,
  };
  const conflictFindings = await routingRouteConflictRule.execute(conflictContext);
  assert.strictEqual(conflictFindings.length, 1);
  assert.ok(conflictFindings[0]?.title.includes('/pricing'));
  assert.strictEqual(conflictFindings[0]?.severity, 'high');
  assert.strictEqual(conflictFindings[0]?.confidence, 'high');
});

test('Route Matcher: Handles dynamic template literals and edge cases', () => {
  const files: DiscoveredFile[] = [
    { relativePath: 'app/page.tsx', absolutePath: '', sizeBytes: 100 },
    { relativePath: 'app/products/[id]/page.tsx', absolutePath: '', sizeBytes: 100 },
  ];
  const manifest = buildRouteManifest(mockAppProject, files);

  // Dynamic template prefix matching existing route
  const matchTemplate = matchLinkToRoute(
    {
      target: '`/products/${item.id}`',
      sourceFile: 'app/page.tsx',
      line: 10,
      column: 5,
      kind: 'link-component',
      classification: 'dynamic-template',
      templatePrefix: '/products/',
      rawSnippet: '`<Link href={`/products/${item.id}`}>`',
    },
    manifest
  );
  assert.strictEqual(matchTemplate.matched, true);
  assert.strictEqual(matchTemplate.isIndeterminate, false);
  assert.strictEqual(matchTemplate.matchedRoute?.path, '/products/[id]');

  // Dynamic template prefix not matching any route
  const matchUnmatchedTemplate = matchLinkToRoute(
    {
      target: '`/unknown/${item.id}`',
      sourceFile: 'app/page.tsx',
      line: 12,
      column: 5,
      kind: 'link-component',
      classification: 'dynamic-template',
      templatePrefix: '/unknown/',
      rawSnippet: '`<Link href={`/unknown/${item.id}`}>`',
    },
    manifest
  );
  assert.strictEqual(matchUnmatchedTemplate.isIndeterminate, true);

  // Indeterminate identifier
  const matchIndeterminate = matchLinkToRoute(
    {
      target: 'dynamicUrl',
      sourceFile: 'app/page.tsx',
      line: 15,
      column: 5,
      kind: 'link-component',
      classification: 'indeterminate',
      rawSnippet: '<Link href={dynamicUrl}>',
    },
    manifest
  );
  assert.strictEqual(matchIndeterminate.matched, true);
  assert.strictEqual(matchIndeterminate.isIndeterminate, true);

  // External link
  const matchExternal = matchLinkToRoute(
    {
      target: 'https://external.org',
      sourceFile: 'app/page.tsx',
      line: 20,
      column: 5,
      kind: 'anchor-tag',
      classification: 'external',
      rawSnippet: '<a href="https://external.org">',
    },
    manifest
  );
  assert.strictEqual(matchExternal.matched, true);
  assert.strictEqual(matchExternal.isIndeterminate, false);
});
