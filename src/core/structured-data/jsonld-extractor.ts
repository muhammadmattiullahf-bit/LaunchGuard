/**
 * Efficient binary-search line index to calculate 1-based line and column in O(log L) time.
 */
class LineIndex {
  private lineStarts: number[];

  constructor(content: string) {
    const starts = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        starts.push(i + 1);
      }
    }
    this.lineStarts = starts;
  }

  getLineAndColumn(index: number): { line: number; column: number } {
    let low = 0;
    let high = this.lineStarts.length - 1;
    let lineIndex = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const start = this.lineStarts[mid]!;
      if (start <= index) {
        lineIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const line = lineIndex + 1;
    const lineStart = this.lineStarts[lineIndex] ?? 0;
    const column = index - lineStart + 1;
    return { line, column: Math.max(1, column) };
  }
}

export type JsonLdBlockClassification = 'literal' | 'indeterminate' | 'empty';

export interface ExtractedJsonLdBlock {
  rawText: string;
  cleanJsonText: string;
  sourceFile: string;
  line: number;
  column: number;
  classification: JsonLdBlockClassification;
  rawSnippet: string;
  isDangerouslySet?: boolean | undefined;
}

/**
 * Checks if a string contains dynamic interpolation or JS identifiers.
 */
function isDynamicExpression(text: string): boolean {
  const trimmed = text.trim();
  // Variable reference or function call e.g. JSON.stringify(schemaData)
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*\s*(?:\(.*\))?$/.test(trimmed)) {
    return true;
  }
  // Template literal with dynamic interpolation e.g. `${title}`
  if (/\$\{[^}]+\}/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Normalizes raw JS object literal syntax into valid JSON where feasible statically.
 */
function normalizeJsObjectLiteralToJson(rawJs: string): string {
  let text = rawJs.trim();

  // If already starts with { or [, try parsing as JSON directly
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return text;
  }

  // Quote unquoted keys: e.g. { name: "..." } -> { "name": "..." }
  // Replace single-quoted string values: 'hello' -> "hello"
  try {
    JSON.parse(text);
    return text; // Already valid JSON
  } catch {
    // Attempt standard single-to-double quote conversion for strings and keys
    // Avoid replacing escaped quotes
    const converted = text
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/([{,]\s*)([a-zA-Z_$@][a-zA-Z0-9_$-]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1'); // remove trailing commas

    return converted;
  }
}

/**
 * Statically extracts JSON-LD script blocks from source code without executing target code.
 */
export function extractJsonLdBlocks(
  content: string,
  relativePath: string
): ExtractedJsonLdBlock[] {
  const blocks: ExtractedJsonLdBlock[] = [];
  const lineIndex = new LineIndex(content);

  // Pattern 1: <script ... type="application/ld+json" ... dangerouslySetInnerHTML={{ __html: PAYLOAD }} ... />
  // Supports single or double quotes for type, attributes in any order
  const dangerousScriptRegex = /<script\b([^>]*?)\btype\s*=\s*(["'])application\/ld\+json\2([^>]*?)\bdangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?:JSON\.stringify\s*\(([\s\S]*?)\)|(?:(["'`])([\s\S]*?)\5)|([a-zA-Z0-9_$]+))\s*,?\s*\}\s*\}\s*([^>]*?)(?:\/>|>\s*<\/script>)/gis;

  let match: RegExpExecArray | null;
  while ((match = dangerousScriptRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    const { line, column } = lineIndex.getLineAndColumn(matchIndex);
    const fullSnippet = match[0].slice(0, 200);

    const stringifyPayload = match[4];
    const stringLiteralPayload = match[6];
    const identifierPayload = match[7];

    if (stringifyPayload !== undefined) {
      const trimmed = stringifyPayload.trim();
      if (isDynamicExpression(trimmed)) {
        blocks.push({
          rawText: trimmed,
          cleanJsonText: trimmed,
          sourceFile: relativePath,
          line,
          column,
          classification: 'indeterminate',
          rawSnippet: fullSnippet,
          isDangerouslySet: true,
        });
      } else {
        const normalized = normalizeJsObjectLiteralToJson(trimmed);
        blocks.push({
          rawText: trimmed,
          cleanJsonText: normalized,
          sourceFile: relativePath,
          line,
          column,
          classification: trimmed.length === 0 ? 'empty' : 'literal',
          rawSnippet: fullSnippet,
          isDangerouslySet: true,
        });
      }
    } else if (stringLiteralPayload !== undefined) {
      const trimmed = stringLiteralPayload.trim();
      blocks.push({
        rawText: trimmed,
        cleanJsonText: trimmed,
        sourceFile: relativePath,
        line,
        column,
        classification: trimmed.length === 0 ? 'empty' : 'literal',
        rawSnippet: fullSnippet,
        isDangerouslySet: true,
      });
    } else if (identifierPayload !== undefined) {
      blocks.push({
        rawText: identifierPayload,
        cleanJsonText: identifierPayload,
        sourceFile: relativePath,
        line,
        column,
        classification: 'indeterminate',
        rawSnippet: fullSnippet,
        isDangerouslySet: true,
      });
    }
  }

  // Also check inverted attribute order: dangerouslySetInnerHTML before type="application/ld+json"
  const dangerousScriptInvertedRegex = /<script\b([^>]*?)\bdangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?:JSON\.stringify\s*\(([\s\S]*?)\)|(?:(["'`])([\s\S]*?)\3)|([a-zA-Z0-9_$]+))\s*,?\s*\}\s*\}\s*([^>]*?)\btype\s*=\s*(["'])application\/ld\+json\7([^>]*?)(?:\/>|>\s*<\/script>)/gis;

  while ((match = dangerousScriptInvertedRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    const { line, column } = lineIndex.getLineAndColumn(matchIndex);
    const fullSnippet = match[0].slice(0, 200);

    const stringifyPayload = match[2];
    const stringLiteralPayload = match[4];
    const identifierPayload = match[5];

    if (stringifyPayload !== undefined) {
      const trimmed = stringifyPayload.trim();
      if (isDynamicExpression(trimmed)) {
        blocks.push({
          rawText: trimmed,
          cleanJsonText: trimmed,
          sourceFile: relativePath,
          line,
          column,
          classification: 'indeterminate',
          rawSnippet: fullSnippet,
          isDangerouslySet: true,
        });
      } else {
        const normalized = normalizeJsObjectLiteralToJson(trimmed);
        blocks.push({
          rawText: trimmed,
          cleanJsonText: normalized,
          sourceFile: relativePath,
          line,
          column,
          classification: trimmed.length === 0 ? 'empty' : 'literal',
          rawSnippet: fullSnippet,
          isDangerouslySet: true,
        });
      }
    } else if (stringLiteralPayload !== undefined) {
      const trimmed = stringLiteralPayload.trim();
      blocks.push({
        rawText: trimmed,
        cleanJsonText: trimmed,
        sourceFile: relativePath,
        line,
        column,
        classification: trimmed.length === 0 ? 'empty' : 'literal',
        rawSnippet: fullSnippet,
        isDangerouslySet: true,
      });
    } else if (identifierPayload !== undefined) {
      blocks.push({
        rawText: identifierPayload,
        cleanJsonText: identifierPayload,
        sourceFile: relativePath,
        line,
        column,
        classification: 'indeterminate',
        rawSnippet: fullSnippet,
        isDangerouslySet: true,
      });
    }
  }

  // Pattern 2: Standard script tag with inline body:
  // <script ... type="application/ld+json" ...>BODY</script>
  // Exclude self-closing tags (<script ... />) using negative lookbehind (?<!\/)>
  const standardScriptRegex = /<script\b([^>]*?)\btype\s*=\s*(["'])application\/ld\+json\2([^>]*?)(?<!\/)>([\s\S]*?)<\/script>/gis;

  while ((match = standardScriptRegex.exec(content)) !== null) {
    const attr1 = match[1] || '';
    const attr2 = match[3] || '';
    if (attr1.includes('dangerouslySetInnerHTML') || attr2.includes('dangerouslySetInnerHTML')) {
      continue; // Handled by pattern 1
    }

    const matchIndex = match.index;
    const { line, column } = lineIndex.getLineAndColumn(matchIndex);
    const fullSnippet = match[0].slice(0, 200);
    const rawBody = match[4] || '';

    // Handle JSX wrapping: e.g. {`{ ... }`} or {'{ ... }'}
    let cleanText = rawBody.trim();
    if (cleanText.startsWith('{`') && cleanText.endsWith('`}')) {
      cleanText = cleanText.slice(2, -2).trim();
    } else if (cleanText.startsWith('{"') && cleanText.endsWith('"}')) {
      cleanText = cleanText.slice(2, -2).trim();
    } else if (cleanText.startsWith("{\'") && cleanText.endsWith("\'}")) {
      cleanText = cleanText.slice(2, -2).trim();
    } else if (cleanText.startsWith('{JSON.stringify(') && cleanText.endsWith(')}')) {
      cleanText = cleanText.slice(16, -2).trim();
      if (isDynamicExpression(cleanText)) {
        blocks.push({
          rawText: rawBody,
          cleanJsonText: cleanText,
          sourceFile: relativePath,
          line,
          column,
          classification: 'indeterminate',
          rawSnippet: fullSnippet,
          isDangerouslySet: false,
        });
        continue;
      }
      cleanText = normalizeJsObjectLiteralToJson(cleanText);
    }

    if (cleanText.length === 0) {
      blocks.push({
        rawText: rawBody,
        cleanJsonText: '',
        sourceFile: relativePath,
        line,
        column,
        classification: 'empty',
        rawSnippet: fullSnippet,
        isDangerouslySet: false,
      });
    } else if (isDynamicExpression(cleanText)) {
      blocks.push({
        rawText: rawBody,
        cleanJsonText: cleanText,
        sourceFile: relativePath,
        line,
        column,
        classification: 'indeterminate',
        rawSnippet: fullSnippet,
        isDangerouslySet: false,
      });
    } else {
      blocks.push({
        rawText: rawBody,
        cleanJsonText: cleanText,
        sourceFile: relativePath,
        line,
        column,
        classification: 'literal',
        rawSnippet: fullSnippet,
        isDangerouslySet: false,
      });
    }
  }

  // Deduplicate by sourceFile, line, and column
  const seen = new Set<string>();
  const uniqueBlocks: ExtractedJsonLdBlock[] = [];
  for (const b of blocks) {
    const key = `${b.sourceFile}:${b.line}:${b.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBlocks.push(b);
    }
  }

  return uniqueBlocks;
}
