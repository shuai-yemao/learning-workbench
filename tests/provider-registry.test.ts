import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseProviderManifestDocument,
  parseProviderManifestText,
  validateProviderManifest,
} from "../src/adapters/provider-manifest.js";
import { loadProviderRegistry } from "../src/core/provider-registry.js";

const fixture = (name: string) => resolve("tests", "fixtures", name);

async function readFixture(name: string): Promise<string> {
  return readFile(fixture(name), "utf8");
}

describe("provider manifest and registry", () => {
  it("loads the locked project manifest", async () => {
    const registry = await loadProviderRegistry(resolve("providers.yaml"));

    expect(registry.listProviders()).toHaveLength(4);
    expect(registry.getProvider("hammer")?.revision).toBe(
      "c5b86153b15621649560cee247659840738aadae",
    );
    expect(registry.getProvider("tutor")?.revision).toBe(
      "88ffe9ac5e3e41962393f8eb14b080a6c039ed40",
    );
  });

  it("loads all four providers from a valid manifest", async () => {
    const registry = await loadProviderRegistry(fixture("providers.valid.yaml"));

    expect(registry.listProviders()).toHaveLength(4);
    expect(registry.getProvider("hammer")?.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(registry.getProvider("tutor")?.version).toBe("v0.6");
    expect(registry.getProvider("tutor")?.writeScope).toBe("none");
    expect(registry.getProvider("obsidian-skills")?.writeScope).toBe("vault_notes_only");
    expect(registry.getProvider("lark-cli")?.writeScope).toBe(
      "remote_documents_after_confirmation",
    );
  });

  it("keeps valid but unverified providers out of available status", async () => {
    const registry = await loadProviderRegistry(fixture("providers.valid.yaml"));
    expect(registry.getProviderStatus("hammer")).toBe("unverified");
    expect(registry.getProviderStatus("not-installed")).toBe("missing");
  });

  it("marks a provider available only when its revision is verified", async () => {
    const registry = await loadProviderRegistry(fixture("providers.valid.yaml"), {
      verifiedRevisions: {
        hammer: "c5b86153b15621649560cee247659840738aadae",
      },
    });
    expect(registry.getProviderStatus("hammer")).toBe("available");
    expect(registry.getProviderStatus("tutor")).toBe("unverified");
  });

  it("rejects a manifest with a missing required id", async () => {
    await expect(loadProviderRegistry(fixture("providers.invalid.yaml"))).rejects.toThrow(
      "providers[0].id",
    );
  });

  it.each(["id", "source", "revision", "writeScope"])(
    "rejects a provider missing %s",
    async (field) => {
      const document = parseProviderManifestText(await readFixture("providers.valid.yaml"));
      const provider = { ...document.providers[0] } as Record<string, unknown>;
      delete provider[field];
      expect(() => validateProviderManifest(provider, `provider-without-${field}`)).toThrow(field);
    },
  );

  it("rejects empty, short, branch and placeholder revisions", async () => {
    const document = parseProviderManifestText(await readFixture("providers.valid.yaml"));
    for (const revision of ["", "main", "abc123", "<commit-sha>"]) {
      const provider = { ...document.providers[0], revision };
      expect(() => validateProviderManifest(provider)).toThrow("revision");
    }
  });

  it("rejects an unknown capability", async () => {
    const document = parseProviderManifestText(await readFixture("providers.valid.yaml"));
    expect(() => validateProviderManifest({ ...document.providers[0], capability: "unknown" })).toThrow(
      "capability",
    );
  });

  it("rejects a practice provider with a write scope", async () => {
    const document = parseProviderManifestText(await readFixture("providers.valid.yaml"));
    expect(() =>
      validateProviderManifest({ ...document.providers[1], writeScope: "vault_notes_only" }),
    ).toThrow("writeScope");
  });

  it("rejects duplicate provider ids", async () => {
    const document = parseProviderManifestText(await readFixture("providers.valid.yaml"));
    const duplicate = { ...document, providers: [...document.providers, document.providers[0]] };
    expect(() => parseProviderManifestDocument(duplicate)).toThrow("duplicate provider id");
  });

  it("reports diagnostic status for each manifest provider", async () => {
    const registry = await loadProviderRegistry(fixture("providers.valid.yaml"), {
      verifiedRevisions: {
        hammer: "c5b86153b15621649560cee247659840738aadae",
      },
    });
    expect(registry.diagnose()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "hammer", status: "available" }),
        expect.objectContaining({ id: "tutor", status: "unverified" }),
      ]),
    );
  });
});
