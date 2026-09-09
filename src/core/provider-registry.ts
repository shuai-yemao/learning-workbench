import type { ProviderManifest } from "./contracts.js";
import {
  loadProviderManifest,
  type ProviderManifestDocument,
  type ProviderManifestError,
  validateProviderManifest,
} from "../adapters/provider-manifest.js";

export type ProviderStatus = "available" | "missing" | "invalid" | "unverified";

export interface ProviderStatusRecord {
  id: string;
  status: ProviderStatus;
  message: string;
}

export interface ProviderRegistryOptions {
  verifiedRevisions?: Readonly<Record<string, string>>;
}

export class ProviderRegistry {
  private readonly providersById: ReadonlyMap<string, ProviderManifest>;
  private readonly verifiedRevisions: Readonly<Record<string, string>>;

  constructor(document: ProviderManifestDocument, options: ProviderRegistryOptions = {}) {
    this.providersById = new Map(document.providers.map((provider) => [provider.id, provider]));
    this.verifiedRevisions = options.verifiedRevisions ?? {};
  }

  listProviders(): ProviderManifest[] {
    return [...this.providersById.values()];
  }

  getProvider(id: string): ProviderManifest | undefined {
    return this.providersById.get(id);
  }

  getProviderStatus(id: string): ProviderStatus {
    const provider = this.getProvider(id);
    if (provider === undefined) {
      return "missing";
    }
    return this.verifiedRevisions[id] === provider.revision ? "available" : "unverified";
  }

  diagnose(): ProviderStatusRecord[] {
    return this.listProviders().map((provider) => {
      const status = this.getProviderStatus(provider.id);
      return {
        id: provider.id,
        status,
        message:
          status === "available"
            ? `revision ${provider.revision} is verified`
            : "manifest is valid, but runtime/provider capability verification is pending",
      };
    });
  }
}

export async function loadProviderRegistry(
  path: string,
  options: ProviderRegistryOptions = {},
): Promise<ProviderRegistry> {
  const document = await loadProviderManifest(path);
  return new ProviderRegistry(document, options);
}

export function getProviderStatus(registry: ProviderRegistry, id: string): ProviderStatus {
  return registry.getProviderStatus(id);
}

export { validateProviderManifest };
export type { ProviderManifestError };
