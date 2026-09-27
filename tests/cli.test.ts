import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CLI", () => {
  it("starts and reads a local practice session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "learning-workbench-cli-"));
    directories.push(directory);
    const previous = process.env.LEARNING_WORKBENCH_DATA_DIR;
    process.env.LEARNING_WORKBENCH_DATA_DIR = directory;
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value: unknown) => output.push(String(value)));

    try {
      await runCli(["session", "start", "--topic", "FreeRTOS queue", "--mode", "practice"]);
      const payload = JSON.parse(output[0]!) as { session: { sessionId: string; mode: string } };
      expect(payload.session.mode).toBe("practice");
      output.length = 0;
      await runCli(["session", "status", payload.session.sessionId]);
      expect(JSON.parse(output[0]!).session.sessionId).toBe(payload.session.sessionId);
      expect((await readFile(join(directory, "session.json"), "utf8")).length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.LEARNING_WORKBENCH_DATA_DIR;
      else process.env.LEARNING_WORKBENCH_DATA_DIR = previous;
    }
  });

  it("previews a learning archive before an explicit confirmation writes it to the Vault", async () => {
    const vault = await mkdtemp(join(tmpdir(), "learning-workbench-vault-cli-"));
    const inputDirectory = await mkdtemp(join(tmpdir(), "learning-workbench-input-cli-"));
    directories.push(vault, inputDirectory);
    await mkdir(join(vault, "领域", "嵌入式"), { recursive: true });
    const inputPath = join(inputDirectory, "goal.json");
    await writeFile(inputPath, JSON.stringify({
      domain: "嵌入式",
      title: "FreeRTOS Queue",
      kind: "project",
      objective: "解释阻塞条件并定位调用链",
      successCriteria: ["完成费曼解释"],
    }), "utf8");
    const previousVault = process.env.LEARNING_WORKBENCH_VAULT;
    process.env.LEARNING_WORKBENCH_VAULT = vault;
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value: unknown) => output.push(String(value)));

    try {
      await runCli(["learning", "create", "--input", inputPath, "--start-on", "2026-09-27"]);
      expect(JSON.parse(output[0]!)).toMatchObject({ status: "awaiting_write_confirmation" });
      await expect(readFile(join(vault, "领域", "嵌入式", "学习台", "freertos-queue", ".learning-workbench", "state.json"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });

      output.length = 0;
      await runCli(["learning", "create", "--input", inputPath, "--start-on", "2026-09-27", "--confirm-write"]);
      const created = JSON.parse(output[0]!) as { state: { tasks: Array<{ taskId: string }> } };
      expect(created).toMatchObject({
        status: "written",
        state: { goal: { slug: "freertos-queue" }, tasks: expect.any(Array) },
      });

      const submissionPath = join(inputDirectory, "submission.json");
      await writeFile(submissionPath, JSON.stringify({
        taskId: created.state.tasks[0]!.taskId,
        reflectionMarkdown: "我能解释队列满时发送者等待空间。",
        evidencePaths: ["附件/手写图.jpg"],
        mastery: 2,
      }), "utf8");
      output.length = 0;
      await runCli([
        "learning", "submit", "--domain", "嵌入式", "--slug", "freertos-queue",
        "--input", submissionPath, "--completed-on", "2026-09-27",
      ]);
      expect(JSON.parse(output[0]!)).toMatchObject({ status: "awaiting_write_confirmation" });

      output.length = 0;
      await runCli([
        "learning", "submit", "--domain", "嵌入式", "--slug", "freertos-queue",
        "--input", submissionPath, "--completed-on", "2026-09-27", "--confirm-write",
      ]);
      expect(JSON.parse(output[0]!)).toMatchObject({
        status: "written",
        state: { reviews: [expect.objectContaining({ dueOn: "2026-09-30" })] },
      });

      output.length = 0;
      await runCli(["learning", "due", "--domain", "嵌入式", "--slug", "freertos-queue", "--date", "2026-09-30"]);
      expect(JSON.parse(output[0]!)).toMatchObject({
        reviews: [expect.objectContaining({ dueOn: "2026-09-30" })],
      });
    } finally {
      if (previousVault === undefined) delete process.env.LEARNING_WORKBENCH_VAULT;
      else process.env.LEARNING_WORKBENCH_VAULT = previousVault;
    }
  });
});
