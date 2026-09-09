#!/usr/bin/env node

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditStore } from "./core/audit-store.js";
import { isMode, type Mode, type ProviderResult } from "./core/contracts.js";
import { SessionOrchestrator } from "./core/session-orchestrator.js";
import { SessionStore } from "./core/session-store.js";
import { loadProviderRegistry, type ProviderRegistry } from "./core/provider-registry.js";

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
    "Usage: learning-workbench diagnose | session start --topic <topic> --mode <learn|practice|review|publish> | session status <id> | session audit <id>",
  );
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
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
  usage();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "error", message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
