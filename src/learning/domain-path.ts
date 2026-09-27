import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export type LearningPathErrorCode =
  | "DOMAIN_NOT_FOUND"
  | "DOMAIN_PATH_OUTSIDE_VAULT"
  | "GOAL_PATH_OUTSIDE_DOMAIN";

export class LearningPathError extends Error {
  readonly code: LearningPathErrorCode;

  constructor(code: LearningPathErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LearningPathError";
    this.code = code;
  }
}

function staysWithin(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath.length > 0 && !relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath);
}

function validSegment(value: string): boolean {
  return value.trim().length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\");
}

export async function resolveDomainDirectory(vaultRoot: string, domain: string): Promise<string> {
  const domainRoot = resolve(vaultRoot, "领域");
  if (!validSegment(domain)) {
    throw new LearningPathError("DOMAIN_PATH_OUTSIDE_VAULT", "Domain must be a single directory name.");
  }
  const requested = resolve(domainRoot, domain);
  if (!staysWithin(domainRoot, requested)) {
    throw new LearningPathError("DOMAIN_PATH_OUTSIDE_VAULT", "Domain path escapes the Vault domain root.");
  }

  try {
    const metadata = await lstat(requested);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new LearningPathError("DOMAIN_NOT_FOUND", "The selected domain must be a real directory.");
    }
    const canonicalRoot = await realpath(domainRoot);
    const canonicalDomain = await realpath(requested);
    if (!staysWithin(canonicalRoot, canonicalDomain)) {
      throw new LearningPathError("DOMAIN_PATH_OUTSIDE_VAULT", "Domain path escapes the canonical Vault domain root.");
    }
    return canonicalDomain;
  } catch (error) {
    if (error instanceof LearningPathError) {
      throw error;
    }
    throw new LearningPathError("DOMAIN_NOT_FOUND", `Learning domain not found: ${domain}.`, { cause: error });
  }
}

export async function resolveGoalDirectory(vaultRoot: string, domain: string, slug: string): Promise<string> {
  if (!validSegment(slug)) {
    throw new LearningPathError("GOAL_PATH_OUTSIDE_DOMAIN", "Goal slug must be a single directory name.");
  }
  const domainDirectory = await resolveDomainDirectory(vaultRoot, domain);
  const learningRoot = resolve(domainDirectory, "学习台");
  const requested = resolve(learningRoot, slug);
  if (!staysWithin(learningRoot, requested)) {
    throw new LearningPathError("GOAL_PATH_OUTSIDE_DOMAIN", "Goal path escapes the selected learning domain.");
  }
  return requested;
}
