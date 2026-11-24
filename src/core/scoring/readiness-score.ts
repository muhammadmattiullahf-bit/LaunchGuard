import type {
  Finding,
  RuleCategory,
  ReadinessScore,
  Severity,
  Confidence,
} from '../types.ts';

export const SCORE_METHOD_VERSION = '1.0.0';

export const SCORE_DISCLAIMER =
  'The readiness score is an informational heuristic derived from the findings of a static scan. It is not a security certification, audit attestation or guarantee of production readiness.';

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  informational: 0,
};

const CONFIDENCE_FACTORS: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.8,
  low: 0.5,
};

const MAX_PENALTY_PER_RULE = 30;

/**
 * Computes transparent, deterministic readiness scores per category and overall (DOC-001 Section 20.4).
 */
export function calculateReadinessScore(
  activeFindings: Finding[],
  executedCategories: RuleCategory[]
): ReadinessScore {
  if (executedCategories.length === 0) {
    return {
      overall: 100,
      byCategory: {},
      disclaimer: SCORE_DISCLAIMER,
      methodVersion: SCORE_METHOD_VERSION,
    };
  }

  // Group findings by category and ruleId
  const categoryRulePenalties: Partial<Record<RuleCategory, Map<string, number>>> = {};

  for (const cat of executedCategories) {
    categoryRulePenalties[cat] = new Map<string, number>();
  }

  for (const finding of activeFindings) {
    const catMap = categoryRulePenalties[finding.category];
    if (!catMap) continue; // If finding is outside executed categories, skip

    const baseWeight = SEVERITY_WEIGHTS[finding.severity] ?? 0;
    const confFactor = CONFIDENCE_FACTORS[finding.confidence] ?? 1.0;
    const penalty = baseWeight * confFactor;

    const currentTotal = catMap.get(finding.ruleId) ?? 0;
    catMap.set(finding.ruleId, currentTotal + penalty);
  }

  const byCategory: Partial<Record<RuleCategory, number>> = {};
  let scoreSum = 0;

  for (const cat of executedCategories) {
    const ruleMap = categoryRulePenalties[cat] ?? new Map<string, number>();
    let totalCategoryPenalty = 0;

    for (const penalty of ruleMap.values()) {
      // Diminishing returns: cap penalty per rule
      totalCategoryPenalty += Math.min(penalty, MAX_PENALTY_PER_RULE);
    }

    const catScore = Math.max(0, Math.round(100 - totalCategoryPenalty));
    byCategory[cat] = catScore;
    scoreSum += catScore;
  }

  const overall = Math.round(scoreSum / executedCategories.length);

  return {
    overall,
    byCategory,
    disclaimer: SCORE_DISCLAIMER,
    methodVersion: SCORE_METHOD_VERSION,
  };
}
