import { addDays, format, isWeekend, parseISO } from "date-fns";

export interface ScheduleConfig {
  startDate: string | null; // yyyy-MM-dd
  skipWeekends: boolean;
  restDays: string[];
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function isWorking(d: Date, cfg: ScheduleConfig, rest: Set<string>) {
  return !(cfg.skipWeekends && isWeekend(d)) && !rest.has(iso(d));
}

/** Calendar date (yyyy-MM-dd) of plan day `dayNo` (1-based), or null when no start date is set. */
export function dayToDate(dayNo: number, cfg: ScheduleConfig): string | null {
  return buildCalendar(dayNo, cfg)?.[dayNo - 1] ?? null;
}

/** Dates for plan days 1..maxDay. Guards against configs that block every day. */
export function buildCalendar(maxDay: number, cfg: ScheduleConfig): string[] | null {
  if (!cfg.startDate) return null;
  const rest = new Set(cfg.restDays);
  const out: string[] = [];
  let d = parseISO(cfg.startDate);
  for (let guard = 0; out.length < maxDay && guard < maxDay * 7 + 400; guard++, d = addDays(d, 1)) {
    if (isWorking(d, cfg, rest)) out.push(iso(d));
  }
  return out;
}

/**
 * The plan day that is "now": today's plan day on a working day, otherwise the next upcoming one.
 * Anything scheduled before it (and not done) is overdue.
 */
export function currentPlanDay(cfg: ScheduleConfig, today: string): { day: number; isWorkingDay: boolean } | null {
  if (!cfg.startDate) return null;
  const rest = new Set(cfg.restDays);
  const target = parseISO(today);
  let count = 0;
  let d = parseISO(cfg.startDate);
  while (d <= target) {
    if (isWorking(d, cfg, rest)) count++;
    d = addDays(d, 1);
  }
  const working = target >= parseISO(cfg.startDate) && isWorking(target, cfg, rest);
  return working ? { day: count, isWorkingDay: true } : { day: count + 1, isWorkingDay: false };
}

/** Sprint number for a plan day, derived from the sheet's original day→sprint layout. */
export function makeSprintForDay(rows: { original_day_no: number; sprint_no: number; original_sprint_no?: number | null }[]) {
  const byDay = new Map<number, number>();
  for (const r of rows) if (!byDay.has(r.original_day_no)) byDay.set(r.original_day_no, r.original_sprint_no ?? r.sprint_no);
  const days = [...byDay.keys()].sort((a, b) => a - b);
  return (day: number): number => {
    let sprint = days.length ? byDay.get(days[0])! : 1;
    for (const d of days) {
      if (d > day) break;
      sprint = byDay.get(d)!;
    }
    return sprint;
  };
}

/** One problem's new placement; the payload of the `reschedule` op / `reschedule_problems`. */
export interface Change {
  id: string;
  day_no: number;
  sprint_no: number;
}

/**
 * Pushes every undone problem on or after each gap day forward by one day per gap at or before it,
 * leaving those plan days empty (e.g. review days). Done problems stay put.
 */
export function insertGapDays(
  problems: { id: string; day_no: number; done_at: string | null }[],
  gapDays: number[],
  sprintFor: (day: number) => number,
): Change[] {
  const gaps = [...new Set(gapDays)].sort((a, b) => a - b);
  if (!gaps.length) return [];
  const out: Change[] = [];
  for (const p of problems) {
    if (p.done_at) continue;
    let delta = 0;
    for (const g of gaps) if (p.day_no + delta >= g) delta++;
    if (delta) out.push({ id: p.id, day_no: p.day_no + delta, sprint_no: sprintFor(p.day_no + delta) });
  }
  return out;
}

/**
 * Slide the unfinished plan forward so the earliest overdue day lands on `today`.
 * Every undone problem on or after that day moves by the same delta; done problems stay put.
 */
export function shiftBacklog(
  problems: { id: string; day_no: number; done_at: string | null }[],
  today: number,
  sprintFor: (day: number) => number,
) {
  const overdue = problems.filter((p) => !p.done_at && p.day_no < today);
  if (!overdue.length) return [];
  const d0 = Math.min(...overdue.map((p) => p.day_no));
  const delta = today - d0;
  return problems
    .filter((p) => !p.done_at && p.day_no >= d0)
    .map((p) => ({ id: p.id, day_no: p.day_no + delta, sprint_no: sprintFor(p.day_no + delta) }));
}

/**
 * The plan day the user is actively working on: the next undone problem after their most recently
 * completed one, so a skipped problem in an old sprint doesn't pin the view there.
 * Falls back to the calendar day (nothing done yet), then the first undone problem.
 */
export function workingDay(problems: { day_no: number; done_at: string | null }[], currentDay: number | null): number | null {
  if (!problems.length) return null;
  const ordered = problems.map((p, i) => ({ p, i })).sort((a, b) => a.p.day_no - b.p.day_no || a.i - b.i).map(({ p }) => p);
  const firstUndone = ordered.find((p) => !p.done_at);
  if (!firstUndone) return ordered.at(-1)!.day_no;

  let last = -1;
  ordered.forEach((p, i) => {
    if (p.done_at && (last === -1 || p.done_at > ordered[last].done_at!)) last = i;
  });
  if (last === -1) {
    const calendar = currentDay == null ? undefined : ordered.find((p) => p.day_no >= currentDay);
    return (calendar ?? firstUndone).day_no;
  }
  return (ordered.slice(last + 1).find((p) => !p.done_at) ?? firstUndone).day_no;
}
