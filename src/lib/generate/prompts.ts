import type { Capacity } from "./capacity";
import type { Goal } from "./schema";

export const GOAL_SYSTEM = `You turn a learner's description of an interview-prep goal into structured settings.
Return JSON matching the schema exactly. Rules:
- company: the single target company if one is named (canonical name, e.g. "Google", "Meta", "Amazon"), else null.
- weeks: length of the plan in weeks (convert days/months; default 4 if unspecified; max 52).
- hours_per_day: study hours per day (convert "90 min" to 1.5; derive from weekly hours if given; default 2).
- weak_topics: topics the user says they are weak at / struggle with, as short DSA topic names (e.g. "Dynamic Programming", "Graphs").
- focus_topics: other topics they explicitly want to cover. Do not repeat weak topics. Empty if none.
- skip_weekends: true only if the user says to skip/avoid weekends or study weekdays only.
- start_date: yyyy-MM-dd only if the user gives one or a relative day ("next Monday", "tomorrow") — resolve against today. Otherwise null. Never invent a date.
- rest_days: specific yyyy-MM-dd dates the user says they are unavailable. Empty if none.
- difficulty_mix: fractions for basic/core/pro summing to 1. Default {basic:0.25, core:0.5, pro:0.25}; senior roles (SDE-2/3, senior, staff) lean harder (e.g. 0.15/0.5/0.35); beginners lean easier.
- title: a short sprint name, e.g. "Google SDE-2 · 6 weeks".`;

export const goalUser = (prompt: string, today: string) => `Today is ${today}.\n\nUser goal:\n"""\n${prompt}\n"""`;

export const PLAN_SYSTEM = `You are an interview-prep coach building a study schedule from a fixed problem catalogue.
Each candidate line is: id|difficulty|topics|companies. Difficulty is Basic < Core < Pro.
Rules (strict):
- Use ONLY ids from the candidate list. Never invent ids, names or links. Use each id at most once.
- Group days into sprints (about one week of study days each); give each sprint a short theme (e.g. "Graphs: BFS/DFS foundations").
- Respect the per-day time budget using the given minutes per difficulty. Do not exceed the number of study days.
- Aim for close to the target problem count.
- Within a topic, go from easier to harder. Put weak topics early and give them extra days; revisit them later.
- Prefer problems tagged with the target company when one is given.
- Make the final sprint a mixed review across topics when the plan has 2+ sprints.
- rationale: 2-4 sentences explaining the structure, for the learner.
Return JSON matching the schema only.`;

export function planUser(opts: { goal: Goal; companies: string[]; weakTopics: string[]; focusTopics: string[]; capacity: Capacity; lines: string[] }) {
  const { goal, capacity } = opts;
  return [
    `Target company: ${opts.companies.join(", ") || "none"}`,
    `Weak topics (prioritise): ${opts.weakTopics.join(", ") || "none"}`,
    `Focus topics: ${opts.focusTopics.join(", ") || "none"}`,
    `Difficulty mix: basic ${goal.difficulty_mix.basic}, core ${goal.difficulty_mix.core}, pro ${goal.difficulty_mix.pro}`,
    `Study days available: ${capacity.workingDays} (about ${capacity.sprintLength} per sprint)`,
    `Per-day budget: ${capacity.dailyMinutes} minutes. Minutes per problem: Basic 20, Core 40, Pro 60.`,
    `Target total problems: about ${capacity.target}`,
    ``,
    `Candidates (${opts.lines.length}):`,
    ...opts.lines,
  ].join("\n");
}
