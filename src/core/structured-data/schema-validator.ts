import type { SchemaEntity } from './jsonld-parser.ts';
import { SchemaKnowledgeBase } from '../../knowledge/schema/index.ts';

export type SchemaIssueCode =
  | 'missing-context'
  | 'missing-type'
  | 'invalid-context'
  | 'empty-entity'
  | 'missing-property'
  | 'invalid-property-type'
  | 'empty-property-value';

export interface SchemaValidationIssue {
  code: SchemaIssueCode;
  entityType?: string | undefined;
  property?: string | undefined;
  message: string;
  recommendation: string;
  severity: 'medium' | 'low';
  confidence: 'high' | 'medium';
}

export interface SupportedTypeDefinition {
  typeName: string;
  recommendedProperties: string[];
  propertyTypes: Record<string, string[]>;
}

/**
 * Checks if a Schema.org context string is valid.
 */
function isValidSchemaContext(context?: string): boolean {
  if (!context) return false;
  const trimmed = context.trim().toLowerCase();
  return (
    trimmed === 'https://schema.org' ||
    trimmed === 'http://schema.org' ||
    trimmed === 'https://schema.org/' ||
    trimmed === 'http://schema.org/'
  );
}

/**
 * Normalizes entity type name into primary type string.
 */
function getPrimaryType(type?: string | string[]): string | undefined {
  if (!type) return undefined;
  if (Array.isArray(type)) {
    return type[0];
  }
  return type;
}

/**
 * Validates a SchemaEntity against Schema.org conventions and the bundled Schema Knowledge Base.
 */
export function validateSchemaEntity(entity: SchemaEntity): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];
  const raw = entity.rawObject;
  const primaryType = getPrimaryType(entity.type);
  const kb = SchemaKnowledgeBase.getInstance();

  // 1. Context validation
  if (!entity.context || entity.context.trim().length === 0) {
    issues.push({
      code: 'missing-context',
      entityType: primaryType,
      message: 'JSON-LD entity is missing an "@context" declaration.',
      recommendation: 'Declare \'"@context": "https://schema.org"\' on the root JSON-LD object or @graph container.',
      severity: 'low',
      confidence: 'high',
    });
  } else if (!isValidSchemaContext(entity.context)) {
    issues.push({
      code: 'invalid-context',
      entityType: primaryType,
      message: `Unrecognized or invalid "@context" value "${entity.context}". Standard Schema.org requires "https://schema.org".`,
      recommendation: 'Set "@context" to "https://schema.org".',
      severity: 'low',
      confidence: 'high',
    });
  }

  // 2. Type validation
  if (!primaryType || primaryType.trim().length === 0) {
    issues.push({
      code: 'missing-type',
      message: 'JSON-LD entity is missing an "@type" declaration.',
      recommendation: 'Specify a valid Schema.org "@type" (e.g. "Organization", "WebSite", "Article").',
      severity: 'low',
      confidence: 'high',
    });
    return issues;
  }

  const normalizedType = kb.normalizeTypeName(primaryType);

  // 3. Empty entity validation (excluding @context, @type, @id)
  const contentKeys = Object.keys(raw).filter(
    (k) => k !== '@context' && k !== '@type' && k !== '@id'
  );
  if (contentKeys.length === 0) {
    issues.push({
      code: 'empty-entity',
      entityType: primaryType,
      message: `Entity of type "${primaryType}" contains no content properties.`,
      recommendation: `Add meaningful properties for the "${primaryType}" entity (e.g., name, url).`,
      severity: 'medium',
      confidence: 'high',
    });
    return issues;
  }

  // 4. Property validation using Knowledge Base
  if (kb.isSupportedType(normalizedType)) {
    const rules = kb.getTypeValidationRules(normalizedType);
    if (rules) {
      // Check required single properties
      for (const prop of rules.required) {
        if (!(prop in raw) || raw[prop] === undefined || raw[prop] === null) {
          issues.push({
            code: 'missing-property',
            entityType: primaryType,
            property: prop,
            message: `Schema.org "${primaryType}" entity is missing required property "${prop}".`,
            recommendation: `Provide the "${prop}" property on the "${primaryType}" entity to satisfy standard Schema.org specifications.`,
            severity: 'low',
            confidence: 'medium',
          });
        }
      }

      // Check requiredOneOf sets
      for (const oneOfSet of rules.requiredOneOf) {
        const hasAtLeastOne = oneOfSet.some(
          (prop) => prop in raw && raw[prop] !== undefined && raw[prop] !== null
        );
        if (!hasAtLeastOne && oneOfSet.length > 0) {
          const firstProp = oneOfSet[0] as string;
          issues.push({
            code: 'missing-property',
            entityType: primaryType,
            property: firstProp,
            message: `Schema.org "${primaryType}" entity is missing one of required properties: ${oneOfSet.join(', ')}.`,
            recommendation: `Provide at least one of (${oneOfSet.join(', ')}) on the "${primaryType}" entity.`,
            severity: 'low',
            confidence: 'medium',
          });
        }
      }

      // Check property constraints (e.g. itemListElement must be Array)
      for (const [prop, constraint] of Object.entries(rules.propertyConstraints)) {
        if (prop in raw && raw[prop] !== undefined && raw[prop] !== null) {
          const val = raw[prop];
          const expectedCategory = constraint.expectedCategory;
          if (expectedCategory) {
            const check = kb.validatePropertyStructuralCategory(prop, val, expectedCategory);
            if (!check.isValid) {
              issues.push({
                code: 'invalid-property-type',
                entityType: primaryType,
                property: prop,
                message: `Property "${prop}" on "${primaryType}" has unexpected value type "${check.actual}". Expected: ${check.expected}.`,
                recommendation: `Update "${prop}" to match the expected Schema.org data structure (${check.expected}).`,
                severity: 'medium',
                confidence: 'high',
              });
            }
          }
        }
      }
    }

    // Check empty string values across all declared properties
    for (const [prop, val] of Object.entries(raw)) {
      if (prop.startsWith('@')) continue;
      if (typeof val === 'string' && val.trim().length === 0) {
        issues.push({
          code: 'empty-property-value',
          entityType: primaryType,
          property: prop,
          message: `Property "${prop}" on "${primaryType}" entity has an empty string value.`,
          recommendation: `Provide a non-empty value for "${prop}" or remove the property.`,
          severity: 'low',
          confidence: 'high',
        });
      }
    }
  }

  return issues;
}
