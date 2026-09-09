import { describe, expect, it } from "vitest";
import {
  canRunOperation,
  confirmedPublishPolicy,
  policyFor,
  type Operation,
} from "../src/core/policy-gate.js";

describe("policy gate", () => {
  it("keeps Practice project operations read-only", () => {
    const policy = policyFor("practice");

    expect(policy.projectSourceWrite).toBe("deny");
    expect(policy.patchGeneration).toBe("deny");
    expect(policy.deliverableExecution).toBe("deny");
    expect(canRunOperation(policy, "read_project")).toBe(true);
    expect(canRunOperation(policy, "read_diff")).toBe(true);
    expect(canRunOperation(policy, "read_test_result")).toBe(true);
    expect(canRunOperation(policy, "apply_patch")).toBe(false);
    expect(canRunOperation(policy, "run_deliverable")).toBe(false);
    expect(canRunOperation(policy, "git_commit")).toBe(false);
    expect(canRunOperation(policy, "flash_target")).toBe(false);
  });

  it("allows learning state and Obsidian notes without allowing source writes", () => {
    const policy = policyFor("practice");

    expect(canRunOperation(policy, "write_learner_state")).toBe(true);
    expect(canRunOperation(policy, "write_obsidian_note")).toBe(true);
    expect(canRunOperation(policy, "apply_patch")).toBe(false);
  });

  it("requires explicit confirmation before Feishu publishing", () => {
    expect(canRunOperation(policyFor("publish"), "write_feishu")).toBe(false);
    expect(confirmedPublishPolicy().remotePublish).toBe("allow");
    expect(canRunOperation(confirmedPublishPolicy(), "write_feishu")).toBe(true);
  });

  it("keeps all non-publish modes from writing to Feishu", () => {
    for (const mode of ["learn", "practice", "review"] as const) {
      expect(canRunOperation(policyFor(mode), "write_feishu")).toBe(false);
    }
  });

  it("rejects unknown operations by default", () => {
    const unknownOperation = "delete_project" as Operation | "delete_project";

    expect(canRunOperation(policyFor("practice"), unknownOperation)).toBe(false);
    expect(canRunOperation(confirmedPublishPolicy(), unknownOperation)).toBe(false);
    expect(canRunOperation(policyFor("practice"), null)).toBe(false);
  });

  it("does not enable project mutation through publish confirmation", () => {
    const policy = confirmedPublishPolicy();

    expect(policy.projectSourceWrite).toBe("deny");
    expect(policy.patchGeneration).toBe("deny");
    expect(policy.deliverableExecution).toBe("deny");
    expect(canRunOperation(policy, "apply_patch")).toBe(false);
    expect(canRunOperation(policy, "git_commit")).toBe(false);
    expect(canRunOperation(policy, "flash_target")).toBe(false);
  });
});
