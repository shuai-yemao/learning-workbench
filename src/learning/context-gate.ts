export type LearningQuestionKind = "concept" | "clarification";
export type LearningContextMode = "quick_answer" | "context_required" | "formal_learning";

export interface ClassifiedLearningQuestion {
  domain: string;
  concept: string;
  kind: LearningQuestionKind;
}

export interface MinimumLearningContext {
  objective?: string;
  evidence?: readonly string[];
}

export interface ContextGateDecision {
  mode: LearningContextMode;
  missing: Array<"objective" | "evidence">;
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEvidence(evidence: readonly string[] | undefined): boolean {
  return evidence?.some((item) => item.trim().length > 0) ?? false;
}

function needsContext(
  history: readonly ClassifiedLearningQuestion[],
  current: ClassifiedLearningQuestion,
): boolean {
  return current.kind === "concept" && history.some((question) =>
    question.kind === "concept" &&
    question.domain === current.domain &&
    question.concept !== current.concept,
  );
}

export function evaluateLearningContext(input: {
  history: readonly ClassifiedLearningQuestion[];
  current: ClassifiedLearningQuestion;
  context: MinimumLearningContext;
}): ContextGateDecision {
  if (!needsContext(input.history, input.current)) {
    return { mode: "quick_answer", missing: [] };
  }

  const missing: Array<"objective" | "evidence"> = [];
  if (!hasText(input.context.objective)) {
    missing.push("objective");
  }
  if (!hasEvidence(input.context.evidence)) {
    missing.push("evidence");
  }
  return missing.length === 0
    ? { mode: "formal_learning", missing }
    : { mode: "context_required", missing };
}
