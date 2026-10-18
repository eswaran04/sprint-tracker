import type { Change } from "@/lib/schedule";

type DiffProblem = { id: string; day_no: number; done_at: string | null };

export interface PlanDay<P> {
  day: number;
  before: P[];
  after: P[];
}

export interface PlanSummary<P = DiffProblem> {
  moved: number;
  daysAdded: number;
  reviewDays: number[];
  /** Last plan day before / after applying the changes. */
  oldEnd: number;
  newEnd: number;
  byDay: PlanDay<P>[];
  label: string;
  /** id → day_no at plan time, used to detect a stale plan before applying. */
  from: Record<string, number>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function planLabel(moved: number, daysAdded: number) {
  if (!moved) return "No changes needed";
  const days = daysAdded < 0 ? `${plural(-daysAdded, "day")} saved` : `${plural(daysAdded, "day")} added`;
  return `${plural(moved, "problem")} move${moved === 1 ? "s" : ""}, ${days}`;
}

/** Human-readable diff between the current plan and `changes`. */
export function summarizePlan<P extends DiffProblem>(problems: P[], changes: Change[], reviewDays: number[] = []): PlanSummary<P> {
  const next = new Map(changes.map((c) => [c.id, c.day_no]));
  const moving = problems.filter((p) => next.has(p.id) && next.get(p.id) !== p.day_no);
  const oldEnd = problems.reduce((m, p) => Math.max(m, p.day_no), 0);
  const newEnd = problems.reduce((m, p) => Math.max(m, next.get(p.id) ?? p.day_no), 0);

  const touched = new Set<number>();
  for (const p of moving) {
    touched.add(p.day_no);
    touched.add(next.get(p.id)!);
  }
  const byDay = [...touched]
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      before: problems.filter((p) => p.day_no === day),
      after: problems.filter((p) => (next.get(p.id) ?? p.day_no) === day),
    }));

  return {
    moved: moving.length,
    daysAdded: newEnd - oldEnd,
    reviewDays: [...reviewDays].sort((a, b) => a - b),
    oldEnd,
    newEnd,
    byDay,
    label: planLabel(moving.length, newEnd - oldEnd),
    from: Object.fromEntries(moving.map((p) => [p.id, p.day_no])),
  };
}

/**
 * True when the problems a plan touches have changed since it was generated
 * (moved to another day, or finished in the meantime).
 */
export function isPlanStale(from: Record<string, number>, problems: DiffProblem[]): boolean {
  const byId = new Map(problems.map((p) => [p.id, p]));
  return Object.entries(from).some(([id, day]) => {
    const p = byId.get(id);
    return !p || p.day_no !== day || Boolean(p.done_at);
  });
}
