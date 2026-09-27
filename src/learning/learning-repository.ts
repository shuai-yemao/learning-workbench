import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  slugifyGoalTitle,
  validateLearningGoalDraft,
  type LearningGoal,
  type LearningGoalDraft,
  type LearningState,
} from "./contracts.js";
import { resolveGoalDirectory } from "./domain-path.js";
import { renderInitialLearningArchive } from "./markdown-renderer.js";

export type LearningRepositoryErrorCode =
  | "GOAL_ALREADY_EXISTS"
  | "GOAL_NOT_FOUND"
  | "LEARNING_STATE_CORRUPT"
  | "LEARNING_STATE_WRITE_FAILED";

export class LearningRepositoryError extends Error {
  readonly code: LearningRepositoryErrorCode;

  constructor(code: LearningRepositoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LearningRepositoryError";
    this.code = code;
  }
}

export interface LearningRepositoryOptions {
  idFactory?: () => string;
  now?: () => Date;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isLearningState(value: unknown): value is LearningState {
  return typeof value === "object" && value !== null &&
    "schemaVersion" in value && value.schemaVersion === 1 &&
    "goal" in value && typeof value.goal === "object" && value.goal !== null &&
    "goalId" in value.goal && typeof value.goal.goalId === "string" &&
    "materials" in value && Array.isArray(value.materials) &&
    "tasks" in value && Array.isArray(value.tasks) &&
    "reviews" in value && Array.isArray(value.reviews);
}

export class LearningRepository {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(private readonly vaultRoot: string, options: LearningRepositoryOptions = {}) {
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createGoal(draftInput: LearningGoalDraft): Promise<LearningGoal> {
    validateLearningGoalDraft(draftInput);
    const draft = {
      ...draftInput,
      domain: draftInput.domain.trim(),
      title: draftInput.title.trim(),
      objective: draftInput.objective.trim(),
      successCriteria: draftInput.successCriteria.map((criterion) => criterion.trim()),
    };
    const slug = slugifyGoalTitle(draft.title);
    const directory = await resolveGoalDirectory(this.vaultRoot, draft.domain, slug);
    try {
      await stat(directory);
      throw new LearningRepositoryError("GOAL_ALREADY_EXISTS", `Learning goal already exists: ${slug}.`);
    } catch (error) {
      if (error instanceof LearningRepositoryError) {
        throw error;
      }
      if (!isMissingFile(error)) {
        throw error;
      }
    }

    const timestamp = this.now().toISOString();
    const goal: LearningGoal = {
      ...draft,
      goalId: this.idFactory(),
      slug,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const state: LearningState = {
      schemaVersion: 1,
      goal,
      materials: [],
      tasks: [],
      reviews: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await mkdir(join(directory, "学习记录"), { recursive: true });
      await mkdir(join(directory, "附件"), { recursive: true });
      await mkdir(join(directory, ".learning-workbench"), { recursive: true });
      const documents = renderInitialLearningArchive(state);
      await Promise.all([
        ...Object.entries(documents).map(([name, content]) => writeFile(join(directory, name), content, "utf8")),
        this.writeState(directory, state),
      ]);
      return goal;
    } catch (error) {
      throw new LearningRepositoryError("LEARNING_STATE_WRITE_FAILED", "Unable to create the learning archive.", { cause: error });
    }
  }

  async load(domain: string, slug: string): Promise<LearningState> {
    const directory = await resolveGoalDirectory(this.vaultRoot, domain, slug);
    const statePath = join(directory, ".learning-workbench", "state.json");
    let raw: string;
    try {
      raw = await readFile(statePath, "utf8");
    } catch (error) {
      if (isMissingFile(error)) {
        throw new LearningRepositoryError("GOAL_NOT_FOUND", `Learning goal not found: ${slug}.`, { cause: error });
      }
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new LearningRepositoryError("LEARNING_STATE_CORRUPT", "Learning state is not valid JSON.", { cause: error });
    }
    if (!isLearningState(parsed)) {
      throw new LearningRepositoryError("LEARNING_STATE_CORRUPT", "Learning state has an invalid structure.");
    }
    return parsed;
  }

  private async writeState(directory: string, state: LearningState): Promise<void> {
    const statePath = join(directory, ".learning-workbench", "state.json");
    const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      await rename(temporaryPath, statePath);
    } catch (error) {
      throw new LearningRepositoryError("LEARNING_STATE_WRITE_FAILED", "Unable to atomically save learning state.", { cause: error });
    }
  }
}
