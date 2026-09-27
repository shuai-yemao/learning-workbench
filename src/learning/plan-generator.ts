import type { LearningGoal, LearningTask } from "./contracts.js";

type TaskTemplate = Pick<LearningTask, "title" | "objective" | "action" | "expectedEvidence">;

function addDays(date: string, offset: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

const PROJECT_TEMPLATE: readonly TaskTemplate[] = [
  {
    title: "建立问题的第一性原理模型",
    objective: "从项目目标倒推不可省略的约束。",
    action: "用自己的话写出该主题的目标、约束、状态和因果；标记哪些结论尚未验证。",
    expectedEvidence: ["一段第一性原理笔记", "至少一个未验证问题"],
  },
  {
    title: "定位真实项目边界",
    objective: "确定代码、配置和硬件证据的边界。",
    action: "定位项目入口、相关配置和可观察证据，区分静态代码结论与目标板结论。",
    expectedEvidence: ["入口和配置路径", "证据等级说明"],
  },
  {
    title: "追踪调用链与数据流",
    objective: "将抽象机制映射到真实执行路径。",
    action: "从入口开始画出调用链、数据流和执行上下文；说明任务、ISR、DMA 或普通函数各自的角色。",
    expectedEvidence: ["调用链", "数据所有权和生命周期说明"],
  },
  {
    title: "执行最小只读实践",
    objective: "通过可观察证据检验机制预测。",
    action: "先预测一次现象，再读取日志、diff、测试结果或已有测量证据验证预测。",
    expectedEvidence: ["预测", "验证结果", "预测与结果差异"],
  },
  {
    title: "分析边界与失败模式",
    objective: "从异常现象反推必要条件。",
    action: "列出至少两个失败模式，并说明它们分别破坏了哪个资源、时序、并发或物理约束。",
    expectedEvidence: ["两个失败模式", "每个失败模式的因果链"],
  },
  {
    title: "完成费曼解释",
    objective: "不依赖术语堆砌地解释机制。",
    action: "用费曼方法向刚接触该主题的同事解释：问题、机制、例子、边界和项目中的实际位置。",
    expectedEvidence: ["一段面向他人的费曼解释", "一个具体项目例子"],
  },
  {
    title: "进行反事实复盘",
    objective: "从对立视角检验知识模型。",
    action: "进行反事实模拟：移除或改变一个关键条件，推演系统会如何变化，并据此更新下一轮任务。",
    expectedEvidence: ["一个反事实问题", "推演结果", "下一步学习调整"],
  },
];

const THEORY_TEMPLATE: readonly TaskTemplate[] = [
  {
    title: "建立概念的第一性原理模型",
    objective: "识别问题、约束、状态与因果。",
    action: "从资料中提炼该概念解决的问题，并用目标、约束、状态和因果重写为自己的模型。",
    expectedEvidence: ["第一性原理笔记", "一个待验证问题"],
  },
  {
    title: "梳理知识关联",
    objective: "建立前置、因果、对照和边界关系。",
    action: "列出前置知识、相邻概念、常见混淆点和适用边界。",
    expectedEvidence: ["关联知识清单", "一个对照概念"],
  },
  {
    title: "用具体例子推演",
    objective: "将抽象模型落到可演算场景。",
    action: "选择一个具体例子，逐步写出状态如何变化以及每个事件的因果。",
    expectedEvidence: ["步骤化推演", "状态变化说明"],
  },
  {
    title: "完成应用练习",
    objective: "验证概念能指导实际判断。",
    action: "完成一个应用练习，并解释每一步为何符合前面的约束与因果模型。",
    expectedEvidence: ["应用练习答案", "原理映射说明"],
  },
  {
    title: "脱离资料回忆",
    objective: "区分短时熟悉与真实掌握。",
    action: "不看资料回答关键问题，并标出无法解释或需要提示的部分。",
    expectedEvidence: ["脱离资料的回答", "薄弱点列表"],
  },
  {
    title: "完成费曼解释",
    objective: "让概念可被他人理解和检验。",
    action: "用费曼方法解释概念的目的、机制、例子和边界，避免只罗列术语。",
    expectedEvidence: ["一段面向他人的费曼解释", "一个生活或工程类比"],
  },
  {
    title: "进行反事实复盘",
    objective: "通过对立视角确认适用条件。",
    action: "提出一个反事实条件，推演结论何时失效，并形成下一轮学习调整。",
    expectedEvidence: ["反事实问题", "结论失效的边界", "下一步学习调整"],
  },
];

export function createSevenDayPlan(
  goal: LearningGoal,
  startOn: string,
  idFactory: () => string = () => crypto.randomUUID(),
): LearningTask[] {
  const template = goal.kind === "project" ? PROJECT_TEMPLATE : THEORY_TEMPLATE;
  return template.map((item, index) => ({
    taskId: idFactory(),
    ...item,
    dueOn: addDays(startOn, index),
    status: "todo",
  }));
}
