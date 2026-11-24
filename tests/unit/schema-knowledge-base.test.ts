import test from 'node:test';
import assert from 'node:assert';
import { SchemaKnowledgeBase } from '../../src/knowledge/schema/index.ts';

test('Schema Knowledge Base: Metadata integrity and versioning', () => {
  const kb = SchemaKnowledgeBase.getInstance();
  const metadata = kb.getVocabularyMetadata();

  assert.strictEqual(metadata.vocabulary, 'Schema.org');
  assert.strictEqual(metadata.version, '28.1');
  assert.ok(metadata.releaseDate.length > 0);
  assert.ok(metadata.specUrl.includes('schema.org'));
  assert.ok(metadata.license.includes('Creative Commons'));
  assert.ok(metadata.bundledHash.length > 0);
  assert.strictEqual(kb.isLoadedSuccessfully(), true);
});

test('Schema Knowledge Base: All 12 candidate core types are registered', () => {
  const kb = SchemaKnowledgeBase.getInstance();
  const candidateTypes = [
    'Organization',
    'LocalBusiness',
    'PostalAddress',
    'WebSite',
    'WebPage',
    'Service',
    'Product',
    'BreadcrumbList',
    'FAQPage',
    'Article',
    'Person',
    'ImageObject',
  ];

  for (const typeName of candidateTypes) {
    assert.strictEqual(
      kb.isSupportedType(typeName),
      true,
      `Expected candidate type "${typeName}" to be supported`
    );
    const def = kb.getTypeDefinition(typeName);
    assert.ok(def, `Type definition for "${typeName}" must exist`);
    assert.ok(def.description.length > 0);
  }
});

test('Schema Knowledge Base: Normalizes prefixes and URI identifiers', () => {
  const kb = SchemaKnowledgeBase.getInstance();

  assert.strictEqual(kb.normalizeTypeName('schema:Article'), 'Article');
  assert.strictEqual(kb.normalizeTypeName('https://schema.org/Product'), 'Product');
  assert.strictEqual(kb.normalizeTypeName('http://schema.org/Organization'), 'Organization');
  assert.strictEqual(kb.normalizeTypeName('   WebSite  '), 'WebSite');

  assert.strictEqual(kb.isSupportedType('schema:BreadcrumbList'), true);
  assert.strictEqual(kb.isSupportedType('https://schema.org/FAQPage'), true);
});

test('Schema Knowledge Base: Inheritance resolution and subtype checks', () => {
  const kb = SchemaKnowledgeBase.getInstance();

  // LocalBusiness -> Organization -> Thing
  assert.strictEqual(kb.getParentType('LocalBusiness'), 'Organization');
  assert.strictEqual(kb.getParentType('Organization'), 'Thing');
  assert.strictEqual(kb.getParentType('Thing'), null);

  assert.strictEqual(kb.isSubtypeOf('LocalBusiness', 'Organization'), true);
  assert.strictEqual(kb.isSubtypeOf('LocalBusiness', 'Thing'), true);
  assert.strictEqual(kb.isSubtypeOf('Organization', 'Thing'), true);
  assert.strictEqual(kb.isSubtypeOf('Thing', 'Thing'), true);

  // Article subtypes
  assert.strictEqual(kb.isSubtypeOf('NewsArticle', 'Article'), true);
  assert.strictEqual(kb.isSubtypeOf('BlogPosting', 'Article'), true);
  assert.strictEqual(kb.isSubtypeOf('NewsArticle', 'Thing'), true);

  // Negative relationships
  assert.strictEqual(kb.isSubtypeOf('Article', 'Product'), false);
  assert.strictEqual(kb.isSubtypeOf('Organization', 'Article'), false);
  assert.strictEqual(kb.isSubtypeOf('UnknownType', 'Thing'), false);
});

test('Schema Knowledge Base: Aggregates inherited properties up the hierarchy', () => {
  const kb = SchemaKnowledgeBase.getInstance();

  const localBusinessProps = kb.getAllPropertiesForType('LocalBusiness');
  // From Thing:
  assert.ok(localBusinessProps.has('name'));
  assert.ok(localBusinessProps.has('url'));
  // From Organization:
  assert.ok(localBusinessProps.has('legalName'));
  assert.ok(localBusinessProps.has('telephone'));
  // From LocalBusiness:
  assert.ok(localBusinessProps.has('priceRange'));

  const articleProps = kb.getAllPropertiesForType('Article');
  assert.ok(articleProps.has('name')); // from Thing
  assert.ok(articleProps.has('headline')); // from Article
  assert.ok(articleProps.has('author')); // from Article
});

test('Schema Knowledge Base: Property definitions and supported vocabulary', () => {
  const kb = SchemaKnowledgeBase.getInstance();

  assert.strictEqual(kb.isSupportedProperty('headline'), true);
  assert.strictEqual(kb.isSupportedProperty('itemListElement'), true);
  assert.strictEqual(kb.isSupportedProperty('unknownCustomPropXYZ'), false);

  const headlineDef = kb.getPropertyDefinition('headline');
  assert.ok(headlineDef);
  assert.ok(headlineDef.expectedTypes.includes('Text'));

  const itemListDef = kb.getPropertyDefinition('itemListElement');
  assert.ok(itemListDef);
  assert.ok(itemListDef.expectedTypes.includes('Array'));
});

test('Schema Knowledge Base: Validates structural property categories', () => {
  const kb = SchemaKnowledgeBase.getInstance();

  // Array validation
  const arrayCheckValid = kb.validatePropertyStructuralCategory('itemListElement', [1, 2], 'Array');
  assert.strictEqual(arrayCheckValid.isValid, true);
  assert.strictEqual(arrayCheckValid.actual, 'Array');

  const arrayCheckInvalid = kb.validatePropertyStructuralCategory('itemListElement', 'not an array', 'Array');
  assert.strictEqual(arrayCheckInvalid.isValid, false);
  assert.strictEqual(arrayCheckInvalid.actual, 'primitive');

  // Object or Array (e.g. mainEntity in FAQPage)
  const multiCheckObj = kb.validatePropertyStructuralCategory('mainEntity', { question: 'test' }, ['Array', 'Object']);
  assert.strictEqual(multiCheckObj.isValid, true);

  const multiCheckArr = kb.validatePropertyStructuralCategory('mainEntity', [{ question: 'test' }], ['Array', 'Object']);
  assert.strictEqual(multiCheckArr.isValid, true);

  const multiCheckPrimitive = kb.validatePropertyStructuralCategory('mainEntity', 'invalid string', ['Array', 'Object']);
  assert.strictEqual(multiCheckPrimitive.isValid, false);
});

test('Schema Knowledge Base: Retrieves aggregated validation rules per type', () => {
  const kb = SchemaKnowledgeBase.getInstance();

  const breadcrumbRules = kb.getTypeValidationRules('BreadcrumbList');
  assert.ok(breadcrumbRules);
  assert.ok(breadcrumbRules.required.includes('itemListElement'));
  assert.ok(breadcrumbRules.propertyConstraints['itemListElement']);

  const articleRules = kb.getTypeValidationRules('Article');
  assert.ok(articleRules);
  assert.ok(articleRules.required.includes('headline'));
  assert.ok(articleRules.requiredOneOf.some((set) => set.includes('author') && set.includes('publisher')));

  const productRules = kb.getTypeValidationRules('Product');
  assert.ok(productRules);
  assert.ok(productRules.required.includes('name'));
  assert.ok(productRules.requiredOneOf.some((set) => set.includes('offers')));
});

test('Schema Knowledge Base: Singleton cache guarantees deterministic access', () => {
  const kb1 = SchemaKnowledgeBase.getInstance();
  const kb2 = SchemaKnowledgeBase.getInstance();

  assert.strictEqual(kb1, kb2);
  assert.strictEqual(kb1.getVocabularyMetadata().version, kb2.getVocabularyMetadata().version);
});
