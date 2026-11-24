import type { ExtractedJsonLdBlock } from './jsonld-extractor.ts';

export interface SchemaEntity {
  context?: string | undefined;
  type?: string | string[] | undefined;
  rawObject: Record<string, unknown>;
  isGraphMember: boolean;
}

export interface ParsedJsonLdResult {
  block: ExtractedJsonLdBlock;
  isValidJson: boolean;
  parseError?: string | undefined;
  isEmpty: boolean;
  isInvalidShape: boolean;
  malformedGraph: boolean;
  rootContext?: string | undefined;
  entities: SchemaEntity[];
  isIndeterminate: boolean;
}

/**
 * Extracts entities from a parsed JSON value (supporting single object, arrays, and @graph).
 */
function extractEntities(
  value: unknown,
  inheritedContext?: string
): {
  entities: SchemaEntity[];
  malformedGraph: boolean;
  isInvalidShape: boolean;
} {
  const entities: SchemaEntity[] = [];
  let malformedGraph = false;
  let isInvalidShape = false;

  if (value === null || typeof value !== 'object') {
    return { entities: [], malformedGraph: false, isInvalidShape: true };
  }

  if (Array.isArray(value)) {
    // Top-level array of entities
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const itemObj = item as Record<string, unknown>;
        const ctx = typeof itemObj['@context'] === 'string' ? itemObj['@context'] : inheritedContext;
        const type = (typeof itemObj['@type'] === 'string' || Array.isArray(itemObj['@type'])) ? (itemObj['@type'] as string | string[]) : undefined;

        entities.push({
          context: ctx,
          type,
          rawObject: itemObj,
          isGraphMember: false,
        });
      } else {
        isInvalidShape = true;
      }
    }
    return { entities, malformedGraph, isInvalidShape };
  }

  // Single object
  const rootObj = value as Record<string, unknown>;
  const rootCtx = typeof rootObj['@context'] === 'string' ? rootObj['@context'] : inheritedContext;

  // Check if @graph is present
  if ('@graph' in rootObj) {
    const graphVal = rootObj['@graph'];
    if (!Array.isArray(graphVal)) {
      malformedGraph = true;
    } else {
      if (graphVal.length === 0) {
        malformedGraph = true;
      }
      for (const item of graphVal) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const itemObj = item as Record<string, unknown>;
          const ctx = typeof itemObj['@context'] === 'string' ? itemObj['@context'] : rootCtx;
          const type = (typeof itemObj['@type'] === 'string' || Array.isArray(itemObj['@type'])) ? (itemObj['@type'] as string | string[]) : undefined;

          entities.push({
            context: ctx,
            type,
            rawObject: itemObj,
            isGraphMember: true,
          });
        } else {
          malformedGraph = true;
        }
      }
    }
    return { entities, malformedGraph, isInvalidShape };
  }

  // Standard single entity
  const type = (typeof rootObj['@type'] === 'string' || Array.isArray(rootObj['@type'])) ? (rootObj['@type'] as string | string[]) : undefined;
  entities.push({
    context: rootCtx,
    type,
    rawObject: rootObj,
    isGraphMember: false,
  });

  return { entities, malformedGraph, isInvalidShape };
}

/**
 * Safely parses and validates the structural shape of an extracted JSON-LD block.
 */
export function parseJsonLdBlock(block: ExtractedJsonLdBlock): ParsedJsonLdResult {
  if (block.classification === 'indeterminate') {
    return {
      block,
      isValidJson: true,
      isEmpty: false,
      isInvalidShape: false,
      malformedGraph: false,
      entities: [],
      isIndeterminate: true,
    };
  }

  if (block.classification === 'empty' || block.cleanJsonText.trim().length === 0) {
    return {
      block,
      isValidJson: false,
      parseError: 'JSON-LD script block is empty.',
      isEmpty: true,
      isInvalidShape: true,
      malformedGraph: false,
      entities: [],
      isIndeterminate: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.cleanJsonText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON syntax.';
    return {
      block,
      isValidJson: false,
      parseError: message,
      isEmpty: false,
      isInvalidShape: false,
      malformedGraph: false,
      entities: [],
      isIndeterminate: false,
    };
  }

  // Check empty object {} or empty array []
  const isEmpty =
    (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length === 0) ||
    (Array.isArray(parsed) && parsed.length === 0);

  const { entities, malformedGraph, isInvalidShape } = extractEntities(parsed);

  const rootContext =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>)['@context'] === 'string'
      ? (parsed as Record<string, unknown>)['@context'] as string
      : undefined;

  return {
    block,
    isValidJson: true,
    isEmpty,
    isInvalidShape,
    malformedGraph,
    rootContext,
    entities,
    isIndeterminate: false,
  };
}
