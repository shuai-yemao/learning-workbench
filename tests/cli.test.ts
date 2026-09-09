import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
