import { shiftBacklog, type Change } from "@/lib/schedule";
import { DIFFICULTY_KEYS, diffKey, effortWeight, type DifficultyKey } from "@/lib/stats";
import type { Problem } from "@/lib/types";
import { coachScope, detectHeavyRuns, isFlagged, type CoachSignals } from "./signals";

/** The only knobs the model (or `defaultStrategy`) controls. The planner turns them into concrete changes. */
export interface CoachStrategy {
  /** Effort units per plan day (Basic=1, Core=1.5, Pro=2.5 before lag scaling). */
  dailyCapacity: number;
  /** 0 = unlimited. */
  maxProPerDay: number;
  /** Topics of upcoming heavy runs that get an empty review day before them. */
  reviewBefore: string[];
  /** Let struggle/revisit-flagged problems jump ahead within the reorder window (and earlier than their day). */
  frontLoadFlagged: boolean;
}

export const LIMITS = {
  capacity: { min: 1, max: 20 },
  maxPro: { min: 0, max: 10 },
  maxDaysAdded: 60,
  /** Problems may only be reordered among those originally within this many plan days of the next one. */
  window: 3,
} as const;

export type Weights = Record<DifficultyKey, number>;
export const DEFAULT_WEIGHTS: Weights = Object.fromEntries(DIFFICULTY_KEYS.map((k) => [k, effortWeight(k === "None" ? null : k)])) as Weights;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Hard limits applied to any strategy, whoever produced it. */
export function clampStrategy(s: CoachStrategy): CoachStrategy {
  const num = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  return {
    dailyCapacity: Math.round(clamp(num(s.dailyCapacity, 4), LIMITS.capacity.min, LIMITS.capacity.max) * 2) / 2,
    maxProPerDay: Math.round(clamp(num(s.maxProPerDay, 0), LIMITS.maxPro.min, LIMITS.maxPro.max)),
    reviewBefore: [...new Set(s.reviewBefore)],
    frontLoadFlagged: Boolean(s.frontLoadFlagged),
  };
}

/** Rule-based strategy used when AI is off, slow, or returns something invalid. */
export function defaultStrategy(signals: CoachSignals): CoachStrategy {
  const rem = signals.remaining.byDifficulty;
  const total = DIFFICULTY_KEYS.reduce((s, k) => s + rem[k], 0);
  const avgWeight = total ? DIFFICULTY_KEYS.reduce((s, k) => s + rem[k] * signals.weights[k], 0) / total : 1.5;
  // Trust real pace once there's a little history; otherwise assume the sheet's own density.
  const perDay = signals.pace.activeDays >= 3 && signals.pace.perActiveDay > 0 ? signals.pace.perActiveDay : signals.plannedPerDay || 3;
  const flagged = new Set(signals.flaggedTopics.map((t) => t.topic));
  const proLag = signals.difficulty.Pro.avgLagDays;
  return clampStrategy({
    dailyCapacity: Math.max(perDay * avgWeight, signals.weights.Pro),
    maxProPerDay: proLag != null && proLag > 1 ? 1 : 0,
    reviewBefore: [...new Set(signals.heavyRuns.filter((r) => flagged.has(r.topic)).map((r) => r.topic))],
    frontLoadFlagged: signals.flaggedUndone > 0,
  });
}

export type PlannerProblem = Pick<Problem, "id" | "day_no" | "position" | "done_at" | "difficulty" | "topics" | "notes" | "starred">;

export interface PlanOptions {
  /** Plan day that is "now". */
  today: number;
  sprintFor: (day: number) => number;
  strategy: CoachStrategy;
  weights?: Weights;
}

export interface PlanResult {
  changes: Change[];
  reviewDays: number[];
  /** True when the coached plan blew past the day limit and the plain shift was used instead. */
  fallback: boolean;
}

/**
 * Deterministic rescheduler. Only undone problems from the earliest overdue day onward move (same scope as
 * `shiftBacklog`); done problems stay put and their effort counts against their day's capacity.
 */
export function planReschedule(problems: PlannerProblem[], opts: PlanOptions): PlanResult {
  const { today, sprintFor } = opts;
  const strategy = clampStrategy(opts.strategy);
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const w = (p: PlannerProblem) => weights[diffKey(p.difficulty)] ?? 1;
  const isPro = (p: PlannerProblem) => p.difficulty === "Pro";

  if (!problems.some((p) => !p.done_at && p.day_no < today)) return { changes: [], reviewDays: [], fallback: false };

  const queue = coachScope(problems, today).sort((a, b) => a.day_no - b.day_no || a.position - b.position || a.id.localeCompare(b.id));
  const flagged = new Set(strategy.frontLoadFlagged ? queue.filter(isFlagged).map((p) => p.id) : []);

  const doneLoad = new Map<number, { load: number; pro: number }>();
  for (const p of problems) {
    if (!p.done_at) continue;
    const row = doneLoad.get(p.day_no) ?? { load: 0, pro: 0 };
    row.load += w(p);
    if (isPro(p)) row.pro++;
    doneLoad.set(p.day_no, row);
  }

  // Heavy runs (in original positions) that get a review day; a problem in the run's day range waits for it.
  const review = new Set(strategy.reviewBefore);
  const pendingRuns = detectHeavyRuns(queue)
    .filter((r) => review.has(r.topic))
    .map((r) => ({ ...r, done: false }));
  const runOf = (p: PlannerProblem) => pendingRuns.find((r) => !r.done && p.day_no >= r.startDay && p.day_no < r.startDay + r.days);

  const oldMax = problems.reduce((m, p) => Math.max(m, p.day_no), 1);
  const limitDay = Math.max(oldMax, today) + LIMITS.maxDaysAdded;
  const placed = new Map<string, number>();
  const reviewDays: number[] = [];
  let day = today;
  let overflow = false;

  while (queue.length) {
    if (day > limitDay) {
      overflow = true;
      break;
    }
    // Never pull future work earlier: a problem may land here only if it's due by now, was overdue, or is flagged.
    const eligible = (p: PlannerProblem) => p.day_no <= day || p.day_no < today || flagged.has(p.id);
    const head = queue[0];
    const headRun = runOf(head);
    if (headRun && eligible(head)) {
      // Leave this day empty for review, once per run.
      headRun.done = true;
      reviewDays.push(day);
      day++;
      continue;
    }

    const base = doneLoad.get(day) ?? { load: 0, pro: 0 };
    let load = base.load;
    let pro = base.pro;
    let count = 0;
    for (;;) {
      const lead = queue[0];
      if (!lead) break;
      const leadRun = runOf(lead);
      if (leadRun && count > 0) break; // close the day; next iteration inserts the review day
      const windowEnd = lead.day_no + LIMITS.window - 1;
      const candidates = queue.filter((p, i) => i < 50 && p.day_no <= windowEnd && eligible(p) && !(runOf(p) && runOf(p) !== leadRun));
      const ordered = flagged.size ? [...candidates.filter((p) => flagged.has(p.id)), ...candidates.filter((p) => !flagged.has(p.id))] : candidates;
      const fits = (p: PlannerProblem) =>
        load + w(p) <= strategy.dailyCapacity + 1e-9 && !(isPro(p) && strategy.maxProPerDay > 0 && pro >= strategy.maxProPerDay);
      let pick = ordered.find(fits);
      if (!pick && count === 0) pick = ordered[0]; // every day takes at least one problem so the plan can't stall
      if (!pick) break;
      queue.splice(queue.indexOf(pick), 1);
      placed.set(pick.id, day);
      load += w(pick);
      if (isPro(pick)) pro++;
      count++;
    }
    day++;
  }

  if (overflow) {
    return { changes: shiftBacklog(problems, today, sprintFor), reviewDays: [], fallback: true };
  }

  const changes: Change[] = [];
  for (const p of problems) {
    const next = placed.get(p.id);
    if (next != null && next !== p.day_no) changes.push({ id: p.id, day_no: next, sprint_no: sprintFor(next) });
  }
  return { changes, reviewDays, fallback: false };
}
