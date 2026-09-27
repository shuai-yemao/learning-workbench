import type {
  LearningGoalDraft,
  LearningState,
  LearningSubmission,
  LearningSubmissionRecord,
  LearningTask,
} from "./contracts.js";
import { LearningRepository } from "./learning-repository.js";
import { createSevenDayPlan } from "./plan-generator.js";
import { scheduleReview } from "./review-scheduler.js";

export interface LearningServiceOptions {
  idFactory?: () => string;
  now?: () => Date;
}

function addDays(date: string, offset: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

export class LearningService {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly repository: LearningRepository,
    options: LearningServiceOptions = {},
  ) {
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async start(draft: LearningGoalDraft, startOn: string): Promise<LearningState> {
    const goal = await this.repository.createGoal(draft);
    const initial = await this.repository.load(goal.domain, goal.slug);
    const state: LearningState = {
      ...initial,
      tasks: createSevenDayPlan(goal, startOn, this.idFactory),
      updatedAt: this.now().toISOString(),
    };
    await this.repository.save(goal.domain, goal.slug, state);
    return state;
  }

  async submit(
    domain: string,
    slug: string,
    input: LearningSubmission,
    completedOn: string,
  ): Promise<LearningState> {
    if (input.reflectionMarkdown.trim().length === 0) {
      throw new Error("reflectionMarkdown must be a non-empty string");
    }
    const current = await this.repository.load(domain, slug);
    const task = current.tasks.find((item) => item.taskId === input.taskId);
    if (!task) {
      throw new Error(`Learning task not found: ${input.taskId}`);
    }
    const submittedAt = this.now().toISOString();
    const submission: LearningSubmissionRecord = { ...input, submittedAt };
    const updatedTask = {
      ...task,
      status: input.blockedReason ? "blocked" : "completed",
    } satisfies LearningTask;
    const review = scheduleReview({
      reviewId: this.idFactory(),
      taskId: task.taskId,
      concept: task.title,
      completedOn,
      mastery: input.mastery,
    });
    const requiresRemediation = input.mastery === 0 || input.blockedReason !== undefined;
    const remediation = requiresRemediation ? this.createRemediationTask(task, completedOn, input.blockedReason) : [];
    const state: LearningState = {
      ...current,
      tasks: current.tasks.map((item) => item.taskId === task.taskId ? updatedTask : item).concat(remediation),
      reviews: [...current.reviews, review],
      submissions: [...current.submissions, submission],
      updatedAt: submittedAt,
    };
    await this.repository.writeSubmission(domain, slug, submission, state);
    await this.repository.save(domain, slug, state);
    return state;
  }

  private createRemediationTask(
    task: LearningTask,
    completedOn: string,
    blockedReason: string | undefined,
  ): LearningTask[] {
    return [{
      taskId: this.idFactory(),
      title: `补救：${task.title}`,
      objective: `补足“${task.title}”中的理解或证据缺口。`,
      action: blockedReason
        ? `先处理阻塞条件：${blockedReason}；然后重新完成原任务的最小可验证部分。`
        : "不看资料重新解释原理、边界和因果，再用一个更小的例子验证解释。",
      expectedEvidence: ["补救后的解释", "新的验证证据", "仍未解决的问题（如有）"],
      dueOn: addDays(completedOn, 1),
      status: "todo",
    }];
  }
}
