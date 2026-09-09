import { appendFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuditStore, AuditStoreError } from "../src/core/audit-store.js";
import type { AuditEvent } from "../src/core/contracts.js";

const temporaryDirectories: string[] = [];

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    sessionId: "session-001",
    mode: "practice",
    providerId: "tutor",
    operation: "read_project",
    result: "ok",
    message: "Read-only practice guidance",
    at: "2026-09-09T00:00:00.000Z",
    ...overrides,
  };
}

async function createStore(): Promise<{ directory: string; store: AuditStore }> {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-audit-"));
  temporaryDirectories.push(directory);
  return { directory, store: new AuditStore(directory) };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("AuditStore", () => {
  it("appends independent JSONL records and reads them by session", async () => {
    const { directory, store } = await createStore();
    await store.append(makeEvent({ sessionId: "session-001" }));
    await store.append(makeEvent({ sessionId: "session-002", operation: "read_diff" }));

    const raw = await readFile(join(directory, "audit.jsonl"), "utf8");
    const lines = raw.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line))).toHaveLength(2);
    await expect(store.read("session-001")).resolves.toHaveLength(1);
    await expect(store.read("session-001")).resolves.toMatchObject([{ sessionId: "session-001" }]);
  });

  it("removes sensitive fields recursively before writing JSONL", async () => {
    const { directory, store } = await createStore();
    const event = {
      ...makeEvent(),
      apiKey: "api-secret-value",
      nested: {
        appSecret: "app-secret-value",
        token: "token-secret-value",
        authorization: "Bearer authorization-secret-value",
      },
      items: [{ refresh_token: "refresh-secret-value", safe: "kept" }],
    } as AuditEvent & Record<string, unknown>;

    await store.append(event);

    const raw = await readFile(join(directory, "audit.jsonl"), "utf8");
    expect(raw).not.toContain("api-secret-value");
    expect(raw).not.toContain("app-secret-value");
    expect(raw).not.toContain("token-secret-value");
    expect(raw).not.toContain("authorization-secret-value");
    expect(raw).not.toContain("refresh-secret-value");
    expect(JSON.parse(raw)).toMatchObject({ nested: {}, items: [{ safe: "kept" }] });
  });

  it("returns a stable corruption error for an invalid JSONL record", async () => {
    const { directory, store } = await createStore();
    await appendFile(join(directory, "audit.jsonl"), "not-json\n", "utf8");

    await expect(store.read("session-001")).rejects.toMatchObject({
      code: "AUDIT_CORRUPT_RECORD",
    } satisfies Partial<AuditStoreError>);
  });

  it("returns a stable append error while preserving the underlying failure", async () => {
    const { directory, store } = await createStore();
    const auditPath = join(directory, "audit.jsonl");
    await mkdir(auditPath);

    const error = await store.append(makeEvent()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuditStoreError);
    expect(error).toMatchObject({ code: "AUDIT_APPEND_FAILED" });
    expect((error as AuditStoreError).cause).toBeDefined();
  });
});
