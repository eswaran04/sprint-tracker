import type { ProblemInput } from "@/lib/types";
import { minutesFor, type Capacity } from "./capacity";
import type { RankedProblem } from "./catalogue";
import { MAX_PER_DAY, type Plan, type SprintTheme } from "./schema";

/** A plan day after validation: catalogue IDs plus the index of the sprint it belongs to. */
interface Day {
  sprint: number;
  ids: string[];
  minutes: number;
}

export interface Assembled {
  rows: ProblemInput[];
  sprints: SprintTheme[];
  warnings: string[];
}

/** Below this share of the target, the plan is topped up from the ranked pool. */
export const TOP_UP_RATIO = 0.7;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function fits(day: Day, minutes: number, budget: number) {
  return day.ids.length < MAX_PER_DAY && (day.ids.length === 0 || day.minutes + minutes <= budget);
}

/**
 * Turns an untrusted LLM plan into schedule rows. Unknown or repeated IDs are dropped, empty days/sprints vanish,
 * days over the time budget spill into the next day, and nothing goes past the last working day. If the result
 * is too thin it is topped up from the ranked pool; with `plan = null` this is the full deterministic fallback.
 */
export function assemble(opts: {
  plan: Plan | null;
  byId: Map<string, RankedProblem>;
  /** Candidate IDs in rank order (used for top-up / fallback). */
  rankedIds: string[];
  capacity: Capacity;
  weakTopics: string[];
}): Assembled {
  const { byId, capacity } = opts;
  const budget = Math.max(capacity.dailyMinutes, 1);
  const warnings: string[] = [];
  const used = new Set<string>();
  const days: Day[] = [];
  const themes: string[] = [];
  let unknown = 0;
  let repeated = 0;
  let overflow = 0;

  const newDay = (sprint: number) => {
    const d: Day = { sprint, ids: [], minutes: 0 };
    days.push(d);
    return d;
  };

  for (const s of opts.plan?.sprints ?? []) {
    const sprintIdx = themes.length;
    const startLen = days.length;
    for (const planDay of s.days) {
      if (days.length >= capacity.workingDays) {
        overflow += planDay.ids.filter((id) => byId.has(id) && !used.has(id)).length;
        continue;
      }
      let day: Day | null = null;
      for (const id of planDay.ids) {
        const p = byId.get(id);
        if (!p) { unknown++; continue; }
        if (used.has(id)) { repeated++; continue; }
        const m = minutesFor(p.difficulty);
        if (!day || !fits(day, m, budget)) {
          if (days.length >= capacity.workingDays) { overflow++; continue; }
          day = newDay(sprintIdx);
        }
        day.ids.push(id);
        day.minutes += m;
        used.add(id);
      }
    }
    if (days.length > startLen) themes.push(s.theme.trim() || `Sprint ${sprintIdx + 1}`);
  }

  if (unknown) warnings.push(`Ignored ${plural(unknown, "unknown problem ID")} from the planner.`);
  if (repeated) warnings.push(`Removed ${plural(repeated, "duplicate problem")}.`);
  if (overflow) warnings.push(`Dropped ${plural(overflow, "problem")} that didn't fit in your time window.`);

  const planned = used.size;
  if (planned < capacity.target * TOP_UP_RATIO) {
    const added = topUp(days, themes, opts, used, budget);
    if (opts.plan && added) warnings.push(`Added ${plural(added, "problem")} to fill your schedule.`);
  }

  const rows: ProblemInput[] = [];
  days.forEach((d, i) => {
    for (const id of d.ids) {
      const p = byId.get(id)!;
      rows.push({
        position: rows.length,
        name: p.name,
        url: p.url,
        subject: p.subject,
        difficulty: p.difficulty,
        companies: [...p.companies],
        topics: [...p.topics],
        sprint_no: d.sprint + 1,
        day_no: i + 1,
      });
    }
  });

  if (rows.length && rows.length < capacity.target * TOP_UP_RATIO) {
    warnings.push(`Only ${plural(rows.length, "matching problem")} available — fewer than your schedule could fit (~${capacity.target}).`);
  }
  return { rows, sprints: themes.map((theme, i) => ({ sprint_no: i + 1, theme })), warnings };
}

/** Orders the unused pool for packing: weak topics first, then by topic, easier before harder. */
function packingOrder(ids: string[], byId: Map<string, RankedProblem>, weakTopics: string[]) {
  const weak = weakTopics.map((t) => t.toLowerCase());
  const level = { Basic: 0, Core: 1, Pro: 2 } as const;
  const groupOf = (p: RankedProblem) => {
    const w = weak.findIndex((t) => p.topics.some((x) => x.toLowerCase() === t));
    return w >= 0 ? `0:${w}` : `1:${(p.topics[0] ?? "~").toLowerCase()}`;
  };
  const rankIdx = new Map(ids.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => {
    const pa = byId.get(a)!, pb = byId.get(b)!;
    return (
      groupOf(pa).localeCompare(groupOf(pb)) ||
      (pa.difficulty ? level[pa.difficulty] : 1) - (pb.difficulty ? level[pb.difficulty] : 1) ||
      rankIdx.get(a)! - rankIdx.get(b)!
    );
  });
}

function topUp(
  days: Day[],
  themes: string[],
  opts: { byId: Map<string, RankedProblem>; rankedIds: string[]; capacity: Capacity; weakTopics: string[] },
  used: Set<string>,
  budget: number,
) {
  const { byId, capacity } = opts;
  const need = capacity.target - used.size;
  // Take the best-ranked unused candidates, then order them for a sensible progression.
  const pool = packingOrder(opts.rankedIds.filter((id) => !used.has(id)).slice(0, Math.max(need, 0)), byId, opts.weakTopics);
  let added = 0;
  let i = 0;
  const firstNew = themes.length;

  // 1) New days after the planned ones, grouped into week-long sprints. Problems are spread evenly over the
  //    remaining days (not packed greedily), so the plan doesn't finish early and leave the last days empty.
  let day: Day | null = null;
  let dayCap = 0;
  while (i < pool.length) {
    const id = pool[i];
    const m = minutesFor(byId.get(id)!.difficulty);
    if (!day || day.ids.length >= dayCap || !fits(day, m, budget)) {
      if (days.length >= capacity.workingDays) break;
      dayCap = Math.ceil((pool.length - i) / (capacity.workingDays - days.length));
      const sprint = firstNew + Math.floor((days.length - countBefore(days, firstNew)) / capacity.sprintLength);
      day = { sprint, ids: [], minutes: 0 };
      days.push(day);
    }
    day.ids.push(id);
    day.minutes += m;
    used.add(id);
    added++;
    i++;
  }
  // 2) Slack in existing days.
  for (const d of days) {
    while (i < pool.length && fits(d, minutesFor(byId.get(pool[i])!.difficulty), budget) && d.ids.length > 0) {
      d.ids.push(pool[i]);
      d.minutes += minutesFor(byId.get(pool[i])!.difficulty);
      used.add(pool[i]);
      added++;
      i++;
    }
  }

  // Name the new sprints after their dominant topics.
  const maxSprint = days.reduce((m, d) => Math.max(m, d.sprint), -1);
  for (let s = firstNew; s <= maxSprint; s++) {
    const counts = new Map<string, number>();
    for (const d of days) if (d.sprint === s) for (const id of d.ids) for (const t of byId.get(id)!.topics.slice(0, 1)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
    themes[s] = top.length ? top.join(" & ") : `Sprint ${s + 1}`;
  }
  return added;
}

/** Number of days belonging to sprints before `sprint` (days are in sprint order). */
function countBefore(days: Day[], sprint: number) {
  return days.filter((d) => d.sprint < sprint).length;
}
