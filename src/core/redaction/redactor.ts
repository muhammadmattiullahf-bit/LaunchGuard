/**
 * Secret Redaction Subsystem (DOC-001 LG-FR-018, LG-SEC-007)
 * Ensures secrets, tokens, passwords, and sensitive keys are NEVER leaked in
 * terminal output, JSON reports, SARIF reports, error logs, or diagnostics.
 */

// Common high-confidence secret patterns
const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // Private keys
  {
    name: 'PRIVATE_KEY',
    regex: /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY[\s\S]*?-----END[ A-Z0-9_-]+PRIVATE KEY-----/gi,
  },
  // AWS Access Key ID
  {
    name: 'AWS_ACCESS_KEY',
    regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
  },
  // AWS Secret Access Key (heuristics for 40 char base64-like following key)
  {
    name: 'AWS_SECRET_KEY',
    regex: /(aws_secret_access_key|aws_secret_key|secret_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
  },
  // GitHub Personal Access Token / App Token
  {
    name: 'GITHUB_TOKEN',
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9_]{36,255}\b/g,
  },
  // GitHub Fine-grained PAT
  {
    name: 'GITHUB_FINE_GRAINED_TOKEN',
    regex: /\bgithub_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}\b/g,
  },
  // Google API Key
  {
    name: 'GOOGLE_API_KEY',
    regex: /\bAIza[0-9A-Za-z-_]{35,40}\b/g,
  },
  // Slack Tokens
  {
    name: 'SLACK_TOKEN',
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*\b/g,
  },
  // OpenAI / Anthropic API Keys
  {
    name: 'OPENAI_API_KEY',
    regex: /\bsk-[a-zA-Z0-9]{20,60}\b/g,
  },
  {
    name: 'ANTHROPIC_API_KEY',
    regex: /\bsk-ant-[a-zA-Z0-9_-]{32,100}\b/g,
  },
  // JSON Web Token (JWT)
  {
    name: 'JWT_TOKEN',
    regex: /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
  },
  // Generic Database Connection URLs and HTTP/FTP URLs containing passwords
  {
    name: 'URL_CREDENTIALS',
    regex: /(https?|ftp|mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/([^:\s@]+):([^@\s]+)@/gi,
  },
  // Authorization Bearer tokens
  {
    name: 'BEARER_TOKEN',
    regex: /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}\b/gi,
  },
  // Generic password assignments: password = "..." (ignoring already redacted values)
  {
    name: 'PASSWORD_ASSIGNMENT',
    regex: /(password|passwd|secret|api_key|apikey|auth_token|access_token|private_key|token|bearer)\s*[:=]\s*['"](?!\[REDACTED:)([^'"]{6,})['"]/gi,
  },
];

/**
 * Redacts any detected secrets in a given text string.
 * Replaces values with `[REDACTED:<type>]`.
 */
export function redactSecrets(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  try {
    let result = input;

    for (const { name, regex } of SECRET_PATTERNS) {
      if (name === 'URL_CREDENTIALS') {
        result = result.replace(regex, (_match, proto, user) => {
          return `${proto}://${user}:[REDACTED:PASSWORD]@`;
        });
      } else if (name === 'BEARER_TOKEN') {
        result = result.replace(regex, 'Bearer [REDACTED:BEARER_TOKEN]');
      } else if (name === 'PASSWORD_ASSIGNMENT') {
        result = result.replace(regex, (_match, key) => {
          return `${key}="[REDACTED:${key.toUpperCase()}]"`;
        });
      } else if (name === 'AWS_SECRET_KEY') {
        result = result.replace(regex, (_match, key) => {
          return `${key}="[REDACTED:AWS_SECRET_KEY]"`;
        });
      } else {
        result = result.replace(regex, `[REDACTED:${name}]`);
      }
    }

    return result;
  } catch (_err) {
    // LG-FR-018: If redaction fails for any reason, omit entire content rather than risking a leak.
    return '[REDACTED:ERROR_OMITTED]';
  }
}

/**
 * Checks if a string contains secret-like signatures.
 */
export function containsSecretPattern(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  for (const { regex } of SECRET_PATTERNS) {
    const testRegex = new RegExp(regex.source, regex.flags.replace('g', ''));
    if (testRegex.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the first secret match and its 1-indexed line number in a string.
 */
export function findSecretMatchInfo(input: string): { match: string; index: number; line: number } | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  let earliestMatch: { match: string; index: number; line: number } | null = null;

  for (const { regex } of SECRET_PATTERNS) {
    const searchRegex = new RegExp(regex.source, regex.flags.includes('i') ? 'i' : '');
    const m = searchRegex.exec(input);
    if (m && m.index !== undefined) {
      if (!earliestMatch || m.index < earliestMatch.index) {
        const line = input.slice(0, m.index).split('\n').length;
        earliestMatch = {
          match: m[0],
          index: m.index,
          line,
        };
      }
    }
  }

  return earliestMatch;
}

/**
 * Generates safely masked evidence for a finding.
 * If input contains suspected secrets, it is safely masked or truncated.
 */
export function formatSafeEvidence(rawEvidence: string | undefined): string | undefined {
  if (!rawEvidence) return undefined;
  const redacted = redactSecrets(rawEvidence);
  if (redacted === '[REDACTED:ERROR_OMITTED]') {
    return undefined;
  }
  // Bounded length to prevent terminal or report flooding
  if (redacted.length > 300) {
    return redacted.slice(0, 300) + '... [truncated]';
  }
  return redacted;
}
