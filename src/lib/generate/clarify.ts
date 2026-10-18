import { matchVocabulary, type CatalogueProblem } from "./catalogue";
import { CLARIFIABLE, GoalSchema, type Answers, type ClarifiableField, type Goal, type Question } from "./schema";

/**
 * Clarifying questions for the goal generator. Everything here is deterministic: question text is fixed and the
 * company/topic options come from the catalogue, so the model can't steer users towards tags that don't exist.
 */

export const MAX_QUESTIONS = 3;
const MAX_COMPANY_OPTIONS = 8;
const MAX_TOPIC_OPTIONS = 10;

/** Tags ordered by how many catalogue problems carry them (ties alphabetical). */
function topTags(catalogue: CatalogueProblem[], pick: (p: CatalogueProblem) => string[], limit: number) {
  const counts = new Map<string, number>();
  for (const p of catalogue) for (const t of pick(p)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}

export interface ClarifyInput {
  goal: Goal;
  unspecified: ClarifiableField[];
  catalogue: CatalogueProblem[];
  /** Company the user named that has no tagged problems; asked about even if it was "specified". */
  unknownCompany?: string | null;
}

export function buildQuestions({ goal, unspecified, catalogue, unknownCompany }: ClarifyInput): Question[] {
  const ask = new Set<ClarifiableField>(unspecified);
  if (unknownCompany) ask.add("company");

  const out: Question[] = [];
  for (const field of CLARIFIABLE) {
    if (!ask.has(field)) continue;
    const q = question(field, goal, catalogue, unknownCompany ?? null);
    if (q) out.push(q);
    if (out.length >= MAX_QUESTIONS) break;
  }
  // The weekend default is harmless and editable in the preview; not worth a round trip on its own.
  if (out.length === 1 && out[0].field === "skip_weekends") return [];
  return out;
}

function question(field: ClarifiableField, goal: Goal, catalogue: CatalogueProblem[], unknownCompany: string | null): Question | null {
  switch (field) {
    case "weeks":
      return { field, kind: "number", prompt: "How many weeks until your interview (or how long should the plan run)?", min: 1, max: 52, step: 1, unit: "weeks", default: goal.weeks };
    case "hours_per_day":
      return { field, kind: "number", prompt: "How many hours can you study on a study day?", min: 0.5, max: 12, step: 0.5, unit: "h/day", default: goal.hours_per_day };
    case "company": {
      const options = topTags(catalogue, (p) => p.companies, MAX_COMPANY_OPTIONS);
      if (!options.length) return null;
      const prompt = unknownCompany
        ? `No public problems are tagged “${unknownCompany}”. Pick a company to prioritise instead, or none.`
        : "Are you preparing for a specific company?";
      return { field, kind: "single", prompt, options, default: null };
    }
    case "weak_topics": {
      const options = topTags(catalogue, (p) => p.topics, MAX_TOPIC_OPTIONS);
      if (!options.length) return null;
      return { field, kind: "multi", prompt: "Any topics you're weak at? They'll be scheduled first and revisited.", options, default: [] };
    }
    case "skip_weekends":
      return { field, kind: "boolean", prompt: "Skip weekends?", default: goal.skip_weekends };
  }
}

function retitle(title: string, before: Goal, after: Goal) {
  let t = title;
  if (after.weeks !== before.weeks) {
    const w = `${after.weeks} week${after.weeks === 1 ? "" : "s"}`;
    t = /\d+ weeks?/i.test(t) ? t.replace(/\d+ weeks?/i, w) : `${t} · ${w}`;
  }
  if (after.company !== before.company) {
    if (before.company && t.includes(before.company)) t = t.replace(before.company, after.company ?? "").replace(/^\s*·\s*/, "").trim();
    else if (after.company) t = `${after.company} · ${t}`;
  }
  return t.trim() || "My prep sprint";
}

/**
 * Merges answers into the goal. Company and topics are kept only when they match catalogue tags; the result is
 * re-validated so a tampered client goal can't slip through.
 */
export function applyAnswers(goal: Goal, answers: Answers | undefined, vocab: { companies: Set<string>; topics: Set<string> }): Goal {
  if (!answers) return goal;
  const next: Goal = { ...goal };
  if (answers.weeks !== undefined) next.weeks = answers.weeks;
  if (answers.hours_per_day !== undefined) next.hours_per_day = answers.hours_per_day;
  if (answers.skip_weekends !== undefined) next.skip_weekends = answers.skip_weekends;
  if (answers.company !== undefined) {
    next.company = answers.company ? (matchVocabulary([answers.company], vocab.companies).matched[0] ?? null) : null;
  }
  if (answers.weak_topics !== undefined) {
    const weak = matchVocabulary(answers.weak_topics, vocab.topics).matched;
    next.weak_topics = weak;
    next.focus_topics = goal.focus_topics.filter((t) => !weak.includes(t));
  }
  next.title = retitle(goal.title, goal, next);
  return GoalSchema.parse(next);
}
