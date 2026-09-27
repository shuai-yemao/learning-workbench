#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditStore } from "./core/audit-store.js";
import { isMode, type Mode, type ProviderResult } from "./core/contracts.js";
import { SessionOrchestrator } from "./core/session-orchestrator.js";
import { SessionStore } from "./core/session-store.js";
import { loadProviderRegistry, type ProviderRegistry } from "./core/provider-registry.js";
import {
  slugifyGoalTitle,
  isMastery,
  validateLearningGoalDraft,
  type LearningGoal,
  type LearningGoalDraft,
  type LearningSubmission,
} from "./learning/contracts.js";
import { LearningRepository } from "./learning/learning-repository.js";
import { LearningService } from "./learning/learning-service.js";
import { createSevenDayPlan } from "./learning/plan-generator.js";

export const cliVersion = "0.1.0";

function manifestPath(): string {
  return resolve(process.env.LEARNING_WORKBENCH_MANIFEST ?? join(process.cwd(), "providers.yaml"));
}

function dataDirectory(): string {
  return resolve(process.env.LEARNING_WORKBENCH_DATA_DIR ?? join(process.cwd(), ".learning-workbench"));
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function usage(): never {
  throw new Error(
    "Usage: learning-workbench diagnose | session start --topic <topic> --mode <learn|practice|review|publish> | session status <id> | session audit <id> | learning <create|submit|status|due> ...",
  );
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function vaultRoot(): string {
  const value = process.env.LEARNING_WORKBENCH_VAULT;
  if (!value || value.trim().length === 0) {
    throw new Error("LEARNING_WORKBENCH_VAULT must point to the Obsidian Vault before learning archive writes.");
  }
  return resolve(value);
}

function validDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

async function readGoalDraft(path: string | undefined): Promise<LearningGoalDraft> {
  if (!path) {
    usage();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(path), "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read learning goal input: ${message}`);
  }
  validateLearningGoalDraft(parsed);
  return parsed;
}

async function readSubmission(path: string | undefined): Promise<LearningSubmission> {
  if (!path) {
    usage();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(path), "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read learning submission input: ${message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Learning submission must be an object.");
  }
  const value = parsed as Record<string, unknown>;
  if (typeof value.taskId !== "string" || value.taskId.trim().length === 0 ||
    typeof value.reflectionMarkdown !== "string" || value.reflectionMarkdown.trim().length === 0 ||
    !Array.isArray(value.evidencePaths) || value.evidencePaths.some((pathValue) => typeof pathValue !== "string") ||
    !isMastery(value.mastery) ||
    (value.blockedReason !== undefined && typeof value.blockedReason !== "string")) {
    throw new Error("Learning submission has an invalid structure.");
  }
  return {
    taskId: value.taskId,
    reflectionMarkdown: value.reflectionMarkdown,
    evidencePaths: value.evidencePaths as string[],
    mastery: value.mastery,
    ...(value.blockedReason === undefined ? {} : { blockedReason: value.blockedReason }),
  };
}

function previewGoal(draft: LearningGoalDraft): LearningGoal {
  const timestamp = new Date().toISOString();
  return {
    ...draft,
    goalId: "pending-confirmation",
    slug: slugifyGoalTitle(draft.title),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createOrchestrator(registry: ProviderRegistry): SessionOrchestrator {
  const sessionStore = new SessionStore(dataDirectory());
  const auditStore = new AuditStore(dataDirectory());
  return new SessionOrchestrator({
    providers: registry.listProviders(),
    sessionStore,
    auditStore,
    invoker: {
      async invoke(provider): Promise<ProviderResult> {
        return {
          providerId: provider.id,
          status: "unavailable",
          message: "Provider runtime is not connected in the MVP CLI.",
          artifacts: [],
        };
      },
    },
  });
}

async function diagnose(): Promise<void> {
  try {
    const registry = await loadProviderRegistry(manifestPath());
    print({
      manifest: manifestPath(),
      dataDirectory: dataDirectory(),
      providers: registry.diagnose().map((record) => ({
        ...record,
        writeScope: registry.getProvider(record.id)?.writeScope,
      })),
    });
  } catch (error) {
    print({
      manifest: manifestPath(),
      status: "invalid",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sessionCommand(args: readonly string[]): Promise<void> {
  const action = args[0];
  const registry = await loadProviderRegistry(manifestPath());
  const orchestrator = createOrchestrator(registry);
  const sessionStore = new SessionStore(dataDirectory());
  const auditStore = new AuditStore(dataDirectory());

  if (action === "start") {
    const topic = flag(args, "--topic");
    const modeValue = flag(args, "--mode");
    if (!topic || !modeValue || !isMode(modeValue)) {
      usage();
    }
    const session = await orchestrator.startSession({ topic, mode: modeValue as Mode });
    print({ dataDirectory: dataDirectory(), session });
    return;
  }

  const sessionId = args[1];
  if (!sessionId || (action !== "status" && action !== "audit")) {
    usage();
  }
  if (action === "status") {
    print({ dataDirectory: dataDirectory(), session: await sessionStore.load(sessionId) });
    return;
  }
  print({ dataDirectory: dataDirectory(), events: await auditStore.read(sessionId) });
}

async function learningCommand(args: readonly string[]): Promise<void> {
  const [action] = args;
  if (action !== "create" && action !== "submit" && action !== "status" && action !== "due") {
    usage();
  }
  const root = vaultRoot();
  const repository = new LearningRepository(root);
  const service = new LearningService(repository);
  if (action === "create") {
    const inputPath = flag(args, "--input");
    const startOn = flag(args, "--start-on");
    if (!validDate(startOn)) {
      usage();
    }
    const draft = await readGoalDraft(inputPath);
    const goal = previewGoal(draft);
    let previewTaskIndex = 0;
    const tasks = createSevenDayPlan(goal, startOn, () => `pending-task-${++previewTaskIndex}`);
    const directory = join(root, "领域", draft.domain, "学习台", goal.slug);
    if (!args.includes("--confirm-write")) {
      print({
        status: "awaiting_write_confirmation",
        vault: root,
        directory,
        files: ["00-学习总览.md", "01-材料索引.md", "02-学习计划.md", "03-今日任务.md", "04-复习队列.md", ".learning-workbench/state.json"],
        goal: { domain: draft.domain, title: draft.title, slug: goal.slug },
        tasks,
        confirmation: "Re-run the same command with --confirm-write after reviewing this preview.",
      });
      return;
    }
    const state = await service.start(draft, startOn);
    print({ status: "written", vault: root, state });
    return;
  }

  const domain = flag(args, "--domain");
  const slug = flag(args, "--slug");
  if (!domain || !slug) {
    usage();
  }
  if (action === "status") {
    print({ vault: root, state: await repository.load(domain, slug) });
    return;
  }
  if (action === "due") {
    const date = flag(args, "--date");
    if (!validDate(date)) {
      usage();
    }
    const state = await repository.load(domain, slug);
    print({
      vault: root,
      date,
      tasks: state.tasks.filter((task) => task.status !== "completed" && task.dueOn <= date),
      reviews: state.reviews.filter((review) => review.status === "due" && review.dueOn <= date),
    });
    return;
  }

  const input = await readSubmission(flag(args, "--input"));
  const completedOn = flag(args, "--completed-on");
  if (!validDate(completedOn)) {
    usage();
  }
  const state = await repository.load(domain, slug);
  const task = state.tasks.find((item) => item.taskId === input.taskId);
  if (!task) {
    throw new Error(`Learning task not found: ${input.taskId}`);
  }
  if (!args.includes("--confirm-write")) {
    print({
      status: "awaiting_write_confirmation",
      vault: root,
      goal: { domain, slug },
      task: { taskId: task.taskId, title: task.title },
      submission: input,
      files: ["02-学习计划.md", "03-今日任务.md", "04-复习队列.md", `学习记录/${completedOn}-${task.taskId}.md`, ".learning-workbench/state.json"],
      confirmation: "Re-run the same command with --confirm-write after reviewing this preview.",
    });
    return;
  }
  const updated = await service.submit(domain, slug, input, completedOn);
  print({ status: "written", vault: root, state: updated });
}

export async function runCli(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = args;
  if (command === "diagnose") {
    await diagnose();
    return;
  }
  if (command === "session") {
    await sessionCommand(rest);
    return;
  }
  if (command === "learning") {
    await learningCommand(rest);
    return;
  }
  usage();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "error", message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
