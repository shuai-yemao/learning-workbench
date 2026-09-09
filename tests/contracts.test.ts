import { describe, expect, it } from "vitest";
import { isMode, isWriteScopeAllowed } from "../src/core/contracts.js";

describe("core contracts baseline", () => {
  it("exposes the initial mode and write-scope contract", () => {
    expect(isMode("learn")).toBe(true);
    expect(isMode("practice")).toBe(true);
    expect(isMode("unknown")).toBe(false);
    expect(isWriteScopeAllowed("project_read", "project_source_write")).toBe(false);
    expect(isWriteScopeAllowed("vault_notes_only", "obsidian_note_write")).toBe(true);
  });
});
