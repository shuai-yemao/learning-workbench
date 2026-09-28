import { describe, expect, it } from "vitest";
import { evaluateLearningContext } from "../../src/learning/context-gate.js";

describe("learning context gate", () => {
  it("allows the first classified concept question as a quick answer", () => {
    expect(evaluateLearningContext({
      history: [],
      current: { domain: "嵌入式 / FreeRTOS 并发", concept: "Mutex", kind: "concept" },
      context: {},
    })).toEqual({ mode: "quick_answer", missing: [] });
  });

  it("requires context for a second independent concept in the same domain", () => {
    expect(evaluateLearningContext({
      history: [{ domain: "嵌入式 / FreeRTOS 并发", concept: "Queue", kind: "concept" }],
      current: { domain: "嵌入式 / FreeRTOS 并发", concept: "Mutex", kind: "concept" },
      context: {},
    })).toEqual({ mode: "context_required", missing: ["objective", "evidence"] });
  });

  it("does not count a clarification or a different domain as a second independent concept", () => {
    expect(evaluateLearningContext({
      history: [{ domain: "嵌入式 / FreeRTOS 并发", concept: "Queue", kind: "concept" }],
      current: { domain: "嵌入式 / FreeRTOS 并发", concept: "Queue", kind: "clarification" },
      context: {},
    })).toEqual({ mode: "quick_answer", missing: [] });

    expect(evaluateLearningContext({
      history: [{ domain: "嵌入式 / FreeRTOS 并发", concept: "Queue", kind: "concept" }],
      current: { domain: "嵌入式 / STM32 外设", concept: "ADC", kind: "concept" },
      context: {},
    })).toEqual({ mode: "quick_answer", missing: [] });
  });

  it("enters formal learning only after a triggered gate has complete context", () => {
    expect(evaluateLearningContext({
      history: [{ domain: "嵌入式 / FreeRTOS 并发", concept: "Queue", kind: "concept" }],
      current: { domain: "嵌入式 / FreeRTOS 并发", concept: "Mutex", kind: "concept" },
      context: {
        objective: "为项目选择同步机制",
        evidence: ["  ", "app/message_task.c"],
      },
    })).toEqual({ mode: "formal_learning", missing: [] });
  });
});
