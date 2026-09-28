# 学习上下文渐进门禁实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 首次快速概念问答直接回答；同一会话中的第二个同领域独立概念问题必须收集最小学习上下文，再允许进入正式学习闭环。

**架构：** `src/learning/context-gate.ts` 是唯一可测试的公共 seam：输入分类后的会话历史、本轮问题、目标和依据，输出门禁模式与缺失字段。Skill 负责自然语言分类和收集；CLI 不保存会话历史。

**技术栈：** TypeScript、Vitest、Codex Skill Markdown、插件校验脚本。

---

## 文件结构

- 创建：`src/learning/context-gate.ts` — 纯函数门禁规则和稳定类型。
- 创建：`tests/learning/context-gate.test.ts` — 从公开函数验证首次、同领域、跨领域、澄清和完整上下文行为。
- 修改：`skills/learning-workbench/SKILL.md` — 宿主 Agent 的渐进门禁流程。
- 修改：`skills/learning-workbench/references/input-contract.md` — 被触发时的最小上下文模板。
- 修改：`README.md`、`docs/usage.md`、`docs/mvp-manual-test.md` — 产品说明和人工验收。

### 任务 1：门禁规则和测试

**文件：**

- 创建：`tests/learning/context-gate.test.ts`
- 创建：`src/learning/context-gate.ts`

- [x] **步骤 1：编写失败的公共接口测试**

```ts
import { describe, expect, it } from "vitest";
import { evaluateLearningContext } from "../../src/learning/context-gate.js";

describe("learning context gate", () => {
  it("allows the first classified concept question as a quick answer", () => {
    expect(evaluateLearningContext({
      history: [],
      current: { domain: "嵌入式 / FreeRTOS 并发", concept: "Mutex", kind: "concept" },
      context: {},
    })).toMatchObject({ mode: "quick_answer", missing: [] });
  });
});
```

- [x] **步骤 2：运行红色测试**

运行：`npm test -- --run tests/learning/context-gate.test.ts`

预期：FAIL，原因是 `src/learning/context-gate.js` 不存在。

- [x] **步骤 3：扩展测试到完整规则**

增加测试：历史 `Queue` 加本轮 `Mutex`（相同领域）返回 `context_required` 且 `missing` 为 `objective`、`evidence`；同概念的 `clarification` 与不同领域的 `ADC` 返回 `quick_answer`；同领域第二问提供 `objective: "为项目选择同步机制"` 和 `evidence: ["app/message_task.c"]` 时返回 `formal_learning`。

- [x] **步骤 4：实现最少代码**

在 `src/learning/context-gate.ts` 导出：

```ts
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

export function evaluateLearningContext(input: {
  history: readonly ClassifiedLearningQuestion[];
  current: ClassifiedLearningQuestion;
  context: MinimumLearningContext;
}): ContextGateDecision;
```

判定只使用精确领域匹配、不同概念和 `concept` 类型。目标去空白后非空，且依据数组含至少一个去空白后的条目，才允许 `formal_learning`。不得读取文件、写入状态或用关键词猜测领域。

- [x] **步骤 5：运行绿色测试并提交**

运行：`npm test -- --run tests/learning/context-gate.test.ts`

预期：所有门禁测试通过。

提交：

```bash
git add -- src/learning/context-gate.ts tests/learning/context-gate.test.ts
git commit -m "feat: gate formal learning on context"
```

### 任务 2：插件协议与文档同步

**文件：**

- 修改：`skills/learning-workbench/SKILL.md`
- 修改：`skills/learning-workbench/references/input-contract.md`
- 修改：`README.md`
- 修改：`docs/usage.md`
- 修改：`docs/mvp-manual-test.md`

- [x] **步骤 1：写入 Agent 门禁流程**

在 Skill 入口前增加“渐进上下文门禁”：首个独立概念问题可简洁回答；第二个同领域不同概念必须先收集上下文；同概念澄清、跨领域与无法可靠归类时不计入，最后一种只询问领域。门禁未通过时禁止正式教学、学习计划、项目结论和 Obsidian 写入预览。

- [x] **步骤 2：写入最小上下文模板**

在输入契约加入：

```yaml
domain: 嵌入式 / FreeRTOS 并发
topicOrQuestion: Queue、Mutex 与 Task Notification 如何选择
objective: 为项目中的事件传递选择正确机制
evidence:
  - path: src/app/message_task.c
    kind: source
```

明确 `objective` 和非空 `evidence` 是门禁放行条件；笔记和材料可在完整学习包补充，受限资料仍不可自动读取。

- [x] **步骤 3：更新用户说明与验收**

README 链接最小模板；使用说明解释四种路径（首问、第二同领域、澄清、跨领域）；人工验收加入 Queue 后问 Mutex、只输出模板、提交目标和源码路径后恢复正式教师协议的步骤。

- [x] **步骤 4：检查并提交**

运行：

```powershell
rg -n "第二个|上下文|quick_answer|context_required|formal_learning" README.md docs skills/learning-workbench
git diff --check
```

预期：全部用户入口遵循同一规则，无空白错误。

提交：

```bash
git add -- README.md docs/usage.md docs/mvp-manual-test.md skills/learning-workbench/SKILL.md skills/learning-workbench/references/input-contract.md
git commit -m "docs: describe progressive learning context gate"
```

### 任务 3：验证、部署与推送

**文件：**

- 修改：`docs/superpowers/plans/2026-09-27-learning-context-gate.md`（勾选已完成项目）
- 修改：`C:/Users/zhang/plugins/learning-workbench/...` 的同路径部署文件（由独立工作树承载）

- [x] **步骤 1：运行完整验证**

```powershell
npm run check
npm test -- --run
py -3 C:\Users\zhang\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py .
```

预期：检查、所有 Vitest 和插件校验均通过。

- [x] **步骤 2：同步部署 worktree 并刷新插件**

先执行 `git -C C:\Users\zhang\plugins\learning-workbench status --short --branch`。仅在干净时快进合并 `codex/learning-workbench-mvp`，再用 `update_plugin_cachebuster.py` 更新部署插件并通过 `codex.exe plugin add learning-workbench@personal` 重装。随后在部署目录重复完整验证；若 worktree 非干净或合并无法快进，停止并报告，不覆盖任何文件。

- [x] **步骤 3：记录验证并推送**

勾选计划完成项，提交计划记录，并运行：

```bash
git push origin codex/learning-workbench-mvp
```

预期：只推送本次设计、实现、文档和验证记录，不强推且不改默认分支。
