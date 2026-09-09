import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditEvent } from "./contracts.js";

export type AuditStoreErrorCode = "AUDIT_APPEND_FAILED" | "AUDIT_READ_FAILED" | "AUDIT_CORRUPT_RECORD";

export class AuditStoreError extends Error {
  readonly code: AuditStoreErrorCode;

  constructor(code: AuditStoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AuditStoreError";
    this.code = code;
  }
}

const SENSITIVE_KEY = /(?:apikey|appsecret|token|authorization|clientsecret|password|cookie|credential)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (!SENSITIVE_KEY.test(key.replace(/[_-]/g, ""))) {
        sanitized[key] = sanitize(nested);
      }
    }
    return sanitized;
  }

  return value;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export class AuditStore {
  private readonly auditPath: string;

  constructor(private readonly directory: string) {
    this.auditPath = join(directory, "audit.jsonl");
  }

  async append(event: AuditEvent): Promise<void> {
    try {
      await mkdir(this.directory, { recursive: true });
      const sanitized = sanitize(event);
      await appendFile(this.auditPath, `${JSON.stringify(sanitized)}\n`, "utf8");
    } catch (error) {
      throw new AuditStoreError("AUDIT_APPEND_FAILED", "Unable to append the audit event.", { cause: error });
    }
  }

  async read(sessionId: string): Promise<AuditEvent[]> {
    let raw: string;
    try {
      raw = await readFile(this.auditPath, "utf8");
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }
      throw new AuditStoreError("AUDIT_READ_FAILED", "Unable to read audit.jsonl.", { cause: error });
    }

    const events: AuditEvent[] = [];
    for (const [index, line] of raw.split(/\r?\n/).entries()) {
      if (line.trim().length === 0) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        throw new AuditStoreError("AUDIT_CORRUPT_RECORD", `Invalid JSONL record at line ${index + 1}.`, { cause: error });
      }

      if (typeof parsed !== "object" || parsed === null || !("sessionId" in parsed)) {
        throw new AuditStoreError("AUDIT_CORRUPT_RECORD", `Invalid audit record at line ${index + 1}.`);
      }

      const event = parsed as AuditEvent;
      if (event.sessionId === sessionId) {
        events.push(event);
      }
    }
    return events;
  }
}
