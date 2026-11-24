/**
 * LaunchGuard — Local Schema Knowledge Base
 *
 * Lightweight, bundled, versioned offline knowledge base supporting Schema.org
 * static validation for Next.js structured data.
 *
 * Operates 100% offline (ADR-006). Never accesses external network or remote APIs.
 * Decoupled from rule execution logic.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface VocabularyMetadata {
  readonly vocabulary: string;
  readonly version: string;
  readonly releaseDate: string;
  readonly specUrl: string;
  readonly license: string;
  readonly bundledHash: string;
}

export interface SchemaPropertyConstraint {
  readonly expectedCategory?: string | readonly string[];
}

export interface SchemaTypeDefinition {
  readonly parent: string | null;
  readonly description: string;
  readonly supportedProperties: readonly string[];
  readonly required?: readonly string[];
  readonly requiredOneOf?: readonly (readonly string[])[];
  readonly recommended?: readonly string[];
  readonly propertyConstraints?: Record<string, SchemaPropertyConstraint>;
}

export interface SchemaPropertyDefinition {
  readonly expectedTypes: readonly string[];
  readonly description: string;
}

export interface PropertyValueTypeDefinition {
  readonly category: 'primitive' | 'structural';
  readonly description: string;
}

export interface TypeValidationRules {
  readonly required: readonly string[];
  readonly requiredOneOf: readonly (readonly string[])[];
  readonly recommended: readonly string[];
  readonly propertyConstraints: Record<string, SchemaPropertyConstraint>;
}

// Built-in hardcoded fallback in case file I/O encounters issues
const FALLBACK_METADATA: VocabularyMetadata = {
  vocabulary: 'Schema.org',
  version: '28.1',
  releaseDate: '2024-10-15',
  specUrl: 'https://schema.org/docs/releases.html#v28.1',
  license: 'Creative Commons Attribution-ShareAlike License (version 3.0)',
  bundledHash: 'sha256-schema-org-v28.1-fallback',
};

const FALLBACK_TYPES: Record<string, SchemaTypeDefinition> = {
  Thing: {
    parent: null,
    description: 'The most generic type of item.',
    supportedProperties: ['name', 'description', 'url', 'image'],
  },
  Organization: {
    parent: 'Thing',
    description: 'An organization.',
    supportedProperties: ['legalName', 'email', 'telephone', 'address'],
    requiredOneOf: [['name', 'legalName']],
    recommended: ['url'],
  },
  WebSite: {
    parent: 'Thing',
    description: 'A WebSite.',
    supportedProperties: [],
    requiredOneOf: [['name', 'url']],
  },
  Product: {
    parent: 'Thing',
    description: 'A product.',
    supportedProperties: ['offers', 'review', 'aggregateRating'],
    required: ['name'],
    requiredOneOf: [['offers', 'review', 'aggregateRating']],
  },
  Article: {
    parent: 'Thing',
    description: 'An article.',
    supportedProperties: ['headline', 'author', 'publisher'],
    required: ['headline'],
    requiredOneOf: [['author', 'publisher']],
  },
  BreadcrumbList: {
    parent: 'Thing',
    description: 'Breadcrumb list.',
    supportedProperties: ['itemListElement'],
    required: ['itemListElement'],
    propertyConstraints: {
      itemListElement: { expectedCategory: 'Array' },
    },
  },
};

export class SchemaKnowledgeBase {
  private static instance: SchemaKnowledgeBase | null = null;

  private metadata: VocabularyMetadata;
  private types: Map<string, SchemaTypeDefinition>;
  private properties: Map<string, SchemaPropertyDefinition>;
  private valueTypes: Map<string, PropertyValueTypeDefinition>;
  private isLoadedFromDisk: boolean = false;

  private constructor() {
    this.metadata = FALLBACK_METADATA;
    this.types = new Map();
    this.properties = new Map();
    this.valueTypes = new Map();
    this.loadData();
  }

  public static getInstance(): SchemaKnowledgeBase {
    if (!SchemaKnowledgeBase.instance) {
      SchemaKnowledgeBase.instance = new SchemaKnowledgeBase();
    }
    return SchemaKnowledgeBase.instance;
  }

  /**
   * For testing resilience against missing or altered files.
   */
  public static resetInstance(): void {
    SchemaKnowledgeBase.instance = null;
  }

  private loadData(): void {
    try {
      const currentDir = dirname(fileURLToPath(import.meta.url));

      // 1. Version metadata
      const versionFile = join(currentDir, 'vocabulary-version.json');
      const versionContent = readFileSync(versionFile, 'utf-8');
      this.metadata = JSON.parse(versionContent) as VocabularyMetadata;

      // 2. Types
      const typesFile = join(currentDir, 'schema-types.json');
      const typesContent = readFileSync(typesFile, 'utf-8');
      const parsedTypes = JSON.parse(typesContent) as Record<string, SchemaTypeDefinition>;
      for (const [key, value] of Object.entries(parsedTypes)) {
        this.types.set(key, value);
      }

      // 3. Properties
      const propsFile = join(currentDir, 'schema-properties.json');
      const propsContent = readFileSync(propsFile, 'utf-8');
      const parsedProps = JSON.parse(propsContent) as Record<string, SchemaPropertyDefinition>;
      for (const [key, value] of Object.entries(parsedProps)) {
        this.properties.set(key, value);
      }

      // 4. Value Types
      const valTypesFile = join(currentDir, 'property-value-types.json');
      const valTypesContent = readFileSync(valTypesFile, 'utf-8');
      const parsedValTypes = JSON.parse(valTypesContent) as Record<string, PropertyValueTypeDefinition>;
      for (const [key, value] of Object.entries(parsedValTypes)) {
        this.valueTypes.set(key, value);
      }

      this.isLoadedFromDisk = true;
    } catch {
      // Graceful fallback to embedded minimal data
      this.metadata = FALLBACK_METADATA;
      for (const [key, value] of Object.entries(FALLBACK_TYPES)) {
        this.types.set(key, value);
      }
      this.isLoadedFromDisk = false;
    }
  }

  public isLoadedSuccessfully(): boolean {
    return this.isLoadedFromDisk;
  }

  public getVocabularyMetadata(): VocabularyMetadata {
    return this.metadata;
  }

  /**
   * Normalizes a Schema.org type name by stripping any prefix (e.g. "schema:Article" -> "Article").
   */
  public normalizeTypeName(typeName: string): string {
    const trimmed = typeName.trim();
    if (trimmed.startsWith('schema:')) {
      return trimmed.slice(7);
    }
    if (trimmed.startsWith('https://schema.org/') || trimmed.startsWith('http://schema.org/')) {
      return trimmed.replace(/^https?:\/\/schema\.org\//, '');
    }
    return trimmed;
  }

  public isSupportedType(typeName: string): boolean {
    const normalized = this.normalizeTypeName(typeName);
    return this.types.has(normalized);
  }

  public getTypeDefinition(typeName: string): SchemaTypeDefinition | undefined {
    const normalized = this.normalizeTypeName(typeName);
    return this.types.get(normalized);
  }

  public getAllSupportedTypes(): string[] {
    return Array.from(this.types.keys());
  }

  public getParentType(typeName: string): string | null {
    const def = this.getTypeDefinition(typeName);
    return def ? def.parent : null;
  }

  /**
   * Checks whether childType inherits from parentType (directly or transitively).
   */
  public isSubtypeOf(childType: string, parentType: string): boolean {
    const normalizedChild = this.normalizeTypeName(childType);
    const normalizedParent = this.normalizeTypeName(parentType);

    if (normalizedChild === normalizedParent) {
      return true;
    }

    let current = this.getTypeDefinition(normalizedChild);
    let depth = 0;
    while (current && current.parent && depth < 20) {
      if (current.parent === normalizedParent) {
        return true;
      }
      current = this.getTypeDefinition(current.parent);
      depth++;
    }

    return false;
  }

  /**
   * Gathers all supported properties for a type including properties inherited from parent types.
   */
  public getAllPropertiesForType(typeName: string): Set<string> {
    const properties = new Set<string>();
    const normalized = this.normalizeTypeName(typeName);

    let current: SchemaTypeDefinition | undefined = this.types.get(normalized);
    let depth = 0;

    while (current && depth < 20) {
      if (current.supportedProperties) {
        for (const prop of current.supportedProperties) {
          properties.add(prop);
        }
      }
      if (current.parent) {
        current = this.types.get(current.parent);
      } else {
        break;
      }
      depth++;
    }

    return properties;
  }

  /**
   * Resolves aggregated validation rules (required, requiredOneOf, recommended, constraints)
   * for a type, merging inheritance rules from parent types.
   */
  public getTypeValidationRules(typeName: string): TypeValidationRules | undefined {
    const normalized = this.normalizeTypeName(typeName);
    const def = this.types.get(normalized);
    if (!def) {
      return undefined;
    }

    const required: string[] = [];
    const requiredOneOf: (readonly string[])[] = [];
    const recommended: string[] = [];
    const propertyConstraints: Record<string, SchemaPropertyConstraint> = {};

    let current: SchemaTypeDefinition | undefined = def;
    let depth = 0;

    while (current && depth < 20) {
      if (current.required) {
        for (const req of current.required) {
          if (!required.includes(req)) required.push(req);
        }
      }
      if (current.requiredOneOf) {
        for (const oneOf of current.requiredOneOf) {
          requiredOneOf.push(oneOf);
        }
      }
      if (current.recommended) {
        for (const rec of current.recommended) {
          if (!recommended.includes(rec)) recommended.push(rec);
        }
      }
      if (current.propertyConstraints) {
        for (const [prop, constraint] of Object.entries(current.propertyConstraints)) {
          if (!propertyConstraints[prop]) {
            propertyConstraints[prop] = constraint;
          }
        }
      }

      if (current.parent) {
        current = this.types.get(current.parent);
      } else {
        break;
      }
      depth++;
    }

    return {
      required,
      requiredOneOf,
      recommended,
      propertyConstraints,
    };
  }

  public isSupportedProperty(propertyName: string): boolean {
    return this.properties.has(propertyName);
  }

  public getPropertyDefinition(propertyName: string): SchemaPropertyDefinition | undefined {
    return this.properties.get(propertyName);
  }

  public getAllSupportedProperties(): string[] {
    return Array.from(this.properties.keys());
  }

  /**
   * Validates structural shape of a property value against expected category (Array, Object, Primitive).
   */
  public validatePropertyStructuralCategory(
    _propertyName: string,
    value: unknown,
    expectedCategory: string | readonly string[]
  ): { isValid: boolean; expected: string; actual: string } {
    const allowed = Array.isArray(expectedCategory) ? expectedCategory : [expectedCategory];
    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object' && !isArray;

    let actual = 'primitive';
    if (isArray) actual = 'Array';
    else if (isObject) actual = 'Object';

    const isValid = allowed.includes(actual);
    return {
      isValid,
      expected: allowed.join(' or '),
      actual,
    };
  }
}
