import { describe, expect, it } from "vitest";
import {
  isClaimStatus,
  isMastery,
  slugifyGoalTitle,
  validateLearningGoalDraft,
} from "../../src/learning/contracts.js";

describe("learning contracts", () => {
  it("accepts the stable evidence and mastery vocabulary", () => {
    expect(isClaimStatus("confirmed")).toBe(true);
    expect(isClaimStatus("guess")).toBe(false);
    expect(isMastery(0)).toBe(true);
    expect(isMastery(3)).toBe(true);
    expect(isMastery(4)).toBe(false);
  });

  it("creates a cross-platform slug from a mixed-language goal title", () => {
    expect(slugifyGoalTitle("FreeRTOS Queue 阻塞与唤醒")).toBe("freertos-queue");
  });

  it("rejects a goal draft without a verifiable learning objective", () => {
    expect(() => validateLearningGoalDraft({
      domain: "嵌入式",
      title: "FreeRTOS Queue",
      kind: "project",
      objective: "",
      successCriteria: ["解释阻塞条件"],
    })).toThrow("objective must be a non-empty string");
  });
});
