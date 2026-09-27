import type { Mastery, ReviewItem } from "./contracts.js";

export interface ScheduleReviewInput {
  reviewId: string;
  taskId: string;
  concept: string;
  completedOn: string;
  mastery: Mastery;
}

export interface ScheduledReview extends ReviewItem {
  needsRemediation: boolean;
}

const REVIEW_DELAY_DAYS: Readonly<Record<Mastery, number>> = {
  0: 1,
  1: 1,
  2: 3,
  3: 7,
};

function addDays(date: string, offset: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

export function scheduleReview(input: ScheduleReviewInput): ScheduledReview {
  return {
    reviewId: input.reviewId,
    taskId: input.taskId,
    concept: input.concept,
    dueOn: addDays(input.completedOn, REVIEW_DELAY_DAYS[input.mastery]),
    status: "due",
    needsRemediation: input.mastery === 0,
  };
}
