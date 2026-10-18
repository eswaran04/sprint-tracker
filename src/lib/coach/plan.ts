import { makeSprintForDay, shiftBacklog, type Change, type ScheduleConfig } from "@/lib/schedule";
import type { Problem, Sprint } from "@/lib/types";
import { summarizePlan, type PlanSummary } from "./diff";
import { planReschedule, type CoachStrategy } from "./planner";
import { buildSignals, type CoachSignals } from "./signals";

/** What the coach route returns. `byDay` is rebuilt on the client from its cached problems. */
export interface CoachPlan {
  changes: Change[];
  summary: Omit<PlanSummary, "byDay">;
  rationale: string[];
  strategy: CoachStrategy;
  aiUsed: boolean;
  /** For the "plain shift would…" comparison line. */
  plainShift: { moved: number; newEnd: number };
}

export const scheduleConfig = (s: Pick<Sprint, "start_date" | "skip_weekends" | "rest_days">): ScheduleConfig => ({
  startDate: s.start_date,
  skipWeekends: s.skip_weekends,
  restDays: s.rest_days ?? [],
});

export function coachInputs(sprint: Sprint, problems: Problem[], today: string): { signals: CoachSignals; sprintFor: (d: number) => number } | null {
  const signals = buildSignals(problems, scheduleConfig(sprint), today);
  return signals ? { signals, sprintFor: makeSprintForDay(problems) } : null;
}

/** Runs the deterministic planner for a strategy and packages the result for the client. */
export function buildCoachPlan(
  problems: Problem[],
  signals: CoachSignals,
  sprintFor: (d: number) => number,
  strategy: CoachStrategy,
  rationale: string[],
  aiUsed: boolean,
): CoachPlan {
  const result = planReschedule(problems, { today: signals.today, sprintFor, strategy, weights: signals.weights });
  const { moved, daysAdded, reviewDays, oldEnd, newEnd, label, from } = summarizePlan(problems, result.changes, result.reviewDays);
  const summary = { moved, daysAdded, reviewDays, oldEnd, newEnd, label, from };
  const plain = summarizePlan(problems, shiftBacklog(problems, signals.today, sprintFor));
  return {
    changes: result.changes,
    summary,
    rationale: result.fallback ? ["This plan would run too long, so it falls back to a plain shift.", ...rationale].slice(0, 4) : rationale,
    strategy,
    aiUsed,
    plainShift: { moved: plain.moved, newEnd: plain.newEnd },
  };
}
