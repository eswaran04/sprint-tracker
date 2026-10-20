import { differenceInCalendarDays, parseISO } from "date-fns";
import { stripReview } from "@/lib/review/blocks";
import type { Problem } from "@/lib/types";

/** Spaced-repetition checkpoints (days since solving), most valuable first. */
export const RECALL_INTERVALS = [30, 14, 7] as const;
/** A problem one day either side of a checkpoint still counts, so a skipped day doesn't hide a review. */
const SLACK = 1;

export type TheorySubject = "dbms" | "oops" | "os" | "cn";

const THEORY: Record<string, TheorySubject> = {
  dbms: "dbms",
  database: "dbms",
  databases: "dbms",
  databasemanagementsystem: "dbms",
  databasemanagementsystems: "dbms",
  oops: "oops",
  oop: "oops",
  objectorientedprogramming: "oops",
  os: "os",
  operatingsystem: "os",
  operatingsystems: "os",
  cn: "cn",
  computernetwork: "cn",
  computernetworks: "cn",
  networking: "cn",
};

/** Canonical theory subject for a sheet's subject value ("OOP", "operating-systems"...), or null for DSA etc. */
export function theorySubject(subject: string): TheorySubject | null {
  return THEORY[subject.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

export const isTheory = (p: Pick<Problem, "subject">) => theorySubject(p.subject) !== null;

/** Whole calendar days (local time) between when the problem was done and `todayIso` (yyyy-MM-dd). */
export function daysSince(doneAt: string, todayIso: string) {
  return differenceInCalendarDays(parseISO(todayIso), new Date(doneAt));
}

/** "a week ago", "two weeks ago", "12 days ago"... */
export function agoLabel(days: number) {
  if (days <= 1) return "yesterday";
  if (days === 7) return "a week ago";
  if (days === 14) return "two weeks ago";
  if (days === 30) return "a month ago";
  return `${days} days ago`;
}

export interface RecallCandidate {
  problem: Problem;
  daysAgo: number;
  reason: "interval" | "starred";
}

/** FNV-1a: a cheap stable hash so the starred rotation changes daily but not between renders. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function intervalScore(days: number) {
  for (const [i, interval] of RECALL_INTERVALS.entries()) {
    const off = Math.abs(days - interval);
    if (off <= SLACK) return (RECALL_INTERVALS.length - i) * 100 + (off === 0 ? 50 : 0);
  }
  return 0;
}

/**
 * Picks up to `max` solved problems to quiz today: ones that hit a 7/14/30-day checkpoint (30 > 14 > 7, exact
 * day > ±1), then starred ones. Problems with notes rank higher since the question is built from them. Problems
 * finished today are skipped. Deterministic for a given day.
 */
export function pickRecall(problems: Problem[], todayIso: string, max = 2): RecallCandidate[] {
  const scored: (RecallCandidate & { score: number; tie: number })[] = [];
  for (const problem of problems) {
    if (!problem.done_at) continue;
    const daysAgo = daysSince(problem.done_at, todayIso);
    if (!(daysAgo >= 1)) continue;
    const interval = intervalScore(daysAgo);
    if (!interval && !problem.starred) continue;
    const notes = stripReview(problem.notes ?? "") ? 10 : 0;
    scored.push({
      problem,
      daysAgo,
      reason: interval ? "interval" : "starred",
      score: interval + notes,
      tie: hash(`${problem.id}:${todayIso}`),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.slice(0, max).map(({ problem, daysAgo, reason }) => ({ problem, daysAgo, reason }));
}
