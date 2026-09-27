import { describe, expect, it } from "vitest";
import { scheduleReview } from "../../src/learning/review-scheduler.js";

describe("review scheduler", () => {
  it.each([
    [0, "2026-09-28"],
    [1, "2026-09-28"],
    [2, "2026-09-30"],
    [3, "2026-10-04"],
  ] as const)("schedules mastery %i for %s", (mastery, dueOn) => {
    expect(scheduleReview({
      reviewId: "review-001",
      taskId: "task-001",
      concept: "Queue 阻塞",
      completedOn: "2026-09-27",
      mastery,
    })).toMatchObject({ dueOn, status: "due" });
  });

  it("marks mastery zero for remediation without fabricating a completed review", () => {
    expect(scheduleReview({
      reviewId: "review-001",
      taskId: "task-001",
      concept: "Queue 阻塞",
      completedOn: "2026-09-27",
      mastery: 0,
    })).toMatchObject({ needsRemediation: true, status: "due" });
  });
});
