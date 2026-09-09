import type { Mode } from "./contracts.js";

export type Operation =
  | "read_project"
  | "read_diff"
  | "read_test_result"
  | "write_learner_state"
  | "write_obsidian_note"
  | "write_feishu"
  | "apply_patch"
  | "run_deliverable"
  | "git_commit"
  | "flash_target";

export interface ExecutionPolicy {
  projectSourceWrite: "allow" | "deny";
  patchGeneration: "allow" | "deny";
  deliverableExecution: "allow" | "deny";
  remotePublish: "ask" | "allow" | "deny";
}

const READ_OPERATIONS: ReadonlySet<Operation> = new Set([
  "read_project",
  "read_diff",
  "read_test_result",
]);

const ALWAYS_ALLOWED_OPERATIONS: ReadonlySet<Operation> = new Set([
  ...READ_OPERATIONS,
  "write_learner_state",
  "write_obsidian_note",
]);

const DENIED_SIDE_EFFECT_OPERATIONS: ReadonlySet<Operation> = new Set([
  "git_commit",
  "flash_target",
]);

const PRACTICE_POLICY: ExecutionPolicy = Object.freeze({
  projectSourceWrite: "deny",
  patchGeneration: "deny",
  deliverableExecution: "deny",
  remotePublish: "deny",
});

const LEARN_POLICY: ExecutionPolicy = Object.freeze({
  projectSourceWrite: "deny",
  patchGeneration: "deny",
  deliverableExecution: "deny",
  remotePublish: "deny",
});

const REVIEW_POLICY: ExecutionPolicy = Object.freeze({
  projectSourceWrite: "deny",
  patchGeneration: "deny",
  deliverableExecution: "deny",
  remotePublish: "deny",
});

const PUBLISH_POLICY: ExecutionPolicy = Object.freeze({
  projectSourceWrite: "deny",
  patchGeneration: "deny",
  deliverableExecution: "deny",
  remotePublish: "ask",
});

const CONFIRMED_PUBLISH_POLICY: ExecutionPolicy = Object.freeze({
  projectSourceWrite: "deny",
  patchGeneration: "deny",
  deliverableExecution: "deny",
  remotePublish: "allow",
});

export function policyFor(mode: Mode): ExecutionPolicy {
  switch (mode) {
    case "learn":
      return LEARN_POLICY;
    case "practice":
      return PRACTICE_POLICY;
    case "review":
      return REVIEW_POLICY;
    case "publish":
      return PUBLISH_POLICY;
  }
}

export function confirmedPublishPolicy(): ExecutionPolicy {
  return CONFIRMED_PUBLISH_POLICY;
}

export function canRunOperation(policy: ExecutionPolicy, operation: unknown): boolean {
  if (typeof operation !== "string") {
    return false;
  }

  if (ALWAYS_ALLOWED_OPERATIONS.has(operation as Operation)) {
    return true;
  }

  if (operation === "write_feishu") {
    return policy.remotePublish === "allow";
  }

  if (operation === "apply_patch") {
    return policy.projectSourceWrite === "allow" && policy.patchGeneration === "allow";
  }

  if (operation === "run_deliverable") {
    return policy.deliverableExecution === "allow";
  }

  if (DENIED_SIDE_EFFECT_OPERATIONS.has(operation as Operation)) {
    return false;
  }

  return false;
}
