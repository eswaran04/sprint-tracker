import { formatSubject } from "@/lib/format";
import { currentPlanDay } from "@/lib/schedule";
import { streaks, summary } from "@/lib/stats";
import type { CompanyReadiness, Difficulty, Problem, ReportStats, Sprint } from "@/lib/types";

/**
 * Readiness scoring for the shareable report. Harder problems count more, so a company score moves most when
 * its Pro problems get solved: score = 100 × Σweight(done) / Σweight(all).
 */
export const WEIGHTS: Record<Difficulty | "unrated", number> = { Basic: 1, Core: 2, Pro: 3, unrated: 1.5 };

type Scored = Pick<Problem, "difficulty" | "done_at">;
type Bucketed = Pick<Problem, "difficulty" | "done_at" | "topics" | "subject">;

export const weightOf = (p: Pick<Problem, "difficulty">) => WEIGHTS[p.difficulty ?? "unrated"];

/** Below this many problems a company/topic score is "early" (low confidence). */
export const HIGH_CONFIDENCE = 8;

interface Bucket {
  key: string;
  total: number;
  done: number;
  weight: number;
  doneWeight: number;
  proLeft: number;
}

function bucketize<P extends Scored>(problems: P[], keys: (p: P) => string[]): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const p of problems) {
    const w = weightOf(p);
    for (const key of new Set(keys(p).map((k) => k.trim()).filter(Boolean))) {
      const b = m.get(key) ?? { key, total: 0, done: 0, weight: 0, doneWeight: 0, proLeft: 0 };
      b.total++;
      b.weight += w;
      if (p.done_at) {
        b.done++;
        b.doneWeight += w;
      } else if (p.difficulty === "Pro") {
        b.proLeft++;
      }
      m.set(key, b);
    }
  }
  return [...m.values()];
}

const scoreOf = (b: Bucket) => (b.weight ? Math.round((100 * b.doneWeight) / b.weight) : 0);

/**
 * Weighted readiness per company, biggest (by total weight) first. Companies with fewer than `minProblems`
 * problems are dropped so the card never claims "100% Ready for Netflix" from a single problem.
 */
export function companyReadiness(
  problems: Pick<Problem, "difficulty" | "done_at" | "companies">[],
  { minProblems = 5, limit = 3 }: { minProblems?: number; limit?: number } = {},
): CompanyReadiness[] {
  return bucketize(problems, (p) => p.companies)
    .filter((b) => b.total >= minProblems)
    .sort((a, b) => b.weight - a.weight || scoreOf(b) - scoreOf(a) || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((b) => ({
      company: b.key,
      score: scoreOf(b),
      done: b.done,
      total: b.total,
      confidence: b.total >= HIGH_CONFIDENCE ? "high" : "low",
    }));
}

export interface SkillScore {
  key: string;
  score: number;
  total: number;
  proLeft: number;
}

export interface SkillProfile {
  /** Every topic/subject with enough problems, best first. */
  skills: SkillScore[];
  /** Up to 2 buckets scoring ≥ 60. */
  strengths: string[];
  /** Up to 2 buckets scoring < 50, weakest first (ties: most unsolved Pro). */
  weaknesses: string[];
}

/**
 * Weighted completion per topic and per (non-DSA) subject, so the scout can say "vulnerable in OS Concurrency".
 * Buckets with fewer than `minProblems` problems are ignored.
 */
export function skillProfile(problems: Bucketed[], { minProblems = 3 }: { minProblems?: number } = {}): SkillProfile {
  const keys = (p: Bucketed) => {
    const subject = p.subject?.trim() ? formatSubject(p.subject) : "";
    return [...p.topics, ...(subject && subject !== "DSA" ? [subject] : [])];
  };
  const skills = bucketize(problems, keys)
    .filter((b) => b.total >= minProblems)
    .map((b) => ({ key: b.key, score: scoreOf(b), total: b.total, proLeft: b.proLeft }))
    .sort((a, b) => b.score - a.score || b.total - a.total || a.key.localeCompare(b.key));

  const strengths = skills.filter((s) => s.score >= 60).slice(0, 2).map((s) => s.key);
  const weaknesses = skills
    .filter((s) => s.score < 50 && !strengths.includes(s.key))
    .sort((a, b) => a.score - b.score || b.proLeft - a.proLeft || b.total - a.total || a.key.localeCompare(b.key))
    .slice(0, 2)
    .map((s) => s.key);
  return { skills, strengths, weaknesses };
}

/** Headline numbers for the card: same `summary`/`streaks` math as the stats dashboard. */
export function reportStats(problems: Problem[], sprint: Pick<Sprint, "start_date" | "skip_weekends" | "rest_days">, today: string): ReportStats {
  const cur = currentPlanDay({ startDate: sprint.start_date, skipWeekends: sprint.skip_weekends, restDays: sprint.rest_days }, today);
  const sum = summary(problems, cur?.day ?? null);
  const st = streaks(problems.flatMap((p) => (p.done_at ? [p.done_at] : [])), today);
  const pro = problems.filter((p) => p.difficulty === "Pro");
  return {
    pct: sum.total ? Math.round((sum.done / sum.total) * 100) : 0,
    done: sum.done,
    total: sum.total,
    streak: st.current,
    longest: st.longest,
    pro_done: pro.filter((p) => p.done_at).length,
    pro_total: pro.length,
  };
}

/** "82% Ready for Google · 91% Ready for Zoho" */
export const readinessHeadline = (r: CompanyReadiness[]) => r.map((c) => `${c.score}% Ready for ${c.company}`).join(" · ");
