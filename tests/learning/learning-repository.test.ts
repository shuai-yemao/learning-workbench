import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LearningGoalDraft } from "../../src/learning/contracts.js";
import { LearningRepository, LearningRepositoryError } from "../../src/learning/learning-repository.js";

const temporaryDirectories: string[] = [];

const draft: LearningGoalDraft = {
  domain: "嵌入式",
  title: "FreeRTOS Queue",
  kind: "project",
  objective: "解释队列阻塞并定位项目调用链",
  successCriteria: ["解释阻塞条件", "定位发送和接收调用点"],
};

async function createRepository(): Promise<{ vault: string; repository: LearningRepository }> {
  const vault = await mkdtemp(join(tmpdir(), "learning-workbench-repository-"));
  temporaryDirectories.push(vault);
  await mkdir(join(vault, "领域", "嵌入式"), { recursive: true });
  return {
    vault,
    repository: new LearningRepository(vault, {
      idFactory: () => "goal-001",
      now: () => new Date("2026-09-27T00:00:00.000Z"),
    }),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("LearningRepository", () => {
  it("creates a complete Markdown learning archive and reloads its state", async () => {
    const { vault, repository } = await createRepository();

    const created = await repository.createGoal(draft);
    const directory = join(vault, "领域", "嵌入式", "学习台", "freertos-queue");

    expect(created).toMatchObject({ goalId: "goal-001", slug: "freertos-queue" });
    await expect(readFile(join(directory, "00-学习总览.md"), "utf8"))
      .resolves.toContain("解释队列阻塞并定位项目调用链");
    await expect(readFile(join(directory, "01-材料索引.md"), "utf8")).resolves.toContain("# 材料索引");
    await expect(readFile(join(directory, "02-学习计划.md"), "utf8")).resolves.toContain("# 学习计划");
    await expect(readFile(join(directory, "03-今日任务.md"), "utf8")).resolves.toContain("# 今日任务");
    await expect(readFile(join(directory, "04-复习队列.md"), "utf8")).resolves.toContain("# 复习队列");
    await expect(repository.load("嵌入式", "freertos-queue"))
      .resolves.toMatchObject({ goal: { goalId: "goal-001", title: "FreeRTOS Queue" } });
  });

  it("refuses to overwrite an existing learning goal directory", async () => {
    const { repository } = await createRepository();
    await repository.createGoal(draft);

    await expect(repository.createGoal(draft))
      .rejects.toMatchObject({ code: "GOAL_ALREADY_EXISTS" } satisfies Partial<LearningRepositoryError>);
  });

  it("rejects a state file that is missing the submission history", async () => {
    const { vault, repository } = await createRepository();
    await repository.createGoal(draft);
    const statePath = join(vault, "领域", "嵌入式", "学习台", "freertos-queue", ".learning-workbench", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
    delete state.submissions;
    await writeFile(statePath, JSON.stringify(state), "utf8");

    await expect(repository.load("嵌入式", "freertos-queue"))
      .rejects.toMatchObject({ code: "LEARNING_STATE_CORRUPT" } satisfies Partial<LearningRepositoryError>);
  });
});
