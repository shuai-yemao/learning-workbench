import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProviderManifest, ProviderRequest, ProviderResult } from "../src/core/contracts.js";
import { AuditStore } from "../src/core/audit-store.js";
import { policyFor, type ExecutionPolicy } from "../src/core/policy-gate.js";
import { SessionStore } from "../src/core/session-store.js";
import {
  SessionOrchestrator,
  type LearningInput,
  type PracticeInput,
  type PublishConfirmation,
  type PublishTarget,
  type ReviewInput,
} from "../src/core/session-orchestrator.js";

const directories: string[] = [];

const providers: ProviderManifest[] = [
  {
    id: "hammer",
    source: "https://github.com/example/hammer",
    revision: "a".repeat(40),
    capability: "tutoring_and_review",
    required: true,
    writeScope: "learner_state_only",
  },
  {
    id: "tutor",
    source: "https://github.com/example/tutor",
    revision: "b".repeat(40),
    capability: "read_only_practice_guidance",
    required: true,
    writeScope: "none",
    version: "v0.6",
  },
  {
    id: "obsidian-skills",
    source: "https://github.com/example/obsidian-skills",
    revision: "c".repeat(40),
    capability: "note_and_session_output",
    required: false,
    writeScope: "vault_notes_only",
  },
  {
    id: "lark-cli",
    source: "https://github.com/example/lark-cli",
    revision: "d".repeat(40),
    capability: "document_publish",
    required: false,
    writeScope: "remote_documents_after_confirmation",
  },
];

function makeResult(providerId: string, overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    providerId,
    status: "ok",
    message: "ok",
    artifacts: [`${providerId}-artifact`],
    ...overrides,
  };
}

async function makeOrchestrator(invoke: (providerId: string, request: ProviderRequest, policy: ExecutionPolicy) => Promise<ProviderResult> = async (providerId) => makeResult(providerId)) {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-orchestrator-"));
  directories.push(directory);
  const calls: Array<{ providerId: string; request: ProviderRequest; policy: ExecutionPolicy }> = [];
  const orchestrator = new SessionOrchestrator({
    providers,
    invoker: {
      invoke: async (provider, request, policy) => {
        calls.push({ providerId: provider.id, request, policy });
        return invoke(provider.id, request, policy);
      },
    },
    sessionStore: new SessionStore(directory),
    auditStore: new AuditStore(directory),
    idFactory: () => `session-${calls.length + 1}`,
    now: () => new Date("2026-09-09T00:00:00.000Z"),
  });
  return { orchestrator, calls, sessionStore: new SessionStore(directory), auditStore: new AuditStore(directory) };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SessionOrchestrator", () => {
  it("learn only invokes hammer", async () => {
    const { orchestrator, calls } = await makeOrchestrator();
    const session = await orchestrator.startSession({ topic: "FreeRTOS queue", mode: "learn" });

    await orchestrator.runLearn(session.sessionId, {
      prompt: "Explain queue ownership",
      outputContract: "lesson-and-review-items",
    } satisfies LearningInput);

    expect(calls.map((call) => call.providerId)).toEqual(["hammer"]);
  });

  it("practice only invokes tutor with a read-only policy", async () => {
    const { orchestrator, calls } = await makeOrchestrator();
    const session = await orchestrator.startSession({ topic: "TCP byte stream", mode: "practice" });

    await orchestrator.runPractice(session.sessionId, {
      prompt: "Guide me through a socket exercise",
      outputContract: "questions-and-hints",
    } satisfies PracticeInput);

    expect(calls.map((call) => call.providerId)).toEqual(["tutor"]);
    expect(calls[0]?.policy).toEqual(policyFor("practice"));
    expect(calls[0]?.policy.projectSourceWrite).toBe("deny");
    expect(calls[0]?.policy.patchGeneration).toBe("deny");
    expect(calls[0]?.policy.deliverableExecution).toBe("deny");
  });

  it("review invokes hammer", async () => {
    const { orchestrator, calls } = await makeOrchestrator();
    const session = await orchestrator.startSession({ topic: "TCP byte stream", mode: "review" });

    await orchestrator.runReview(session.sessionId, {
      prompt: "Review my understanding",
      outputContract: "review-items",
    } satisfies ReviewInput);

    expect(calls.map((call) => call.providerId)).toEqual(["hammer"]);
  });

  it("creates a local publish draft before calling Obsidian or Feishu", async () => {
    const { orchestrator, calls } = await makeOrchestrator();
    const session = await orchestrator.startSession({ topic: "FreeRTOS queue", mode: "publish" });

    const draft = await orchestrator.preparePublish(session.sessionId);
    expect(draft.content).toContain("FreeRTOS queue");
    expect(calls).toHaveLength(0);

    const confirmation: PublishConfirmation = { confirmed: true };
    const target: PublishTarget = "obsidian";
    await orchestrator.publish(session.sessionId, target, confirmation);
    expect(calls.map((call) => call.providerId)).toEqual(["obsidian-skills"]);

    const { orchestrator: feishuOrchestrator, calls: feishuCalls } = await makeOrchestrator();
    const feishuSession = await feishuOrchestrator.startSession({ topic: "FreeRTOS queue", mode: "publish" });
    await feishuOrchestrator.preparePublish(feishuSession.sessionId);
    await feishuOrchestrator.publish(feishuSession.sessionId, "feishu", confirmation);
    expect(feishuCalls.map((call) => call.providerId)).toEqual(["lark-cli"]);
  });

  it("keeps the session published when an optional Provider fails", async () => {
    const { orchestrator, sessionStore } = await makeOrchestrator(async (providerId) =>
      makeResult(providerId, { status: "failed", message: "apiToken=secret-value" }),
    );
    const session = await orchestrator.startSession({ topic: "FreeRTOS queue", mode: "publish" });
    await orchestrator.preparePublish(session.sessionId);

    const result = await orchestrator.publish(session.sessionId, "obsidian", { confirmed: true });
    expect(result.status).toBe("failed");
    await expect(sessionStore.load(session.sessionId)).resolves.toMatchObject({ status: "published" });
  });

  it("moves the session to provider_unavailable when a required Provider fails", async () => {
    const { orchestrator, sessionStore } = await makeOrchestrator(async (providerId) =>
      makeResult(providerId, { status: "unavailable", message: "provider secret should not enter audit" }),
    );
    const session = await orchestrator.startSession({ topic: "FreeRTOS queue", mode: "learn" });

    const result = await orchestrator.runLearn(session.sessionId, {
      prompt: "Explain queue ownership",
      outputContract: "lesson-and-review-items",
    });
    expect(result.status).toBe("unavailable");
    await expect(sessionStore.load(session.sessionId)).resolves.toMatchObject({ status: "provider_unavailable" });
  });

  it("does not invoke a Provider when the policy gate rejects publishing", async () => {
    const { orchestrator, calls, auditStore } = await makeOrchestrator();
    const session = await orchestrator.startSession({ topic: "FreeRTOS queue", mode: "publish" });
    await orchestrator.preparePublish(session.sessionId);

    const result = await orchestrator.publish(session.sessionId, "feishu", { confirmed: false });
    expect(result.status).toBe("denied");
    expect(calls).toHaveLength(0);
    await expect(auditStore.read(session.sessionId)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ result: "denied" })]),
    );
  });

  it("does not persist Provider messages or secrets in audit records", async () => {
    const { orchestrator, auditStore } = await makeOrchestrator(async (providerId) =>
      makeResult(providerId, { status: "failed", message: "apiToken=secret-value" }),
    );
    const session = await orchestrator.startSession({ topic: "FreeRTOS queue", mode: "learn" });
    await orchestrator.runLearn(session.sessionId, {
      prompt: "Explain queue ownership",
      outputContract: "lesson-and-review-items",
    });

    const audit = await auditStore.read(session.sessionId);
    expect(JSON.stringify(audit)).not.toContain("secret-value");
    expect(JSON.stringify(audit)).not.toContain("apiToken");
  });
});
