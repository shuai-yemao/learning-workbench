export type LearningKind = "theory" | "project";
export type ClaimStatus = "confirmed" | "inferred" | "unverified";
export type Mastery = 0 | 1 | 2 | 3;
export type RelationKind =
  | "prerequisite"
  | "causal"
  | "implementation"
  | "contrast"
  | "boundary";

export interface LearningGoalDraft {
  domain: string;
  title: string;
  kind: LearningKind;
  objective: string;
  successCriteria: string[];
}

export interface LearningGoal extends LearningGoalDraft {
  goalId: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningMaterial {
  materialId: string;
  title: string;
  kind: "article" | "video" | "feishu" | "pdf" | "source" | "handwritten";
  reference: string;
  scope: string;
  access: "public" | "authenticated" | "restricted";
  learnerSummary: string;
}

export interface LearningTask {
  taskId: string;
  title: string;
  objective: string;
  action: string;
  expectedEvidence: string[];
  dueOn: string;
  status: "todo" | "submitted" | "completed" | "blocked";
}

export interface ReviewItem {
  reviewId: string;
  taskId: string;
  concept: string;
  dueOn: string;
  status: "due" | "completed";
}

export interface LearningSubmission {
  taskId: string;
  reflectionMarkdown: string;
  evidencePaths: string[];
  mastery: Mastery;
  blockedReason?: string;
}

export interface LearningSubmissionRecord extends LearningSubmission {
  submittedAt: string;
}

export interface LearningState {
  schemaVersion: 1;
  goal: LearningGoal;
  materials: LearningMaterial[];
  tasks: LearningTask[];
  reviews: ReviewItem[];
  submissions: LearningSubmissionRecord[];
  createdAt: string;
  updatedAt: string;
}

const CLAIM_STATUSES: ReadonlySet<string> = new Set(["confirmed", "inferred", "unverified"]);
const LEARNING_KINDS: ReadonlySet<string> = new Set(["theory", "project"]);

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === "string" && CLAIM_STATUSES.has(value);
}

export function isMastery(value: unknown): value is Mastery {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3;
}

export function slugifyGoalTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug.length === 0 ? "learning-goal" : slug;
}

export function validateLearningGoalDraft(value: unknown): asserts value is LearningGoalDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("learning goal draft must be an object");
  }
  const draft = value as Record<string, unknown>;
  for (const field of ["domain", "title", "objective"] as const) {
    if (typeof draft[field] !== "string" || draft[field].trim().length === 0) {
      throw new Error(`${field} must be a non-empty string`);
    }
  }
  if (typeof draft.kind !== "string" || !LEARNING_KINDS.has(draft.kind)) {
    throw new Error("kind must be theory or project");
  }
  if (!Array.isArray(draft.successCriteria) || draft.successCriteria.length === 0 ||
    draft.successCriteria.some((criterion) => typeof criterion !== "string" || criterion.trim().length === 0)) {
    throw new Error("successCriteria must contain at least one non-empty string");
  }
}
