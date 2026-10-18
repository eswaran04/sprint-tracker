import { scheduleConfig } from "@/lib/coach/plan";
import { leaderboard, problemKey, progressIndex } from "@/lib/groups";
import { currentPlanDay } from "@/lib/schedule";
import type { DigestFacts, GroupActivityRow, GroupMember, GroupProgressRow, Problem, Sprint } from "@/lib/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 3;

export interface DigestInput {
  groupName: string;
  /** The caller's user id. */
  me: string;
  members: GroupMember[];
  /** All completions in the group (`group_progress`). */
  progress: GroupProgressRow[];
  /** Last 7 days of solves (`group_activity`); only used for weekly counts. */
  activity: GroupActivityRow[];
  /** The caller's own sheet (catalogue fields are read; notes and stars never are). */
  problems: Problem[];
  sprint: Pick<Sprint, "start_date" | "skip_weekends" | "rest_days">;
  /** Client's local date, yyyy-MM-dd. */
  today: string;
  /** Server clock, for the "cleared in the last 7 days" window. */
  now?: Date;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * Deterministic facts for the weekly digest. Everything the card says comes from here; the model only rewords it.
 * Returns null when there's nothing to build from (not a member, or an empty sheet).
 */
export function buildDigestFacts({ groupName, me, members, progress, activity, problems, sprint, today, now = new Date() }: DigestInput): DigestFacts | null {
  const self = members.find((m) => m.user_id === me);
  if (!self || problems.length === 0) return null;

  const index = progressIndex(progress);
  const board = leaderboard(members, progress, today);
  const row = (userId: string) => board.find((r) => r.member.user_id === userId)!;
  const weekStart = now.getTime() - WEEK_MS;

  // Weekly solves per member (activity is already limited to the last 7 days server-side).
  const weekCount = new Map<string, number>();
  for (const a of activity) weekCount.set(a.user_id, (weekCount.get(a.user_id) ?? 0) + 1);

  const weekly = members
    .map((m) => ({ userId: m.user_id, name: m.display_name, solves: weekCount.get(m.user_id) ?? 0, streak: row(m.user_id).streak }))
    .filter((w) => w.solves > 0)
    .sort((a, b) => b.solves - a.solves || b.streak - a.streak || byName(a, b))
    .slice(0, MAX_ITEMS);

  // Sprints a member finished entirely, with the finishing solve inside the last 7 days.
  const sprints = new Map<number, string[]>();
  for (const p of problems) sprints.set(p.sprint_no, [...(sprints.get(p.sprint_no) ?? []), problemKey(p)]);
  const cleared: DigestFacts["cleared"] = [];
  for (const m of members) {
    for (const [sprintNo, keys] of [...sprints].sort(([a], [b]) => a - b)) {
      const times = keys.map((k) => index.get(k)?.get(m.user_id));
      if (times.some((t) => !t)) continue;
      const last = Math.max(...times.map((t) => Date.parse(t!)));
      if (last >= weekStart && last <= now.getTime() + 60_000) {
        cleared.push({ userId: m.user_id, name: m.display_name, sprintNo, problems: keys.length });
      }
    }
  }
  cleared.sort((a, b) => b.sprintNo - a.sprintNo || byName(a, b));

  // Where you stand.
  const plan = currentPlanDay(scheduleConfig(sprint), today);
  const mineDone = (p: Problem) => Boolean(index.get(problemKey(p))?.get(me));
  const overdue = plan ? problems.filter((p) => p.day_no < plan.day && !mineDone(p)).length : null;
  const myDone = row(me).done;
  const nextAhead = board
    .filter((r) => r.member.user_id !== me && r.done > myDone)
    .sort((a, b) => a.done - b.done || a.member.display_name.localeCompare(b.member.display_name))[0];
  const behind: DigestFacts["behind"] = {
    overdue,
    planDay: plan?.day ?? null,
    ahead: nextAhead ? { userId: nextAhead.member.user_id, name: nextAhead.member.display_name, by: nextAhead.done - myDone } : null,
  };

  // Pair-ups: problems a teammate solved that you haven't. Due-for-you first, then sheet order.
  const pairUp: DigestFacts["pairUp"] = [];
  const candidates = problems
    .filter((p) => !mineDone(p))
    .map((p) => ({ p, due: plan ? p.day_no <= plan.day : false }))
    .sort((a, b) => Number(b.due) - Number(a.due) || a.p.day_no - b.p.day_no || a.p.position - b.p.position);
  for (const { p, due } of candidates) {
    if (pairUp.length >= MAX_ITEMS) break;
    const solvers = index.get(problemKey(p));
    if (!solvers) continue;
    // Most recent solver remembers it best; ties broken by name for stable output.
    const partner = members
      .filter((m) => m.user_id !== me && solvers.has(m.user_id))
      .sort((a, b) => solvers.get(b.user_id)!.localeCompare(solvers.get(a.user_id)!) || a.display_name.localeCompare(b.display_name))[0];
    if (!partner) continue;
    pairUp.push({
      partner: { userId: partner.user_id, name: partner.display_name },
      problem: { key: problemKey(p), name: p.name, url: p.url, difficulty: p.difficulty },
      dueForMe: due,
    });
  }

  const meRow = row(me);
  return {
    groupName,
    me: { userId: me, name: self.display_name, weekSolves: weekCount.get(me) ?? 0, streak: meRow.streak, done: meRow.done },
    memberCount: members.length,
    weekSolves: activity.length,
    weekly,
    cleared: cleared.slice(0, MAX_ITEMS),
    behind,
    pairUp,
  };
}

/** Nothing worth asking a model about: the template says it just as well. */
export const isQuietWeek = (f: DigestFacts) =>
  f.weekSolves === 0 && f.cleared.length === 0 && f.pairUp.length === 0 && !f.behind.overdue && !f.behind.ahead;
