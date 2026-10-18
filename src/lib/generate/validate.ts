import { isWeekend, parseISO } from "date-fns";
import { TOP_UP_RATIO } from "./assemble";
import { computeCapacity, minutesFor } from "./capacity";
import { problemKey, type CatalogueProblem } from "./catalogue";
import { MAX_PER_DAY, PlanSchema, type GenerateResponse } from "./schema";

/**
 * Checks a generated sprint plan against the rules the generator promises (see `PLAN_SYSTEM` and `assemble`).
 * Used by the quality benchmarks to report a pass rate; never on the request path.
 */

export type ViolationCode =
  | "empty"
  | "unknown_problem"
  | "altered_problem"
  | "duplicate"
  | "day_over_budget"
  | "day_too_many"
  | "too_many_days"
  | "day_gap"
  | "position_order"
  | "sprint_order"
  | "underfilled"
  | "weak_not_first"
  | "bad_start";

export interface Violation {
  code: ViolationCode;
  message: string;
}

export interface PlanValidation {
  ok: boolean;
  violations: Violation[];
}

export function validatePlan(result: GenerateResponse, catalogue: CatalogueProblem[], today: string): PlanValidation {
  const v: Violation[] = [];
  const add = (code: ViolationCode, message: string) => v.push({ code, message });
  const { goal, rows } = result;

  if (!rows.length) {
    add("empty", "The plan has no problems.");
    return { ok: false, violations: v };
  }

  const byKey = new Map(catalogue.map((p) => [problemKey(p.name, p.url), p]));
  const seen = new Set<string>();
  for (const r of rows) {
    const key = problemKey(r.name, r.url);
    const src = byKey.get(key);
    if (!src) add("unknown_problem", `"${r.name}" is not in the catalogue.`);
    else if (src.difficulty !== r.difficulty || src.name !== r.name) add("altered_problem", `"${r.name}" differs from its catalogue entry.`);
    if (seen.has(key)) add("duplicate", `"${r.name}" appears more than once.`);
    seen.add(key);
  }

  const capacity = computeCapacity({
    startDate: result.start_date,
    weeks: goal.weeks,
    hoursPerDay: goal.hours_per_day,
    skipWeekends: result.skip_weekends,
    restDays: result.rest_days,
    mix: goal.difficulty_mix,
  });

  const days = new Map<number, { minutes: number; count: number }>();
  for (const r of rows) {
    const d = days.get(r.day_no) ?? { minutes: 0, count: 0 };
    d.minutes += minutesFor(r.difficulty);
    d.count++;
    days.set(r.day_no, d);
  }
  for (const [day, d] of days) {
    // A single problem may exceed a tiny budget (assemble always places at least one per day).
    if (d.count > 1 && d.minutes > capacity.dailyMinutes) add("day_over_budget", `Day ${day} needs ${d.minutes} min (budget ${capacity.dailyMinutes}).`);
    if (d.count > MAX_PER_DAY) add("day_too_many", `Day ${day} has ${d.count} problems (max ${MAX_PER_DAY}).`);
  }
  const maxDay = Math.max(...days.keys());
  if (maxDay > capacity.workingDays) add("too_many_days", `Plan uses ${maxDay} days but only ${capacity.workingDays} are available.`);
  for (let d = 1; d <= maxDay; d++) if (!days.has(d)) add("day_gap", `Day ${d} is empty.`);

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].position <= rows[i - 1].position || rows[i].day_no < rows[i - 1].day_no) add("position_order", `Row ${i} is out of order.`);
    if (rows[i].sprint_no < rows[i - 1].sprint_no) add("sprint_order", `Row ${i} goes back to an earlier sprint.`);
  }

  // Only judge fill when the catalogue could actually supply enough problems.
  if (catalogue.length >= capacity.target && rows.length < capacity.target * TOP_UP_RATIO) {
    add("underfilled", `${rows.length} problems for a target of ~${capacity.target}.`);
  }

  const weak = goal.weak_topics.map((t) => t.toLowerCase());
  const isWeak = (r: (typeof rows)[number]) => r.topics.some((t) => weak.includes(t.toLowerCase()));
  // Weak topics should lead the plan: if any were scheduled, day 1 must include one.
  if (weak.length && rows.some(isWeak) && !rows.some((r) => r.day_no === 1 && isWeak(r))) {
    add("weak_not_first", "Day 1 has no weak-topic problem.");
  }

  if (result.start_date < today) add("bad_start", `Start date ${result.start_date} is in the past.`);
  if (result.skip_weekends && isWeekend(parseISO(result.start_date))) add("bad_start", `Start date ${result.start_date} is a weekend.`);

  return { ok: v.length === 0, violations: v };
}

/** Strict check of a raw planner output, before `assemble` repairs it: schema-valid, known IDs only, no repeats. */
export function validateRawPlan(plan: unknown, candidateIds: ReadonlySet<string>): PlanValidation {
  const parsed = PlanSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, violations: [{ code: "unknown_problem", message: "Output does not match PlanSchema." }] };
  const v: Violation[] = [];
  const seen = new Set<string>();
  for (const s of parsed.data.sprints) {
    for (const d of s.days) {
      for (const id of d.ids) {
        if (!candidateIds.has(id)) v.push({ code: "unknown_problem", message: `Unknown id ${id}.` });
        if (seen.has(id)) v.push({ code: "duplicate", message: `Id ${id} repeated.` });
        seen.add(id);
      }
    }
  }
  return { ok: v.length === 0, violations: v };
}
