import type { DigestFacts } from "@/lib/types";

export const DIGEST_SYSTEM = `You write a short, upbeat weekly digest for a small study group preparing for coding interviews.
You are given FACTS as JSON. Reword them; never invent people, numbers, problems or events that are not in the facts.
Reply with JSON only, matching the schema.

- headline: at most 80 characters. Celebrate the biggest fact (a cleared sprint, the weekly leader, or the group total).
- lines: 2 to 4 sentences, each at most 160 characters, written to the reader ("you" = facts.reader).
  1. Celebrate the weekly leaders and any cleared sprints, with their numbers.
  2. Tell the reader where they stand: overdue problems vs their plan, or how far the closest peer is ahead.
     Be encouraging, never shaming.
  3. If pairUp is non-empty, suggest asking the partner about one of those problems by name.
- Plain text only: no markdown, no emoji spam (one emoji at most), no URLs.`;

/** Facts as the model sees them: names and numbers only (no ids, urls, notes or stars). */
export function digestUser(f: DigestFacts): string {
  const facts = {
    group: f.groupName,
    reader: { name: f.me.name, solvesThisWeek: f.me.weekSolves, streakDays: f.me.streak, totalSolved: f.me.done },
    members: f.memberCount,
    groupSolvesThisWeek: f.weekSolves,
    weeklyLeaders: f.weekly.map((w) => ({ name: w.name, solves: w.solves, streakDays: w.streak, isReader: w.userId === f.me.userId })),
    clearedSprints: f.cleared.map((c) => ({ name: c.name, sprint: c.sprintNo, problems: c.problems, isReader: c.userId === f.me.userId })),
    readerStanding: {
      overdueVsPlan: f.behind.overdue,
      planDay: f.behind.planDay,
      closestAhead: f.behind.ahead && { name: f.behind.ahead.name, problemsAhead: f.behind.ahead.by },
    },
    pairUp: f.pairUp.map((p) => ({ partner: p.partner.name, problem: p.problem.name, difficulty: p.problem.difficulty, dueForReader: p.dueForMe })),
  };
  return `FACTS:\n${JSON.stringify(facts)}`;
}
