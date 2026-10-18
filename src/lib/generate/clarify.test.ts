import { describe, expect, it } from "vitest";
import { dedupe, vocabularies, type CatalogueRow } from "./catalogue";
import { applyAnswers, buildQuestions, MAX_QUESTIONS } from "./clarify";
import { heuristicGoalDraft, unstatedFields } from "./heuristic";
import { AnswersSchema, GenerateRequest, GoalDraftSchema, type Goal } from "./schema";

function row(i: number, over: Partial<CatalogueRow> = {}): CatalogueRow {
  return {
    sprint_id: "s1",
    position: i,
    name: `Problem ${i}`,
    url: `https://leetcode.com/problems/p${i}/`,
    subject: "dsa",
    difficulty: (["Basic", "Core", "Pro"] as const)[i % 3],
    companies: i % 3 === 0 ? ["Google"] : i % 3 === 1 ? ["Amazon"] : ["Google", "Meta"],
    topics: [["Dynamic Programming", "Graphs", "Arrays", "Strings"][i % 4]],
    ...over,
  };
}
const catalogue = dedupe(Array.from({ length: 40 }, (_, i) => row(i)));
const vocab = vocabularies(catalogue);

const goal: Goal = {
  company: null,
  weeks: 4,
  hours_per_day: 2,
  weak_topics: [],
  focus_topics: ["Arrays"],
  skip_weekends: false,
  start_date: null,
  rest_days: [],
  difficulty_mix: { basic: 0.25, core: 0.5, pro: 0.25 },
  title: "4 weeks",
};

describe("unstatedFields / heuristicGoalDraft", () => {
  it("asks nothing for the headline example", () => {
    const p = "Google SDE-2 interview in 6 weeks, 2 hrs/day, weak at DP and graphs, skip weekends.";
    expect(unstatedFields(p)).toEqual([]);
    expect(heuristicGoalDraft(p, "2026-10-01").unspecified).toEqual([]);
  });
  it("flags everything missing from a vague interview prompt", () => {
    expect(heuristicGoalDraft("help me prep for interviews", "2026-10-01").unspecified).toEqual(["weeks", "hours_per_day", "company", "weak_topics", "skip_weekends"]);
  });
  it("doesn't ask for a company when the goal isn't about interviews", () => {
    expect(unstatedFields("brush up on DSA")).not.toContain("company");
  });
  it("recognises loose phrasings as stated", () => {
    const f = unstatedFields("a month, an hour a day, weekdays only");
    expect(f).not.toContain("weeks");
    expect(f).not.toContain("hours_per_day");
    expect(f).not.toContain("skip_weekends");
  });
});

describe("buildQuestions", () => {
  it("caps the count and keeps priority order", () => {
    const qs = buildQuestions({ goal, unspecified: ["skip_weekends", "weak_topics", "company", "hours_per_day", "weeks"], catalogue });
    expect(qs).toHaveLength(MAX_QUESTIONS);
    expect(qs.map((q) => q.field)).toEqual(["weeks", "hours_per_day", "company"]);
    expect(qs[0]).toMatchObject({ kind: "number", default: 4, min: 1, max: 52 });
  });
  it("only offers companies and topics that exist in the catalogue, most common first", () => {
    const qs = buildQuestions({ goal, unspecified: ["company", "weak_topics"], catalogue });
    const company = qs.find((q) => q.field === "company")!;
    const topics = qs.find((q) => q.field === "weak_topics")!;
    expect(company.options![0]).toBe("Google");
    for (const c of company.options!) expect(vocab.companies.has(c)).toBe(true);
    for (const t of topics.options!) expect(vocab.topics.has(t)).toBe(true);
  });
  it("asks about a named company that isn't in the catalogue", () => {
    const qs = buildQuestions({ goal: { ...goal, company: "Initech" }, unspecified: [], catalogue, unknownCompany: "Initech" });
    expect(qs).toHaveLength(1);
    expect(qs[0].prompt).toMatch(/Initech/);
  });
  it("skips a lone weekend question and options with an empty catalogue", () => {
    expect(buildQuestions({ goal, unspecified: ["skip_weekends"], catalogue })).toEqual([]);
    expect(buildQuestions({ goal, unspecified: ["company", "weak_topics"], catalogue: [] })).toEqual([]);
  });
});

describe("applyAnswers", () => {
  it("merges answers and retitles", () => {
    const g = applyAnswers(goal, { weeks: 6, hours_per_day: 1.5, company: "google", weak_topics: ["DP", "quantum"], skip_weekends: true }, vocab);
    expect(g).toMatchObject({ weeks: 6, hours_per_day: 1.5, company: "Google", skip_weekends: true, weak_topics: ["Dynamic Programming"] });
    expect(g.title).toBe("Google · 6 weeks");
  });
  it("drops companies that aren't in the catalogue and clears on null", () => {
    expect(applyAnswers(goal, { company: "Initech" }, vocab).company).toBeNull();
    expect(applyAnswers({ ...goal, company: "Google", title: "Google · 4 weeks" }, { company: null }, vocab)).toMatchObject({ company: null, title: "4 weeks" });
  });
  it("leaves the goal alone with no answers", () => {
    expect(applyAnswers(goal, undefined, vocab)).toBe(goal);
  });
});

describe("request schemas", () => {
  it("rejects out-of-range or unknown answers", () => {
    expect(AnswersSchema.safeParse({ weeks: 0 }).success).toBe(false);
    expect(AnswersSchema.safeParse({ hours_per_day: 20 }).success).toBe(false);
    expect(AnswersSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(AnswersSchema.safeParse({ weeks: 6, company: null }).success).toBe(true);
  });
  it("validates the round-two request and the model draft strictly", () => {
    expect(GenerateRequest.safeParse({ prompt: "prep", today: "2026-10-01", goal, answers: { weeks: 3 } }).success).toBe(true);
    expect(GenerateRequest.safeParse({ prompt: "prep", today: "2026-10-01", goal: { ...goal, extra: 1 } }).success).toBe(false);
    expect(GoalDraftSchema.safeParse({ goal, unspecified: ["title"] }).success).toBe(false);
  });
});
