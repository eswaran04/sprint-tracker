import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { Difficulty, Problem } from "@/lib/types";

export const toLocalDate = (isoTs: string) => format(new Date(isoTs), "yyyy-MM-dd");

export function heatmap(doneAts: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const ts of doneAts) {
    const d = toLocalDate(ts);
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return m;
}

/** Current streak ends today, or yesterday if nothing is done yet today. */
export function streaks(doneAts: string[], today: string) {
  const days = [...new Set(doneAts.map(toLocalDate))].sort();
  if (!days.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const set = new Set(days);
  let cursor = parseISO(today);
  if (!set.has(today)) cursor = subDays(cursor, 1);
  let current = 0;
  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    current++;
    cursor = subDays(cursor, 1);
  }
  return { current, longest };
}

export function summary(problems: Problem[], currentDay: number | null) {
  const scheduled = currentDay == null ? [] : problems.filter((p) => p.day_no <= currentDay);
  return {
    total: problems.length,
    done: problems.filter((p) => p.done_at).length,
    starred: problems.filter((p) => p.starred).length,
    scheduledSoFar: scheduled.length,
    overdue: currentDay == null ? 0 : problems.filter((p) => !p.done_at && p.day_no < currentDay).length,
  };
}

/**
 * Completion pace over the last `windowDays` calendar days (inclusive of `today`).
 * `perActiveDay` is how much you do on days you study; `perCalendarDay` spreads it over every day.
 */
export function pace(doneAts: string[], today: string, windowDays = 14) {
  const end = parseISO(today);
  const start = subDays(end, windowDays - 1);
  let total = 0;
  let activeDays = 0;
  for (const [d, n] of heatmap(doneAts)) {
    const day = parseISO(d);
    if (day < start || day > end) continue;
    total += n;
    activeDays++;
  }
  return {
    perActiveDay: activeDays ? total / activeDays : 0,
    perCalendarDay: windowDays > 0 ? total / windowDays : 0,
    activeDays,
  };
}

export type DifficultyKey = Difficulty | "None";
export const DIFFICULTY_KEYS: DifficultyKey[] = ["Basic", "Core", "Pro", "None"];
export const diffKey = (d: Difficulty | null): DifficultyKey => d ?? "None";

export interface DifficultyPerf {
  total: number;
  done: number;
  completionRate: number;
  /** Mean days between a problem's scheduled date and when it was finished (positive = late); null without data. */
  avgLagDays: number | null;
}

/**
 * Per-difficulty completion and lateness. Lag uses the current `day_no` (rescheduling resets `original_day_no`),
 * so it measures how far behind the *latest* plan you finished.
 */
export function difficultyPerformance(
  problems: Pick<Problem, "difficulty" | "done_at" | "day_no">[],
  dateFor: (day: number) => string | null,
): Record<DifficultyKey, DifficultyPerf> {
  const acc = Object.fromEntries(DIFFICULTY_KEYS.map((k) => [k, { total: 0, done: 0, lagSum: 0, lagN: 0 }])) as Record<
    DifficultyKey,
    { total: number; done: number; lagSum: number; lagN: number }
  >;
  for (const p of problems) {
    const row = acc[diffKey(p.difficulty)];
    row.total++;
    if (!p.done_at) continue;
    row.done++;
    const due = dateFor(p.day_no);
    if (due) {
      row.lagSum += differenceInCalendarDays(parseISO(toLocalDate(p.done_at)), parseISO(due));
      row.lagN++;
    }
  }
  return Object.fromEntries(
    DIFFICULTY_KEYS.map((k) => {
      const r = acc[k];
      return [k, { total: r.total, done: r.done, completionRate: r.total ? r.done / r.total : 0, avgLagDays: r.lagN ? r.lagSum / r.lagN : null }];
    }),
  ) as Record<DifficultyKey, DifficultyPerf>;
}

const BASE_WEIGHT: Record<DifficultyKey, number> = { Basic: 1, Core: 1.5, Pro: 2.5, None: 1 };

/** Default effort units for one problem of this difficulty. */
export const effortWeight = (difficulty: Difficulty | null) => BASE_WEIGHT[diffKey(difficulty)];

/**
 * Effort weights scaled by how far behind you run on each difficulty relative to your overall lag.
 * Only ever heavier (×1–×2), so a user who falls behind on Pro gets a heavier Pro weight.
 */
export function effortWeights(perf: Record<DifficultyKey, DifficultyPerf>): Record<DifficultyKey, number> {
  let sum = 0;
  let n = 0;
  for (const k of DIFFICULTY_KEYS) {
    const p = perf[k];
    if (p.avgLagDays != null) {
      sum += Math.max(0, p.avgLagDays) * p.done;
      n += p.done;
    }
  }
  const overall = n ? sum / n : 0;
  return Object.fromEntries(
    DIFFICULTY_KEYS.map((k) => {
      const lag = perf[k].avgLagDays;
      const ratio = lag == null ? 1 : (1 + Math.max(0, lag)) / (1 + overall);
      return [k, Math.round(BASE_WEIGHT[k] * Math.min(2, Math.max(1, ratio)) * 100) / 100];
    }),
  ) as Record<DifficultyKey, number>;
}

export function breakdown(problems: Problem[], keys: (p: Problem) => string[]) {
  const m = new Map<string, { key: string; total: number; done: number }>();
  for (const p of problems) {
    for (const key of keys(p)) {
      const row = m.get(key) ?? { key, total: 0, done: 0 };
      row.total++;
      if (p.done_at) row.done++;
      m.set(key, row);
    }
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}
