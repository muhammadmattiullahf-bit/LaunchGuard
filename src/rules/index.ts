import type { RuleDefinition } from '../core/types.ts';
import { RuleRegistry } from '../core/rules/rule-registry.ts';

import { seoRules } from './seo/seo-rules.ts';
import { securityRules } from './security/security-rules.ts';
import { codeQualityRules } from './code-quality/code-quality-rules.ts';
import { deploymentRules } from './deployment/deployment-rules.ts';
import { performanceRules } from './performance/performance-rules.ts';
import { dependencyRules } from './dependencies/dependency-rules.ts';
import { routingRules } from './routing/routing-rules.ts';
import { structuredDataRules } from './structured-data/structured-data-rules.ts';

export const ALL_MVP_RULES: RuleDefinition[] = [
  ...seoRules,
  ...securityRules,
  ...codeQualityRules,
  ...deploymentRules,
  ...performanceRules,
  ...dependencyRules,
];

export const M5_ROUTING_RULES: RuleDefinition[] = [
  ...routingRules,
];

export const M6_STRUCTURED_DATA_RULES: RuleDefinition[] = [
  ...structuredDataRules,
];

export const ALL_RULES: RuleDefinition[] = [
  ...ALL_MVP_RULES,
  ...M5_ROUTING_RULES,
  ...M6_STRUCTURED_DATA_RULES,
];

export function createDefaultRegistry(): RuleRegistry {
  return new RuleRegistry(ALL_RULES);
}
