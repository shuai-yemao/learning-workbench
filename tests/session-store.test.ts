import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionStore, SessionStoreError } from "../src/core/session-store.js";
import type { SessionRecord } from "../src/core/contracts.js";

const temporaryDirectories: string[] = [];

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const timestamp = new Date("2026-09-09T00:00:00.000Z").toISOString();
  return {
    sessionId: "session-001",
    topic: "TCP byte stream",
    mode: "learn",
    providerIds: ["hammer", "tutor"],
    writePolicy: "project_read_only",
    status: "created",
    reviewItemsPending: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

async function createStore(): Promise<{ directory: string; store: SessionStore }> {
  const directory = await mkdtemp(join(tmpdir(), "learning-workbench-session-"));
  temporaryDirectories.push(directory);
  return { directory, store: new SessionStore(directory) };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SessionStore", () => {
  it("writes and reloads an initial session", async () => {
    const { store } = await createStore();
    const record = makeRecord();

    await store.create(record);

    await expect(store.load(record.sessionId)).resolves.toEqual(record);
  });

  it("writes through a temporary file and rename, leaving no temporary file", async () => {
    const { directory, store } = await createStore();
    const renameOperations: Array<{ from: string; to: string }> = [];
    const observedStore = new SessionStore(directory, {
      rename: async (from, to) => {
        renameOperations.push({ from, to });
        const { rename } = await import("node:fs/promises");
        await rename(from, to);
      },
    });

    await observedStore.create(makeRecord());

    expect(renameOperations).toHaveLength(1);
    expect(renameOperations[0]?.from).toMatch(/\.tmp$/);
    expect(renameOperations[0]?.to).toMatch(/session\.json$/);
    await expect(stat(join(directory, "session.json"))).resolves.toBeDefined();
    await expect(readdir(directory)).resolves.toEqual(["session.json"]);
    await expect(readFile(renameOperations[0]!.from, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("allows the planned learning state transitions", async () => {
    const { store } = await createStore();
    const record = makeRecord();
    await store.create(record);

    for (const next of ["calibrating", "learning", "practicing", "reviewing"] as const) {
      await expect(store.transition(record.sessionId, next)).resolves.toMatchObject({
        sessionId: record.sessionId,
        status: next,
      });
    }
  });

  it("rejects a direct created to published transition", async () => {
    const { store } = await createStore();
    const record = makeRecord();
    await store.create(record);

    await expect(store.transition(record.sessionId, "published")).rejects.toMatchObject({
      code: "INVALID_SESSION_TRANSITION",
    } satisfies Partial<SessionStoreError>);
  });

  it("rejects overwriting a session file whose id does not match", async () => {
    const { store } = await createStore();
    await store.create(makeRecord({ sessionId: "session-existing" }));

    await expect(store.save(makeRecord({ sessionId: "session-other" }))).rejects.toMatchObject({
      code: "SESSION_ID_MISMATCH",
    } satisfies Partial<SessionStoreError>);
  });

  it("keeps createdAt and updatedAt as ISO-8601 strings and refreshes updatedAt on transition", async () => {
    const { store } = await createStore();
    const record = makeRecord();
    await store.create(record);
    const before = await store.load(record.sessionId);
    const transitioned = await store.transition(record.sessionId, "calibrating");

    expect(before?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(before?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(transitioned.createdAt).toBe(record.createdAt);
    expect(transitioned.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(Date.parse(transitioned.updatedAt)).not.toBeNaN();
  });
});
