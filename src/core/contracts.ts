export type Mode = "learn" | "practice" | "review" | "publish";

export type SessionStatus =
  | "created"
  | "calibrating"
  | "learning"
  | "practicing"
  | "reviewing"
  | "awaiting_publish_confirmation"
  | "published"
  | "provider_unavailable"
  | "write_denied"
  | "publish_failed"
  | "session_paused";

export type WriteScope =
  | "none"
  | "learner_state_only"
  | "vault_notes_only"
  | "remote_documents_after_confirmation";

export interface ProviderManifest {
  id: string;
  source: string;
  revision: string;
  capability: string;
  required: boolean;
  writeScope: WriteScope;
  invocation?: Record<string, string>;
}

export interface SessionRecord {
  sessionId: string;
  topic: string;
  mode: Mode;
  providerIds: string[];
  writePolicy: "project_read_only" | "notes_only" | "publish_after_confirmation";
  status: SessionStatus;
  reviewItemsPending: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderResult {
  providerId: string;
  status: "ok" | "unavailable" | "denied" | "failed";
  message: string;
  artifacts: string[];
}

export interface ProviderRequest {
  sessionId: string;
  mode: Mode;
  topic: string;
  prompt: string;
  outputContract: string;
}

export interface AuditEvent {
  sessionId: string;
  mode: Mode;
  providerId: string;
  operation: string;
  result: "ok" | "unavailable" | "denied" | "failed";
  message: string;
  at: string;
}

const MODES: ReadonlySet<string> = new Set(["learn", "practice", "review", "publish"]);

const WRITE_SCOPE_OPERATIONS: Readonly<Record<WriteScope, ReadonlySet<string>>> = {
  none: new Set(),
  learner_state_only: new Set(["learner_state_write"]),
  vault_notes_only: new Set(["obsidian_note_write"]),
  remote_documents_after_confirmation: new Set(["feishu_document_write"]),
};

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && MODES.has(value);
}

export function isWriteScopeAllowed(scope: unknown, operation: unknown): boolean {
  if (typeof scope !== "string" || typeof operation !== "string") {
    return false;
  }

  if (!Object.hasOwn(WRITE_SCOPE_OPERATIONS, scope)) {
    return false;
  }

  return WRITE_SCOPE_OPERATIONS[scope as WriteScope].has(operation);
}
