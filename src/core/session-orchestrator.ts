import type {
  Mode,
  ProviderInvoker,
  ProviderManifest,
  ProviderRequest,
  ProviderResult,
  SessionRecord,
} from "./contracts.js";
import { AuditStore } from "./audit-store.js";
import { canRunOperation, confirmedPublishPolicy, policyFor, type ExecutionPolicy, type Operation } from "./policy-gate.js";
import { SessionStore } from "./session-store.js";

export interface StartSessionInput {
  topic: string;
  mode: Mode;
  providerIds?: string[];
  writePolicy?: SessionRecord["writePolicy"];
  sessionId?: string;
}

export interface LearningInput {
  prompt: string;
  outputContract: string;
}

export interface PracticeInput {
  prompt: string;
  outputContract: string;
}

export interface ReviewInput {
  prompt: string;
  outputContract: string;
}

export type PublishTarget = "obsidian" | "feishu";

export interface PublishConfirmation {
  confirmed: boolean;
}

export interface PublishDraft {
  sessionId: string;
  topic: string;
  content: string;
  createdAt: string;
}

export interface SessionOrchestratorOptions {
  providers: readonly ProviderManifest[] | ReadonlyMap<string, ProviderManifest>;
  invoker: ProviderInvoker;
  sessionStore: SessionStore;
  auditStore: AuditStore;
  idFactory?: () => string;
  now?: () => Date;
}

const DEFAULT_PROVIDER_IDS: Readonly<Record<Mode, readonly string[]>> = {
  learn: ["hammer"],
  practice: ["tutor"],
  review: ["hammer"],
  publish: ["obsidian-skills", "lark-cli"],
};

const MODE_STATUS: Readonly<Partial<Record<Mode, SessionRecord["status"]>>> = {
  learn: "learning",
  practice: "practicing",
  review: "reviewing",
};

const STATUS_PATH: readonly SessionRecord["status"][] = [
  "calibrating",
  "learning",
  "practicing",
  "reviewing",
  "awaiting_publish_confirmation",
];

function providerMap(
  providers: readonly ProviderManifest[] | ReadonlyMap<string, ProviderManifest>,
): ReadonlyMap<string, ProviderManifest> {
  if (Array.isArray(providers)) {
    return new Map(providers.map((provider) => [provider.id, provider]));
  }
  return providers as ReadonlyMap<string, ProviderManifest>;
}

function stableAuditResult(result: ProviderResult["status"]): ProviderResult["status"] {
  return result;
}

export class SessionOrchestrator {
  private readonly providers: ReadonlyMap<string, ProviderManifest>;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly drafts = new Map<string, PublishDraft>();

  constructor(private readonly options: SessionOrchestratorOptions) {
    this.providers = providerMap(options.providers);
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async startSession(input: StartSessionInput): Promise<SessionRecord> {
    const now = this.now().toISOString();
    const session: SessionRecord = {
      sessionId: input.sessionId ?? this.idFactory(),
      topic: input.topic,
      mode: input.mode,
      providerIds: input.providerIds ?? [...DEFAULT_PROVIDER_IDS[input.mode]],
      writePolicy: input.writePolicy ?? (input.mode === "publish" ? "publish_after_confirmation" : "project_read_only"),
      status: "created",
      reviewItemsPending: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.options.sessionStore.create(session);
    await this.audit(session, "session_start", "ok", "session created");
    return session;
  }

  async runLearn(sessionId: string, input: LearningInput): Promise<ProviderResult> {
    return this.runTeachingMode(sessionId, "learn", input, "hammer", "read_project");
  }

  async runPractice(sessionId: string, input: PracticeInput): Promise<ProviderResult> {
    return this.runTeachingMode(sessionId, "practice", input, "tutor", "read_project");
  }

  async runReview(sessionId: string, input: ReviewInput): Promise<ProviderResult> {
    return this.runTeachingMode(sessionId, "review", input, "hammer", "read_diff");
  }

  async preparePublish(sessionId: string): Promise<PublishDraft> {
    const session = await this.requireSession(sessionId);
    await this.advanceTo(session, "awaiting_publish_confirmation");
    const draft: PublishDraft = {
      sessionId,
      topic: session.topic,
      content: `# Learning session: ${session.topic}\n\nSession: ${sessionId}\n`,
      createdAt: this.now().toISOString(),
    };
    this.drafts.set(sessionId, draft);
    await this.audit(session, "publish_prepare", "ok", "local publish draft prepared");
    return draft;
  }

  async publish(
    sessionId: string,
    target: PublishTarget,
    confirmation: PublishConfirmation,
  ): Promise<ProviderResult> {
    const session = await this.requireSession(sessionId);
    const draft = this.drafts.get(sessionId) ?? await this.preparePublish(sessionId);
    const providerId = target === "obsidian" ? "obsidian-skills" : "lark-cli";
    const operation: Operation = target === "obsidian" ? "write_obsidian_note" : "write_feishu";
    const policy = confirmation.confirmed ? confirmedPublishPolicy() : policyFor("publish");
    const provider = this.providers.get(providerId);

    if (!canRunOperation(policy, operation)) {
      const denied = this.result(providerId, "denied", "publish confirmation required");
      await this.audit(session, `publish:${target}`, "denied", "publish operation denied by policy");
      return denied;
    }

    const request: ProviderRequest = {
      sessionId,
      mode: "publish",
      topic: draft.topic,
      prompt: draft.content,
      outputContract: "publish-result",
    };
    const result = await this.invoke(provider, request, policy, operation);
    await this.completePublish(session, target, result);
    return result;
  }

  private async runTeachingMode(
    sessionId: string,
    mode: Exclude<Mode, "publish">,
    input: LearningInput | PracticeInput | ReviewInput,
    providerId: string,
    operation: Operation,
  ): Promise<ProviderResult> {
    const session = await this.requireSession(sessionId);
    const policy = policyFor(mode);
    await this.advanceTo(session, MODE_STATUS[mode]!);
    const provider = this.providers.get(providerId);
    const request: ProviderRequest = {
      sessionId,
      mode,
      topic: session.topic,
      prompt: input.prompt,
      outputContract: input.outputContract,
    };
    const result = await this.invoke(provider, request, policy, operation);
    if (result.status !== "ok" && provider?.required === true) {
      await this.saveStatus(sessionId, "provider_unavailable");
    } else if (result.status === "ok" && mode === "learn") {
      const current = await this.requireSession(sessionId);
      await this.options.sessionStore.save({
        ...current,
        reviewItemsPending: current.reviewItemsPending + 1,
        updatedAt: this.now().toISOString(),
      });
    }
    return result;
  }

  private async invoke(
    provider: ProviderManifest | undefined,
    request: ProviderRequest,
    policy: ExecutionPolicy,
    operation: Operation,
  ): Promise<ProviderResult> {
    const providerId = provider?.id ?? this.providerIdForRequest(request);
    if (!canRunOperation(policy, operation)) {
      const denied = this.result(providerId, "denied", "operation denied by policy");
      await this.auditFromRequest(request, `provider:${providerId}`, "denied", "provider invocation denied by policy");
      return denied;
    }
    if (!provider) {
      const unavailable = this.result(providerId, "unavailable", "provider manifest unavailable");
      await this.auditFromRequest(request, `provider:${providerId}`, "unavailable", "provider manifest unavailable");
      return unavailable;
    }

    let result: ProviderResult;
    try {
      result = await this.options.invoker.invoke(provider, request, policy);
    } catch {
      result = this.result(provider.id, "failed", "provider invocation failed");
    }
    await this.auditFromRequest(request, `provider:${provider.id}`, stableAuditResult(result.status), `provider ${result.status}`);
    return result;
  }

  private async completePublish(
    session: SessionRecord,
    target: PublishTarget,
    result: ProviderResult,
  ): Promise<void> {
    if (result.status === "denied") {
      return;
    }
    await this.saveStatus(
      session.sessionId,
      target === "feishu" && result.status !== "ok" ? "publish_failed" : "published",
    );
  }

  private async advanceTo(session: SessionRecord, target: SessionRecord["status"]): Promise<void> {
    const current = await this.requireSession(session.sessionId);
    const targetIndex = STATUS_PATH.indexOf(target);
    if (targetIndex < 0) {
      return;
    }
    let status = current.status;
    for (const next of STATUS_PATH.slice(STATUS_PATH.indexOf(status) + 1, targetIndex + 1)) {
      await this.options.sessionStore.transition(session.sessionId, next);
      status = next;
    }
  }

  private async saveStatus(sessionId: string, status: SessionRecord["status"]): Promise<void> {
    const session = await this.requireSession(sessionId);
    await this.options.sessionStore.save({ ...session, status, updatedAt: this.now().toISOString() });
  }

  private async requireSession(sessionId: string): Promise<SessionRecord> {
    const session = await this.options.sessionStore.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  private async audit(
    session: SessionRecord,
    operation: string,
    result: ProviderResult["status"],
    message: string,
  ): Promise<void> {
    await this.options.auditStore.append({
      sessionId: session.sessionId,
      mode: session.mode,
      providerId: "orchestrator",
      operation,
      result,
      message,
      at: this.now().toISOString(),
    });
  }

  private async auditFromRequest(
    request: ProviderRequest,
    operation: string,
    result: ProviderResult["status"],
    message: string,
  ): Promise<void> {
    await this.options.auditStore.append({
      sessionId: request.sessionId,
      mode: request.mode,
      providerId: operation.startsWith("provider:") ? operation.slice("provider:".length) : "orchestrator",
      operation,
      result,
      message,
      at: this.now().toISOString(),
    });
  }

  private providerIdForRequest(request: ProviderRequest): string {
    return request.mode === "practice" ? "tutor" : request.mode === "publish" ? "publish" : "hammer";
  }

  private result(providerId: string, status: ProviderResult["status"], message: string): ProviderResult {
    return { providerId, status, message, artifacts: [] };
  }
}
