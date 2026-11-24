export type LinkKind = 'link-component' | 'anchor-tag' | 'router-call';
export type LinkClassification =
  | 'literal'
  | 'dynamic-template'
  | 'indeterminate'
  | 'external'
  | 'ignored';

export interface ExtractedLink {
  target: string;
  sourceFile: string;
  line: number;
  column: number;
  kind: LinkKind;
  classification: LinkClassification;
  templatePrefix?: string | undefined;
  rawSnippet: string;
}

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

/**
 * Classifies a raw link href string.
 */
export function classifyLinkTarget(raw: string): {
  classification: LinkClassification;
  cleanTarget: string;
} {
  const trimmed = raw.trim();

  // 1. External protocols or protocol-relative
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('ftp://')
  ) {
    return { classification: 'external', cleanTarget: trimmed };
  }

  // 2. Ignored pseudo-protocols and fragment-only
  if (
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('sms:') ||
    trimmed.startsWith('#')
  ) {
    return { classification: 'ignored', cleanTarget: trimmed };
  }

  // 3. Local internal link (starts with / or relative ./ or ../)
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return { classification: 'literal', cleanTarget: trimmed };
  }

  // 4. Default relative or indeterminate
  if (/^[a-zA-Z0-9_\-]/i.test(trimmed)) {
    return { classification: 'literal', cleanTarget: '/' + trimmed };
  }

  return { classification: 'indeterminate', cleanTarget: trimmed };
}

/**
 * Statically extracts internal links from a file's content without executing code.
 */
export function extractLinksFromFile(
  content: string,
  relativePath: string
): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const lineIndex = new LineIndex(content);

  // Match: <Link ... href="..." or href={'...'} or href={`...`}
  // Match: <a ... href="..." or href={'...'}
  // Match: router.push("...") or router.replace("...")
  // Using bounded patterns to prevent ReDoS (ADR-002)

  // Pattern 1: <Link ... href="VALUE" or href='VALUE' or href={"VALUE"} or href={'VALUE'} or href={`VALUE`}
  const linkComponentRegex = /<Link\b([^>]{0,1000})\bhref\s*=\s*(?:(?:(["'])(.*?)\2)|(?:\{\s*(["'])(.*?)\4\s*\})|(?:\{`([^`$]*)`\})|(?:\{`([^`]*)\$\{[^}]*\}[^`]*`\})|(?:\{([^}]+)\}))/gis;

  let match: RegExpExecArray | null;
  while ((match = linkComponentRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;
    const { line, column } = lineIndex.getLineAndColumn(matchIndex);

    // Group 3: href="..." or '...'
    // Group 5: href={"..."} or {'...'}
    // Group 6: href={`static`}
    // Group 7: href={`dynamic${...}`}
    // Group 8: href={identifier}
    const rawLiteral = match[3] ?? match[5] ?? match[6];
    const rawTemplateDynamic = match[7];
    const rawIdentifier = match[8];

    if (rawLiteral !== undefined) {
      const { classification, cleanTarget } = classifyLinkTarget(rawLiteral);
      links.push({
        target: cleanTarget,
        sourceFile: relativePath,
        line,
        column,
        kind: 'link-component',
        classification,
        rawSnippet: fullMatch.slice(0, 150),
      });
    } else if (rawTemplateDynamic !== undefined) {
      // Dynamic template literal e.g. `/products/${id}`
      const prefix = rawTemplateDynamic.split('${')[0] || '';
      links.push({
        target: rawTemplateDynamic,
        sourceFile: relativePath,
        line,
        column,
        kind: 'link-component',
        classification: 'dynamic-template',
        templatePrefix: prefix.startsWith('/') ? prefix : '/' + prefix,
        rawSnippet: fullMatch.slice(0, 150),
      });
    } else if (rawIdentifier !== undefined) {
      links.push({
        target: rawIdentifier.trim(),
        sourceFile: relativePath,
        line,
        column,
        kind: 'link-component',
        classification: 'indeterminate',
        rawSnippet: fullMatch.slice(0, 150),
      });
    }
  }

  // Pattern 2: <a ... href="..." or href={'...'}
  const anchorTagRegex = /<a\b([^>]{0,1000})\bhref\s*=\s*(?:(?:(["'])(.*?)\2)|(?:\{\s*(["'])(.*?)\4\s*\}))/gis;

  while ((match = anchorTagRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;
    const { line, column } = lineIndex.getLineAndColumn(matchIndex);

    const rawLiteral = match[3] ?? match[5];
    if (rawLiteral !== undefined) {
      const { classification, cleanTarget } = classifyLinkTarget(rawLiteral);
      links.push({
        target: cleanTarget,
        sourceFile: relativePath,
        line,
        column,
        kind: 'anchor-tag',
        classification,
        rawSnippet: fullMatch.slice(0, 150),
      });
    }
  }

  // Pattern 3: router.push(...) and router.replace(...)
  const routerCallRegex = /\brouter\.(?:push|replace)\s*\(\s*(?:(?:(["'])(.*?)\1)|(?:`([^`$]*)`)|(?:`([^`]*)\$\{[^}]*\}[^`]*`)|([a-zA-Z0-9_$.]+))\s*[\),]/g;

  while ((match = routerCallRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;
    const { line, column } = lineIndex.getLineAndColumn(matchIndex);

    const rawLiteral = match[2] ?? match[3];
    const rawTemplateDynamic = match[4];
    const rawIdentifier = match[5];

    if (rawLiteral !== undefined) {
      const { classification, cleanTarget } = classifyLinkTarget(rawLiteral);
      links.push({
        target: cleanTarget,
        sourceFile: relativePath,
        line,
        column,
        kind: 'router-call',
        classification,
        rawSnippet: fullMatch.slice(0, 150),
      });
    } else if (rawTemplateDynamic !== undefined) {
      const prefix = rawTemplateDynamic.split('${')[0] || '';
      links.push({
        target: rawTemplateDynamic,
        sourceFile: relativePath,
        line,
        column,
        kind: 'router-call',
        classification: 'dynamic-template',
        templatePrefix: prefix.startsWith('/') ? prefix : '/' + prefix,
        rawSnippet: fullMatch.slice(0, 150),
      });
    } else if (rawIdentifier !== undefined) {
      links.push({
        target: rawIdentifier.trim(),
        sourceFile: relativePath,
        line,
        column,
        kind: 'router-call',
        classification: 'indeterminate',
        rawSnippet: fullMatch.slice(0, 150),
      });
    }
  }

  return links;
}
