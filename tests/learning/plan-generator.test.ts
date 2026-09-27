import { describe, expect, it } from "vitest";
import type { LearningGoal } from "../../src/learning/contracts.js";
import { createSevenDayPlan } from "../../src/learning/plan-generator.js";

const goal: LearningGoal = {
  goalId: "goal-001",
  domain: "嵌入式",
  title: "FreeRTOS Queue",
  slug: "freertos-queue",
  kind: "project",
  objective: "解释阻塞条件并定位实际调用链",
  successCriteria: ["解释阻塞条件"],
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
};

describe("seven-day learning plans", () => {
  it("generates a project plan that ties first principles to project evidence", () => {
    const tasks = createSevenDayPlan(goal, "2026-09-27", () => "task-001");

    expect(tasks).toHaveLength(7);
    expect(tasks[0]).toMatchObject({ dueOn: "2026-09-27", status: "todo" });
    expect(tasks[0]?.action).toContain("目标、约束、状态和因果");
    expect(tasks[2]?.action).toContain("调用链");
    expect(tasks[5]?.action).toContain("费曼");
    expect(tasks[6]?.action).toContain("反事实");
  });

  it("generates a theory plan with the same evidence and explanation discipline", () => {
    const tasks = createSevenDayPlan({ ...goal, kind: "theory" }, "2026-09-27", () => "task-002");

    expect(tasks).toHaveLength(7);
    expect(tasks[3]?.action).toContain("应用练习");
    expect(tasks[5]?.expectedEvidence).toContain("一段面向他人的费曼解释");
  });
});
