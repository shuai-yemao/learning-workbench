import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProviderManifest, ProviderRequest, ProviderResult } from "../../src/core/contracts.js";
import { AuditStore } from "../../src/core/audit-store.js";
import { policyFor, type ExecutionPolicy } from "../../src/core/policy-gate.js";
import { SessionOrchestrator } from "../../src/core/session-orchestrator.js";
import { SessionStore } from "../../src/core/session-store.js";

const directories: string[] = [];
const providers: ProviderManifest[] = [
  { id: "hammer", source: "https://github.com/example/hammer", revision: "a".repeat(40), capability: "tutoring_and_review", required: true, writeScope: "learner_state_only" },
  { id: "tutor", source: "https://github.com/example/tutor", revision: "b".repeat(40), capability: "read_only_practice_guidance", required: true, writeScope: "none", version: "v0.6" },
  { id: "obsidian-skills", source: "https://github.com/example/obsidian-skills", revision: "c".repeat(40), capability: "note_and_session_output", required: false, writeScope: "vault_notes_only" },
  { id: "lark-cli", source: "https://github.com/example/lark-cli", revision: "d".repeat(40), capability: "document_publish", required: false, writeScope: "remote_documents_after_confirmation" },
];

async function makeHarness(
  invoke: (provider: ProviderManifest, request: ProviderRequest, policy: ExecutionPolicy) => Promise<ProviderResult>,
) {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-e2e-"));
  directories.push(directory);
  const sessionStore = new SessionStore(directory);
  const auditStore = new AuditStore(directory);
  return {
    sessionStore,
    orchestrator: new SessionOrchestrator({
      providers,
      sessionStore,
      auditStore,
      idFactory: () => "e2e-session",
      now: () => new Date("2026-09-10T00:00:00.000Z"),
      invoker: { invoke },
    }),
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("learning workbench MVP flow", () => {
  it("learn calls hammer and persists a review item", async () => {
    const calls: string[] = [];
    const harness = await makeHarness(async (provider) => {
      calls.push(provider.id);
      return { providerId: provider.id, status: "ok", message: "lesson", artifacts: ["review-item"] };
    });
    const session = await harness.orchestrator.startSession({ topic: "FreeRTOS queue", mode: "learn" });
    await harness.orchestrator.runLearn(session.sessionId, { prompt: "teach", outputContract: "lesson" });
    await expect(harness.sessionStore.load(session.sessionId)).resolves.toMatchObject({ reviewItemsPending: 1 });
    expect(calls).toEqual(["hammer"]);
  });

  it("practice calls tutor with a read-only policy", async () => {
    let received: ExecutionPolicy | undefined;
    const harness = await makeHarness(async (provider, _request, policy) => {
      received = policy;
      return { providerId: provider.id, status: "ok", message: "guided", artifacts: [] };
    });
    const session = await harness.orchestrator.startSession({ topic: "TCP", mode: "practice" });
    await harness.orchestrator.runPractice(session.sessionId, { prompt: "guide", outputContract: "hints" });
    expect(received).toEqual(policyFor("practice"));
    expect(received && received.projectSourceWrite).toBe("deny");
    expect(received && received.patchGeneration).toBe("deny");
    expect(received && received.deliverableExecution).toBe("deny");
  });

  it("keeps the local session published when the Obsidian sink fails", async () => {
    const harness = await makeHarness(async (provider) => ({ providerId: provider.id, status: "failed", message: "sink failed", artifacts: [] }));
    const session = await harness.orchestrator.startSession({ topic: "queue", mode: "publish" });
    await harness.orchestrator.preparePublish(session.sessionId);
    await harness.orchestrator.publish(session.sessionId, "obsidian", { confirmed: true });
    await expect(harness.sessionStore.load(session.sessionId)).resolves.toMatchObject({ status: "published" });
  });

  it("requires confirmation and records Feishu publish failure", async () => {
    const calls: string[] = [];
    const harness = await makeHarness(async (provider) => {
      calls.push(provider.id);
      return { providerId: provider.id, status: "failed", message: "remote sink failed", artifacts: [] };
    });
    const session = await harness.orchestrator.startSession({ topic: "queue", mode: "publish" });
    await harness.orchestrator.preparePublish(session.sessionId);
    const denied = await harness.orchestrator.publish(session.sessionId, "feishu", { confirmed: false });
    expect(denied.status).toBe("denied");
    expect(calls).toEqual([]);
    await harness.orchestrator.publish(session.sessionId, "feishu", { confirmed: true });
    expect(calls).toEqual(["lark-cli"]);
    await expect(harness.sessionStore.load(session.sessionId)).resolves.toMatchObject({ status: "publish_failed" });
  });
});
