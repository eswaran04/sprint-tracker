import { addDays, format, isWeekend, parseISO } from "date-fns";
import { assemble } from "./assemble";
import { computeCapacity } from "./capacity";
import { matchVocabulary, rank, shortlist, toCandidates, vocabularies, type CatalogueProblem } from "./catalogue";
import { heuristicGoal } from "./heuristic";
import { GoalSchema, PlanSchema, type GenerateResponse, type Goal, type Plan } from "./schema";
import { GOAL_SYSTEM, goalUser, PLAN_SYSTEM, planUser } from "./prompts";

export class GenerateError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
  }
}

export interface GenerateDeps {
  /** De-duplicated problems from `public_sheet_problems` (the `loadCatalogue` server op). */
  loadCatalogue: () => Promise<CatalogueProblem[]>;
  /** Structured LLM call, or null when no LLM is configured. */
  llm: (<T>(opts: { system: string; user: string; schema: import("zod").ZodType<T> }) => Promise<T>) | null;
  log?: (msg: string, e?: unknown) => void;
}

const MAX_CANDIDATES = 600;
const MIN_PER_WEAK = 25;

/** Start date: the one asked for (never in the past), else today, moved off a weekend when weekends are skipped. */
function resolveStart(goal: Goal, today: string) {
  let d = goal.start_date && goal.start_date >= today ? goal.start_date : today;
  if (goal.skip_weekends) while (isWeekend(parseISO(d))) d = format(addDays(parseISO(d), 1), "yyyy-MM-dd");
  return d;
}

/** Normalises the mix so it sums to 1 (falls back to a balanced mix). */
function normaliseMix(goal: Goal): Goal {
  const { basic, core, pro } = goal.difficulty_mix;
  const t = basic + core + pro;
  const mix = t > 0 ? { basic: basic / t, core: core / t, pro: pro / t } : { basic: 0.25, core: 0.5, pro: 0.25 };
  return { ...goal, difficulty_mix: mix };
}

export async function generateSprintPlan(prompt: string, today: string, deps: GenerateDeps): Promise<GenerateResponse> {
  const log = deps.log ?? (() => {});
  const warnings: string[] = [];
  let ai = Boolean(deps.llm);

  // 1) Goal: LLM, falling back to heuristics.
  let goal: Goal;
  if (deps.llm) {
    try {
      goal = await deps.llm({ system: GOAL_SYSTEM, user: goalUser(prompt, today), schema: GoalSchema });
    } catch (e) {
      log("goal parsing failed, using heuristics", e);
      goal = heuristicGoal(prompt, today);
      ai = false;
    }
  } else {
    goal = heuristicGoal(prompt, today);
  }
  goal = normaliseMix(goal);

  // 2) Catalogue.
  const catalogue = await deps.loadCatalogue();
  if (!catalogue.length) throw new GenerateError("There are no public sheets to build from yet. Publish a sheet or import one instead.");
  const vocab = vocabularies(catalogue);

  const company = goal.company ? matchVocabulary([goal.company], vocab.companies) : { matched: [], unknown: [] };
  const weak = matchVocabulary(goal.weak_topics, vocab.topics);
  const focus = matchVocabulary(goal.focus_topics, vocab.topics);
  const focusTopics = focus.matched.filter((t) => !weak.matched.includes(t));
  if (company.unknown.length) warnings.push(`No problems are tagged with ${company.unknown.join(", ")} — picked by topic instead.`);
  const unknownTopics = [...weak.unknown, ...focus.unknown];
  if (unknownTopics.length) warnings.push(`Couldn't find topics matching: ${unknownTopics.join(", ")}.`);

  // 3) Capacity.
  const start = resolveStart(goal, today);
  const capacity = computeCapacity({
    startDate: start,
    weeks: goal.weeks,
    hoursPerDay: goal.hours_per_day,
    skipWeekends: goal.skip_weekends,
    restDays: goal.rest_days,
    mix: goal.difficulty_mix,
  });

  // 4) Rank + shortlist.
  const ranked = rank(catalogue, { companies: company.matched, weakTopics: weak.matched, focusTopics, mix: goal.difficulty_mix });
  if (company.matched.length) {
    const n = ranked.filter((p) => p.companyMatch).length;
    if (n < capacity.target) warnings.push(`Only ${n} ${company.matched[0]}-tagged problems found; filled the rest with topic matches.`);
  }
  const pool = shortlist(ranked, {
    limit: Math.min(MAX_CANDIDATES, Math.max(capacity.target * 3, 60)),
    weakTopics: weak.matched,
    minPerWeak: MIN_PER_WEAK,
  });
  const { byId, lines } = toCandidates(pool);
  const rankedIds = [...byId.keys()];

  // 5) Plan: LLM selects + orders IDs; validated and repaired below.
  let plan: Plan | null = null;
  let rationale = "";
  if (deps.llm && ai) {
    try {
      plan = await deps.llm({
        system: PLAN_SYSTEM,
        user: planUser({ goal, companies: company.matched, weakTopics: weak.matched, focusTopics, capacity, lines }),
        schema: PlanSchema,
      });
      rationale = plan.rationale.trim();
    } catch (e) {
      log("planning failed, using built-in planner", e);
      ai = false;
    }
  }
  if (!ai && deps.llm) warnings.push("The AI planner was unavailable, so a built-in planner arranged your sprint.");

  const out = assemble({ plan, byId, rankedIds, capacity, weakTopics: weak.matched });
  if (!out.rows.length) throw new GenerateError("Couldn't find any problems for that goal. Try a broader description.");

  if (!rationale) {
    const parts = [
      `${out.rows.length} problems over ${capacity.workingDays} study days (~${Math.round(capacity.dailyMinutes / 60 * 10) / 10} h/day).`,
      weak.matched.length ? `Weak topics (${weak.matched.join(", ")}) come first.` : "",
      company.matched.length ? `${company.matched[0]}-tagged problems are preferred.` : "",
    ];
    rationale = parts.filter(Boolean).join(" ");
  }

  return {
    goal: { ...goal, weak_topics: weak.matched.length ? weak.matched : goal.weak_topics, focus_topics: focusTopics },
    title: goal.title,
    start_date: start,
    skip_weekends: goal.skip_weekends,
    rest_days: capacity.restDays,
    rows: out.rows,
    sprints: out.sprints,
    rationale,
    warnings: [...warnings, ...out.warnings],
    ai,
  };
}
