import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LearningPathError,
  resolveDomainDirectory,
  resolveGoalDirectory,
} from "../../src/learning/domain-path.js";

const temporaryDirectories: string[] = [];

async function createVault(): Promise<string> {
  const vault = await mkdtemp(join(tmpdir(), "learning-workbench-vault-"));
  temporaryDirectories.push(vault);
  await mkdir(join(vault, "领域", "嵌入式"), { recursive: true });
  return vault;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Vault learning paths", () => {
  it("resolves an existing domain below the configured Vault domain root", async () => {
    const vault = await createVault();

    await expect(resolveDomainDirectory(vault, "嵌入式"))
      .resolves.toBe(join(vault, "领域", "嵌入式"));
  });

  it("rejects a missing domain instead of creating it", async () => {
    const vault = await createVault();

    await expect(resolveDomainDirectory(vault, "不存在的领域"))
      .rejects.toMatchObject({ code: "DOMAIN_NOT_FOUND" } satisfies Partial<LearningPathError>);
  });

  it("rejects a goal slug that tries to escape the selected domain", async () => {
    const vault = await createVault();

    await expect(resolveGoalDirectory(vault, "嵌入式", "../outside"))
      .rejects.toMatchObject({ code: "GOAL_PATH_OUTSIDE_DOMAIN" } satisfies Partial<LearningPathError>);
  });
});
