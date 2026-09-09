import { mkdir, readFile, rename as fsRename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionRecord, SessionStatus } from "./contracts.js";

export type AtomicRename = (from: string, to: string) => Promise<void>;

export interface SessionStoreOptions {
  rename?: AtomicRename;
  now?: () => Date;
}

export type SessionStoreErrorCode =
  | "SESSION_ID_MISMATCH"
  | "SESSION_EXISTS"
  | "SESSION_NOT_FOUND"
  | "SESSION_CORRUPT"
  | "SESSION_READ_FAILED"
  | "SESSION_WRITE_FAILED"
  | "INVALID_SESSION_RECORD"
  | "INVALID_SESSION_TRANSITION";

export class SessionStoreError extends Error {
  readonly code: SessionStoreErrorCode;

  constructor(code: SessionStoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SessionStoreError";
    this.code = code;
  }
}

const ALLOWED_TRANSITIONS: Readonly<Record<SessionStatus, ReadonlySet<SessionStatus>>> = {
  created: new Set(["calibrating"]),
  calibrating: new Set(["learning"]),
  learning: new Set(["practicing"]),
  practicing: new Set(["reviewing"]),
  reviewing: new Set(["awaiting_publish_confirmation"]),
  awaiting_publish_confirmation: new Set(["published"]),
  published: new Set(),
  provider_unavailable: new Set(["session_paused", "calibrating"]),
  write_denied: new Set(["session_paused", "calibrating"]),
  publish_failed: new Set(["awaiting_publish_confirmation", "session_paused"]),
  session_paused: new Set(["calibrating", "learning", "practicing", "reviewing"]),
};

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isIso8601(value: unknown): value is string {
  return typeof value === "string" && ISO_8601_UTC.test(value) && !Number.isNaN(Date.parse(value));
}

function validateRecord(record: SessionRecord): void {
  if (!record || typeof record !== "object" || typeof record.sessionId !== "string" || record.sessionId.length === 0) {
    throw new SessionStoreError("INVALID_SESSION_RECORD", "Session record must contain a non-empty sessionId.");
  }

  if (!isIso8601(record.createdAt) || !isIso8601(record.updatedAt)) {
    throw new SessionStoreError("INVALID_SESSION_RECORD", "Session timestamps must be ISO-8601 UTC strings.");
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export class SessionStore {
  private readonly sessionPath: string;
  private readonly rename: AtomicRename;
  private readonly now: () => Date;

  constructor(private readonly directory: string, options: SessionStoreOptions = {}) {
    this.sessionPath = join(directory, "session.json");
    this.rename = options.rename ?? fsRename;
    this.now = options.now ?? (() => new Date());
  }

  async load(sessionId: string): Promise<SessionRecord | null> {
    let raw: string;
    try {
      raw = await readFile(this.sessionPath, "utf8");
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }
      throw new SessionStoreError("SESSION_READ_FAILED", "Unable to read session.json.", { cause: error });
    }

    let record: SessionRecord;
    try {
      record = JSON.parse(raw) as SessionRecord;
    } catch (error) {
      throw new SessionStoreError("SESSION_CORRUPT", "session.json is not valid JSON.", { cause: error });
    }

    validateRecord(record);
    if (record.sessionId !== sessionId) {
      throw new SessionStoreError("SESSION_ID_MISMATCH", "The stored session ID does not match the requested session ID.");
    }
    return record;
  }

  async create(record: SessionRecord): Promise<void> {
    validateRecord(record);
    await mkdir(this.directory, { recursive: true });

    try {
      const existing = await readFile(this.sessionPath, "utf8");
      const existingRecord = JSON.parse(existing) as SessionRecord;
      if (existingRecord.sessionId !== record.sessionId) {
        throw new SessionStoreError("SESSION_ID_MISMATCH", "Cannot create over a different session ID.");
      }
      throw new SessionStoreError("SESSION_EXISTS", "The session already exists.");
    } catch (error) {
      if (error instanceof SessionStoreError) {
        throw error;
      }
      if (!isMissingFile(error)) {
        throw new SessionStoreError("SESSION_READ_FAILED", "Unable to inspect the existing session.", { cause: error });
      }
    }

    await this.atomicWrite(record);
  }

  async save(record: SessionRecord): Promise<void> {
    validateRecord(record);
    await mkdir(this.directory, { recursive: true });

    try {
      const existing = await readFile(this.sessionPath, "utf8");
      const existingRecord = JSON.parse(existing) as SessionRecord;
      if (existingRecord.sessionId !== record.sessionId) {
        throw new SessionStoreError("SESSION_ID_MISMATCH", "Cannot overwrite a different session ID.");
      }
    } catch (error) {
      if (error instanceof SessionStoreError) {
        throw error;
      }
      if (!isMissingFile(error)) {
        throw new SessionStoreError("SESSION_READ_FAILED", "Unable to inspect the existing session.", { cause: error });
      }
    }

    await this.atomicWrite(record);
  }

  async transition(sessionId: string, next: SessionStatus): Promise<SessionRecord> {
    const current = await this.load(sessionId);
    if (!current) {
      throw new SessionStoreError("SESSION_NOT_FOUND", "The session does not exist.");
    }

    if (!ALLOWED_TRANSITIONS[current.status].has(next)) {
      throw new SessionStoreError(
        "INVALID_SESSION_TRANSITION",
        `Cannot transition session from ${current.status} to ${next}.`,
      );
    }

    const updated: SessionRecord = {
      ...current,
      status: next,
      updatedAt: this.now().toISOString(),
    };
    await this.save(updated);
    return updated;
  }

  private async atomicWrite(record: SessionRecord): Promise<void> {
    const temporaryPath = `${this.sessionPath}.${process.pid}.${Date.now()}.tmp`;
    const serialized = `${JSON.stringify(record, null, 2)}\n`;

    try {
      await writeFile(temporaryPath, serialized, "utf8");
      try {
        await this.rename(temporaryPath, this.sessionPath);
      } catch (error) {
        // Windows may reject replacing an existing file with rename. Move the
        // old complete file aside, then restore it if the replacement fails.
        if (!this.isReplaceConflict(error)) {
          throw error;
        }

        const backupPath = `${this.sessionPath}.${process.pid}.${Date.now()}.bak`;
        await this.rename(this.sessionPath, backupPath);
        try {
          await this.rename(temporaryPath, this.sessionPath);
        } catch (replacementError) {
          await this.rename(backupPath, this.sessionPath).catch(() => undefined);
          throw replacementError;
        }
        await rm(backupPath, { force: true });
      }
    } catch (error) {
      if (error instanceof SessionStoreError) {
        throw error;
      }
      throw new SessionStoreError("SESSION_WRITE_FAILED", "Unable to atomically save session.json.", { cause: error });
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  private isReplaceConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error &&
      ["EEXIST", "EPERM", "ENOTEMPTY"].includes(String(error.code));
  }
}
