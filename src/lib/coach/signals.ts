import { format } from "date-fns";
import { buildCalendar, currentPlanDay, type ScheduleConfig } from "@/lib/schedule";
import {
  DIFFICULTY_KEYS, diffKey, difficultyPerformance, effortWeights, pace, type DifficultyKey, type DifficultyPerf,
} from "@/lib/stats";
import type { Problem } from "@/lib/types";

/**
 * Pure, client-or-server signals for the backlog coach. `buildSignals` is the only thing sent to the model:
 * counts, rates and topic names — never notes, problem names or ids.
 */

export const NOTE_FLAGS = {
  struggle: /\b(struggl|stuck|hard|confus|couldn'?t|wrong)/i,
  revisit: /\b(revisit|redo|review|again|retry)/i,
} as const;

/** Keyword flags from a problem's notes. Starred problems always count as "revisit". */
export function noteFlags(p: Pick<Problem, "notes" | "starred">): { struggle: boolean; revisit: boolean } {
  const notes = p.notes ?? "";
  return { struggle: NOTE_FLAGS.struggle.test(notes), revisit: p.starred || NOTE_FLAGS.revisit.test(notes) };
}

export const isFlagged = (p: Pick<Problem, "notes" | "starred">) => {
  const f = noteFlags(p);
  return f.struggle || f.revisit;
};

export interface HeavyRun {
  startDay: number;
  topic: string;
  days: number;
  proCount: number;
}

/** A day is dominated by a topic when it covers at least this share of the day's problems. */
export const HEAVY_TOPIC_SHARE = 0.6;
/** A single day with this many Pro problems counts as a heavy run on its own. */
export const HEAVY_PRO_COUNT = 3;
export const MAX_HEAVY_RUNS = 10;

type RunInput = Pick<Problem, "day_no" | "topics" | "difficulty">;

/** The topic covering ≥60% of these problems (ties → alphabetical), or null. */
function dominantTopic(ps: RunInput[]): string | null {
  const counts = new Map<string, number>();
  for (const p of ps) for (const t of new Set(p.topics)) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [t, n] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) [best, bestN] = [t, n];
  }
  return best && bestN / ps.length >= HEAVY_TOPIC_SHARE ? best : null;
}

/**
 * Runs of consecutive plan days (consecutive among days that have problems) dominated by one topic.
 * A run counts when it spans ≥2 days or packs ≥3 Pro problems. Deterministic, ordered by start day.
 */
export function detectHeavyRuns(problems: RunInput[]): HeavyRun[] {
  const byDay = new Map<number, RunInput[]>();
  for (const p of problems) byDay.set(p.day_no, [...(byDay.get(p.day_no) ?? []), p]);
  const days = [...byDay.keys()].sort((a, b) => a - b);

  const runs: HeavyRun[] = [];
  let cur: HeavyRun | null = null;
  let prevDay = -Infinity;
  const close = () => {
    if (cur && (cur.days >= 2 || cur.proCount >= HEAVY_PRO_COUNT)) runs.push(cur);
    cur = null;
  };
  for (const day of days) {
    const ps = byDay.get(day)!;
    const topic = dominantTopic(ps);
    const pro = ps.filter((p) => p.difficulty === "Pro").length;
    const contiguous = day === prevDay + 1;
    prevDay = day;
    if (!topic) {
      close();
      continue;
    }
    if (cur && contiguous && (cur as HeavyRun).topic === topic) {
      (cur as HeavyRun).days++;
      (cur as HeavyRun).proCount += pro;
    } else {
      close();
      cur = { startDay: day, topic, days: 1, proCount: pro };
    }
  }
  close();
  return runs.slice(0, MAX_HEAVY_RUNS);
}

export type DifficultyCounts = Record<DifficultyKey, number>;

export interface CoachSignals {
  /** Plan day that is "now". */
  today: number;
  pace: { perActiveDay: number; perCalendarDay: number; activeDays: number };
  difficulty: Record<DifficultyKey, DifficultyPerf>;
  weights: Record<DifficultyKey, number>;
  overdue: { total: number; byDifficulty: DifficultyCounts };
  remaining: { total: number; byDifficulty: DifficultyCounts };
  /** Average undone problems per plan day in the current (unchanged) remaining plan. */
  plannedPerDay: number;
  flaggedUndone: number;
  flaggedTopics: { topic: string; struggle: number; revisit: number }[];
  heavyRuns: HeavyRun[];
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const countBy = (ps: Pick<Problem, "difficulty">[]): DifficultyCounts => {
  const out = Object.fromEntries(DIFFICULTY_KEYS.map((k) => [k, 0])) as DifficultyCounts;
  for (const p of ps) out[diffKey(p.difficulty)]++;
  return out;
};

/** Undone problems the coach may move: from the earliest overdue day (or today) onward. */
export function coachScope<T extends Pick<Problem, "day_no" | "done_at">>(problems: T[], today: number): T[] {
  const undone = problems.filter((p) => !p.done_at);
  const overdue = undone.filter((p) => p.day_no < today);
  const d0 = overdue.length ? Math.min(...overdue.map((p) => p.day_no)) : today;
  return undone.filter((p) => p.day_no >= d0);
}

/** Summary features for the coach. Null when the sprint has no start date (no "today" to plan from). */
export function buildSignals(problems: Problem[], cfg: ScheduleConfig, todayIso: string): CoachSignals | null {
  const cur = currentPlanDay(cfg, todayIso);
  if (!cur) return null;
  const maxDay = problems.reduce((m, p) => Math.max(m, p.day_no), 1);
  const calendar = buildCalendar(maxDay + 1, cfg) ?? [];
  const dateFor = (d: number) => calendar[d - 1] ?? null;

  const doneAts = problems.flatMap((p) => (p.done_at ? [p.done_at] : []));
  const perf = difficultyPerformance(problems, dateFor);
  const undone = problems.filter((p) => !p.done_at);
  const overdue = undone.filter((p) => p.day_no < cur.day);
  const scope = coachScope(problems, cur.day);

  const topicFlags = new Map<string, { topic: string; struggle: number; revisit: number }>();
  for (const p of problems) {
    const f = noteFlags(p);
    if (!f.struggle && !f.revisit) continue;
    for (const topic of new Set(p.topics)) {
      const row = topicFlags.get(topic) ?? { topic, struggle: 0, revisit: 0 };
      if (f.struggle) row.struggle++;
      if (f.revisit) row.revisit++;
      topicFlags.set(topic, row);
    }
  }
  const flaggedTopics = [...topicFlags.values()]
    .sort((a, b) => b.struggle + b.revisit - (a.struggle + a.revisit) || a.topic.localeCompare(b.topic))
    .slice(0, 10);

  const plannedDays = new Set(undone.filter((p) => p.day_no >= cur.day).map((p) => p.day_no)).size;
  const p = pace(doneAts, todayIso);
  const difficulty = Object.fromEntries(
    DIFFICULTY_KEYS.map((k) => {
      const d = perf[k];
      return [k, { ...d, completionRate: round(d.completionRate), avgLagDays: d.avgLagDays == null ? null : round(d.avgLagDays, 1) }];
    }),
  ) as Record<DifficultyKey, DifficultyPerf>;

  return {
    today: cur.day,
    pace: { perActiveDay: round(p.perActiveDay), perCalendarDay: round(p.perCalendarDay), activeDays: p.activeDays },
    difficulty,
    weights: effortWeights(perf),
    overdue: { total: overdue.length, byDifficulty: countBy(overdue) },
    remaining: { total: undone.length, byDifficulty: countBy(undone) },
    plannedPerDay: plannedDays ? round(undone.filter((q) => q.day_no >= cur.day).length / plannedDays) : 0,
    flaggedUndone: undone.filter(isFlagged).length,
    flaggedTopics,
    heavyRuns: detectHeavyRuns(scope),
  };
}

export const todayIso = () => format(new Date(), "yyyy-MM-dd");
