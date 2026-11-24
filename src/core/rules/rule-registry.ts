import type { RuleDefinition, RuleCategory } from '../types.ts';

export class RuleRegistryError extends Error {
  public code: string;
  constructor(message: string, code = 'RULE_REGISTRY_ERROR') {
    super(message);
    this.name = 'RuleRegistryError';
    this.code = code;
  }
}

export class RuleRegistry {
  private readonly rules = new Map<string, RuleDefinition>();

  constructor(rules: RuleDefinition[] = []) {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  public register(rule: RuleDefinition): void {
    if (!rule.id || typeof rule.id !== 'string') {
      throw new RuleRegistryError('Rule is missing a valid "id" string', 'INVALID_RULE_ID');
    }

    if (!rule.candidateId || typeof rule.candidateId !== 'string') {
      throw new RuleRegistryError(`Rule "${rule.id}" is missing a valid "candidateId"`, 'MISSING_CANDIDATE_ID');
    }

    if (!rule.category || typeof rule.category !== 'string') {
      throw new RuleRegistryError(`Rule "${rule.id}" is missing a valid "category"`, 'MISSING_CATEGORY');
    }

    if (!rule.title || typeof rule.title !== 'string') {
      throw new RuleRegistryError(`Rule "${rule.id}" is missing a valid "title"`, 'MISSING_TITLE');
    }

    if (!rule.description || typeof rule.description !== 'string') {
      throw new RuleRegistryError(`Rule "${rule.id}" is missing a valid "description"`, 'MISSING_DESCRIPTION');
    }

    if (!rule.defaultSeverity) {
      throw new RuleRegistryError(`Rule "${rule.id}" is missing "defaultSeverity"`, 'MISSING_SEVERITY');
    }

    if (!rule.defaultConfidence) {
      throw new RuleRegistryError(`Rule "${rule.id}" is missing "defaultConfidence"`, 'MISSING_CONFIDENCE');
    }

    if (typeof rule.execute !== 'function') {
      throw new RuleRegistryError(`Rule "${rule.id}" must implement an "execute" function`, 'MISSING_EXECUTE');
    }

    // Startup check: Duplicate rule IDs are prohibited (DOC-001 LG-FR-004)
    if (this.rules.has(rule.id)) {
      throw new RuleRegistryError(
        `Duplicate rule ID detected: "${rule.id}". Each rule must have a unique identifier.`,
        'DUPLICATE_RULE_ID'
      );
    }

    this.rules.set(rule.id, rule);
  }

  public getRule(id: string): RuleDefinition | undefined {
    return this.rules.get(id);
  }

  public getAllRules(): RuleDefinition[] {
    return Array.from(this.rules.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  public getRulesByCategory(category: RuleCategory): RuleDefinition[] {
    return this.getAllRules().filter((r) => r.category === category);
  }

  public filterRules(categories?: RuleCategory[], skip?: RuleCategory[]): RuleDefinition[] {
    let result = this.getAllRules();

    if (categories && categories.length > 0) {
      const allowed = new Set(categories);
      result = result.filter((r) => allowed.has(r.category));
    }

    if (skip && skip.length > 0) {
      const skipped = new Set(skip);
      result = result.filter((r) => !skipped.has(r.category));
    }

    return result;
  }

  public count(): number {
    return this.rules.size;
  }
}
