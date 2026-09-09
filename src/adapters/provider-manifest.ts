import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { ProviderManifest, WriteScope } from "../core/contracts.js";

export const PROVIDER_MANIFEST_VERSION = 1;

export const PROVIDER_CAPABILITIES = [
  "tutoring_and_review",
  "read_only_practice_guidance",
  "note_and_session_output",
  "document_publish",
] as const;

const WRITE_SCOPES: ReadonlySet<WriteScope> = new Set([
  "none",
  "learner_state_only",
  "vault_notes_only",
  "remote_documents_after_confirmation",
]);

const REVISION_PATTERN = /^[0-9a-f]{40}$/i;
const GITHUB_SOURCE_PATTERN = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/;

export interface ProviderManifestDocument {
  version: number;
  providers: ProviderManifest[];
}

export class ProviderManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderManifestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, field: string, context: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProviderManifestError(`${context}.${field} must be a non-empty string`);
  }
  return value.trim();
}

function parseWriteScope(value: unknown, context: string): WriteScope {
  if (typeof value !== "string" || !WRITE_SCOPES.has(value as WriteScope)) {
    throw new ProviderManifestError(`${context}.writeScope is invalid`);
  }
  return value as WriteScope;
}

function parseCapability(value: unknown, context: string): string {
  const capability = requireString({ capability: value }, "capability", context);
  if (!(PROVIDER_CAPABILITIES as readonly string[]).includes(capability)) {
    throw new ProviderManifestError(`${context}.capability is unknown: ${capability}`);
  }
  return capability;
}

function parseInvocation(value: unknown, context: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new ProviderManifestError(`${context}.invocation must be an object`);
  }

  const invocation: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new ProviderManifestError(`${context}.invocation.${key} must be a non-empty string`);
    }
    invocation[key] = entry.trim();
  }
  return invocation;
}

export function validateProviderManifest(value: unknown, context = "provider"): ProviderManifest {
  if (!isRecord(value)) {
    throw new ProviderManifestError(`${context} must be an object`);
  }

  const id = requireString(value, "id", context);
  const source = requireString(value, "source", context);
  if (!GITHUB_SOURCE_PATTERN.test(source)) {
    throw new ProviderManifestError(`${context}.source must be a GitHub HTTPS repository URL`);
  }

  const revision = requireString(value, "revision", context);
  if (!REVISION_PATTERN.test(revision)) {
    throw new ProviderManifestError(`${context}.revision must be a 40-character SHA-1`);
  }

  const capability = parseCapability(value.capability, context);
  if (typeof value.required !== "boolean") {
    throw new ProviderManifestError(`${context}.required must be a boolean`);
  }
  const writeScope = parseWriteScope(value.writeScope, context);

  let version: string | undefined;
  if (value.version !== undefined) {
    version = requireString(value, "version", context);
  }

  if (id === "tutor" && version !== "v0.6") {
    throw new ProviderManifestError(`${context}.version must be v0.6 for tutor`);
  }
  if (id === "tutor" && writeScope !== "none") {
    throw new ProviderManifestError(`${context}.writeScope must be none for tutor`);
  }

  const invocation = parseInvocation(value.invocation, context);
  return {
    id,
    source,
    revision,
    capability,
    required: value.required,
    writeScope,
    ...(version === undefined ? {} : { version }),
    ...(invocation === undefined ? {} : { invocation }),
  };
}

export function parseProviderManifestDocument(value: unknown): ProviderManifestDocument {
  if (!isRecord(value)) {
    throw new ProviderManifestError("manifest must be an object");
  }
  if (value.version !== PROVIDER_MANIFEST_VERSION) {
    throw new ProviderManifestError(`manifest.version must be ${PROVIDER_MANIFEST_VERSION}`);
  }
  if (!Array.isArray(value.providers)) {
    throw new ProviderManifestError("manifest.providers must be an array");
  }

  const providers = value.providers.map((provider, index) =>
    validateProviderManifest(provider, `providers[${index}]`),
  );
  const ids = new Set<string>();
  for (const provider of providers) {
    if (ids.has(provider.id)) {
      throw new ProviderManifestError(`duplicate provider id: ${provider.id}`);
    }
    ids.add(provider.id);
  }

  return { version: PROVIDER_MANIFEST_VERSION, providers };
}

export function parseProviderManifestText(text: string): ProviderManifestDocument {
  let parsed: unknown;
  try {
    parsed = YAML.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProviderManifestError(`manifest YAML is invalid: ${message}`);
  }
  return parseProviderManifestDocument(parsed);
}

export async function loadProviderManifest(path: string): Promise<ProviderManifestDocument> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProviderManifestError(`cannot read manifest ${path}: ${message}`);
  }
  return parseProviderManifestText(text);
}
