import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LearningGoalDraft } from "../../src/learning/contracts.js";
import { LearningRepository } from "../../src/learning/learning-repository.js";
import { LearningService } from "../../src/learning/learning-service.js";

const temporaryDirectories: string[] = [];

const draft: LearningGoalDraft = {
  domain: "嵌入式",
  title: "FreeRTOS Queue",
  kind: "project",
  objective: "解释队列阻塞并定位项目调用链",
  successCriteria: ["解释阻塞条件"],
};

async function createService(): Promise<{ vault: string; service: LearningService }> {
  const vault = await mkdtemp(join(tmpdir(), "learning-workbench-service-"));
  temporaryDirectories.push(vault);
  await mkdir(join(vault, "领域", "嵌入式"), { recursive: true });
  let identifier = 0;
  const repository = new LearningRepository(vault, {
    idFactory: () => `goal-${++identifier}`,
    now: () => new Date("2026-09-27T00:00:00.000Z"),
  });
  return {
    vault,
    service: new LearningService(repository, {
      idFactory: () => `item-${++identifier}`,
      now: () => new Date("2026-09-27T00:00:00.000Z"),
    }),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("LearningService", () => {
  it("starts a seven-day plan and turns a weak submission into review plus remediation", async () => {
    const { vault, service } = await createService();
    const started = await service.start(draft, "2026-09-27");
    const firstTask = started.tasks[0]!;

    const updated = await service.submit("嵌入式", "freertos-queue", {
      taskId: firstTask.taskId,
      reflectionMarkdown: "队列是有界缓冲区；我还不能解释阻塞列表。",
      evidencePaths: ["附件/手写时序图.jpg"],
      mastery: 0,
    }, "2026-09-27");

    expect(updated.tasks.find((task) => task.taskId === firstTask.taskId)).toMatchObject({ status: "completed" });
    expect(updated.reviews).toContainEqual(expect.objectContaining({
      taskId: firstTask.taskId,
      dueOn: "2026-09-28",
      status: "due",
    }));
    expect(updated.tasks).toContainEqual(expect.objectContaining({
      title: `补救：${firstTask.title}`,
      dueOn: "2026-09-28",
      status: "todo",
    }));
    await expect(readFile(join(vault, "领域", "嵌入式", "学习台", "freertos-queue", "04-复习队列.md"), "utf8"))
      .resolves.toContain("2026-09-28");
    await expect(readFile(join(vault, "领域", "嵌入式", "学习台", "freertos-queue", "学习记录", `2026-09-27-${firstTask.taskId}.md`), "utf8"))
      .resolves.toContain("我还不能解释阻塞列表");
  });

  it("keeps a blocked task open while scheduling its recovery work", async () => {
    const { service } = await createService();
    const started = await service.start(draft, "2026-09-27");
    const firstTask = started.tasks[0]!;

    const updated = await service.submit("嵌入式", "freertos-queue", {
      taskId: firstTask.taskId,
      reflectionMarkdown: "缺少目标板日志，无法确认时序。",
      evidencePaths: [],
      mastery: 1,
      blockedReason: "等待串口日志",
    }, "2026-09-27");

    expect(updated.tasks.find((task) => task.taskId === firstTask.taskId)).toMatchObject({ status: "blocked" });
    expect(updated.tasks).toContainEqual(expect.objectContaining({ title: `补救：${firstTask.title}` }));
  });
});
