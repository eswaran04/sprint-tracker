import { streaks, toLocalDate } from "@/lib/stats";
import type { GroupMember, GroupProgressRow, Problem } from "@/lib/types";

/** Key shared by the same problem across members' copies. */
export const problemKey = (p: { id: string; source_id: string | null }) => p.source_id ?? p.id;

/** problem key → (user id → completion timestamp). */
export function progressIndex(rows: GroupProgressRow[]) {
  const idx = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const byUser = idx.get(r.problem_key) ?? new Map<string, string>();
    byUser.set(r.user_id, r.done_at);
    idx.set(r.problem_key, byUser);
  }
  return idx;
}

export interface LeaderboardRow {
  member: GroupMember;
  done: number;
  doneToday: number;
  streak: number;
  lastActive: string | null;
}

export function leaderboard(members: GroupMember[], rows: GroupProgressRow[], today: string): LeaderboardRow[] {
  return members
    .map((member) => {
      const mine = rows.filter((r) => r.user_id === member.user_id).map((r) => r.done_at);
      return {
        member,
        done: mine.length,
        doneToday: mine.filter((d) => toLocalDate(d) === today).length,
        streak: streaks(mine, today).current,
        lastActive: mine.length ? mine.reduce((a, b) => (a > b ? a : b)) : null,
      };
    })
    .sort((a, b) => b.done - a.done || (b.lastActive ?? "").localeCompare(a.lastActive ?? "") || a.member.display_name.localeCompare(b.member.display_name));
}

/** Your sheet as `userId` sees it: their completions, none of your stars or notes. */
export function asMember(problems: Problem[], index: Map<string, Map<string, string>>, userId: string): Problem[] {
  return problems.map((p) => ({ ...p, done_at: index.get(problemKey(p))?.get(userId) ?? null, starred: false, notes: "" }));
}

const newestFirst = (a: Problem, b: Problem) => (b.done_at ?? "").localeCompare(a.done_at ?? "");

/** Compare two views of the same sheet (same order). `theyOnly` is newest first. */
export function headToHead(mine: Problem[], theirs: Problem[]) {
  let both = 0;
  let meOnly = 0;
  const theyOnly: Problem[] = [];
  theirs.forEach((t, i) => {
    const m = mine[i].done_at;
    if (m && t.done_at) both++;
    else if (m) meOnly++;
    else if (t.done_at) theyOnly.push(t);
  });
  return { both, meOnly, theyOnly: theyOnly.sort(newestFirst) };
}

export const recentSolves = (problems: Problem[], limit = 10) => problems.filter((p) => p.done_at).sort(newestFirst).slice(0, limit);
