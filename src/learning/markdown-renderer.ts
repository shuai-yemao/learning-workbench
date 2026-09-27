import type { LearningState, LearningSubmissionRecord } from "./contracts.js";

export interface LearningArchiveDocuments {
  readonly "00-学习总览.md": string;
  readonly "01-材料索引.md": string;
  readonly "02-学习计划.md": string;
  readonly "03-今日任务.md": string;
  readonly "04-复习队列.md": string;
}

export function renderInitialLearningArchive(state: LearningState): LearningArchiveDocuments {
  const criteria = state.goal.successCriteria.map((criterion) => `- [ ] ${criterion}`).join("\n");
  return {
    "00-学习总览.md": `# ${state.goal.title}\n\n## 学习目标\n\n${state.goal.objective}\n\n## 验收标准\n\n${criteria}\n\n## 当前状态\n\n- 学习类型：${state.goal.kind}\n- 目标 ID：${state.goal.goalId}\n- 创建时间：${state.goal.createdAt}\n\n<!-- learning-workbench:managed -->\n学习台将在每次确认写入后更新此区域。\n<!-- learning-workbench:managed:end -->\n`,
    "01-材料索引.md": "# 材料索引\n\n外部材料只记录出处、范围和你的摘要；受限内容不会被学习台抓取或复制。\n",
    "02-学习计划.md": renderLearningPlan(state),
    "03-今日任务.md": renderTodayTasks(state),
    "04-复习队列.md": renderReviewQueue(state),
  };
}

export function renderLearningPlan(state: LearningState): string {
  if (state.tasks.length === 0) {
    return "# 学习计划\n\n计划由当前宿主 Agent 根据你的学习包生成；确认后由学习台保存。\n";
  }
  const tasks = state.tasks.map((task) => [
    `## ${task.dueOn} · ${task.title}`,
    `- 状态：${task.status}`,
    `- 目标：${task.objective}`,
    `- 行动：${task.action}`,
    "- 验收证据：",
    ...task.expectedEvidence.map((evidence) => `  - ${evidence}`),
  ].join("\n")).join("\n\n");
  return `# 学习计划\n\n${tasks}\n`;
}

export function renderTodayTasks(state: LearningState): string {
  const pending = state.tasks.filter((task) => task.status === "todo" || task.status === "blocked");
  if (pending.length === 0) {
    return "# 今日任务\n\n当前没有待办学习任务。\n";
  }
  return `# 今日任务\n\n${pending.map((task) => `- [ ] ${task.dueOn}：${task.title}（${task.status}）`).join("\n")}\n`;
}

export function renderReviewQueue(state: LearningState): string {
  if (state.reviews.length === 0) {
    return "# 复习队列\n\n当前没有到期复习项。\n";
  }
  return `# 复习队列\n\n${state.reviews.map((review) => `- [ ] ${review.dueOn}：${review.concept}（${review.status}）`).join("\n")}\n`;
}

export function renderSubmissionRecord(
  state: LearningState,
  submission: LearningSubmissionRecord,
): string {
  const task = state.tasks.find((item) => item.taskId === submission.taskId);
  const evidence = submission.evidencePaths.length === 0
    ? "- 无附件证据"
    : submission.evidencePaths.map((path) => `- ${path}`).join("\n");
  return `# 学习提交\n\n## 任务\n\n${task?.title ?? submission.taskId}\n\n## 反思\n\n${submission.reflectionMarkdown}\n\n## 证据\n\n${evidence}\n\n## 掌握度\n\n${submission.mastery}\n\n## 阻塞原因\n\n${submission.blockedReason ?? "无"}\n`;
}
