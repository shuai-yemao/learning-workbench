import type { LearningState } from "./contracts.js";

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
    "02-学习计划.md": "# 学习计划\n\n计划由当前宿主 Agent 根据你的学习包生成；确认后由学习台保存。\n",
    "03-今日任务.md": "# 今日任务\n\n当前没有已确认的学习任务。\n",
    "04-复习队列.md": "# 复习队列\n\n当前没有到期复习项。\n",
  };
}
