import { describe, expect, it, vi } from "vitest";
import { assemble } from "./assemble";
import { computeCapacity } from "./capacity";
import { dedupe, matchVocabulary, problemKey, rank, shortlist, toCandidates, type CatalogueRow } from "./catalogue";
import { GenerateError, generateSprintPlan } from "./generate";
import { heuristicGoal } from "./heuristic";
import { GoalSchema, PlanSchema, type Goal, type Plan } from "./schema";

const mix = { basic: 0.25, core: 0.5, pro: 0.25 };

function row(i: number, over: Partial<CatalogueRow> = {}): CatalogueRow {
  return {
    sprint_id: "s1",
    position: i,
    name: `Problem ${i}`,
    url: `https://leetcode.com/problems/p${i}/`,
    subject: "dsa",
    difficulty: (["Basic", "Core", "Pro"] as const)[i % 3],
    companies: i % 2 ? ["Google"] : ["Amazon"],
    topics: [["Dynamic Programming", "Graphs", "Arrays", "Strings"][i % 4]],
    ...over,
  };
}
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(i));

const goal: Goal = {
  company: "Google",
  weeks: 2,
  hours_per_day: 2,
  weak_topics: ["DP", "graphs"],
  focus_topics: [],
  skip_weekends: true,
  start_date: null,
  rest_days: [],
  difficulty_mix: { basic: 0.15, core: 0.5, pro: 0.35 },
  title: "Google SDE-2 · 2 weeks",
};

describe("schemas", () => {
  it("accepts a valid goal and plan", () => {
    expect(GoalSchema.safeParse(goal).success).toBe(true);
    expect(PlanSchema.safeParse({ sprints: [{ theme: "DP", days: [{ ids: ["p1"] }] }], rationale: "x" }).success).toBe(true);
  });
  it("rejects extra keys, bad dates and oversized arrays", () => {
    expect(GoalSchema.safeParse({ ...goal, extra: 1 }).success).toBe(false);
    expect(GoalSchema.safeParse({ ...goal, start_date: "next monday" }).success).toBe(false);
    expect(PlanSchema.safeParse({ sprints: [{ theme: "x", days: [{ ids: Array(26).fill("p1") }] }], rationale: "" }).success).toBe(false);
    expect(PlanSchema.safeParse({ sprints: [{ theme: "x", days: [{ ids: ["p1"], name: "Two Sum" }] }], rationale: "" }).success).toBe(false);
  });
});

describe("catalogue", () => {
  it("dedupes by normalised URL and merges tags", () => {
    const out = dedupe([
      row(1, { url: "https://www.LeetCode.com/problems/two-sum/?tab=x", companies: ["Google"], topics: ["Arrays"] }),
      row(2, { sprint_id: "s2", name: "Two sum", url: "http://leetcode.com/problems/two-sum", companies: ["Meta"], topics: ["Hashing"] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].companies).toEqual(["Google", "Meta"]);
    expect(out[0].topics).toEqual(["Arrays", "Hashing"]);
    expect(out[0].sheets).toBe(2);
  });
  it("falls back to the name when there is no URL", () => {
    expect(problemKey("Two Sum!", "")).toBe(problemKey("two  sum", ""));
  });
  it("matches free text to the real vocabulary only", () => {
    const { matched, unknown } = matchVocabulary(["DP", "graph", "quantum"], ["Dynamic Programming", "Graphs", "Arrays"]);
    expect(matched.sort()).toEqual(["Dynamic Programming", "Graphs"]);
    expect(unknown).toEqual(["quantum"]);
  });
  it("ranks company + weak-topic matches first and keeps a minimum per weak topic", () => {
    const ranked = rank(dedupe(rows(40)), { companies: ["Google"], weakTopics: ["Strings"], focusTopics: [], mix });
    expect(ranked[0].companyMatch).toBe(true);
    // Strings rows are i%4==3 → odd → Google, so they lead.
    expect(ranked[0].topics).toEqual(["Strings"]);
    const short = shortlist(ranked, { limit: 5, weakTopics: ["Arrays"], minPerWeak: 3 });
    expect(short.filter((p) => p.topics.includes("Arrays")).length).toBeGreaterThanOrEqual(3);
  });
  it("gives the LLM only short ids, never names or urls", () => {
    const { lines, byId } = toCandidates(rank(dedupe(rows(3)), { companies: [], weakTopics: [], focusTopics: [], mix }));
    expect([...byId.keys()]).toEqual(["p1", "p2", "p3"]);
    expect(lines.join("\n")).not.toMatch(/Problem|leetcode/);
  });
});

describe("capacity", () => {
  it("counts working days without weekends and rest days", () => {
    // 2026-10-05 is a Monday; 2 weeks → 10 weekdays, minus 1 rest day.
    const c = computeCapacity({ startDate: "2026-10-05", weeks: 2, hoursPerDay: 2, skipWeekends: true, restDays: ["2026-10-07", "2027-01-01"], mix });
    expect(c.workingDays).toBe(9);
    expect(c.restDays).toEqual(["2026-10-07"]);
    expect(c.dailyMinutes).toBe(120);
    expect(c.target).toBe(3 * 9); // avg 40 min → 3/day
    expect(c.endDate).toBe("2026-10-18");
  });
});

function setup(n = 60) {
  const ranked = rank(dedupe(rows(n)), { companies: ["Google"], weakTopics: [], focusTopics: [], mix });
  const { byId } = toCandidates(ranked);
  const capacity = computeCapacity({ startDate: "2026-10-05", weeks: 1, hoursPerDay: 1, skipWeekends: true, restDays: [], mix });
  return { byId, rankedIds: [...byId.keys()], capacity };
}

describe("assemble", () => {
  it("drops unknown/duplicate ids, renumbers, and only uses catalogue data", () => {
    const { byId, rankedIds, capacity } = setup();
    const plan: Plan = {
      sprints: [
        { theme: "Empty", days: [{ ids: [] }] },
        { theme: "Graphs", days: [{ ids: ["p1", "zz9", "p1"] }, { ids: [] }, { ids: ["p2"] }] },
      ],
      rationale: "",
    };
    const out = assemble({ plan, byId, rankedIds, capacity: { ...capacity, target: 2 }, weakTopics: [] });
    expect(out.rows.map((r) => [r.sprint_no, r.day_no])).toEqual([[1, 1], [1, 2]]);
    expect(out.sprints).toEqual([{ sprint_no: 1, theme: "Graphs" }]);
    expect(out.warnings.join(" ")).toMatch(/unknown problem ID/);
    expect(out.warnings.join(" ")).toMatch(/duplicate/);
    for (const r of out.rows) expect([...byId.values()].some((p) => p.name === r.name && p.url === r.url)).toBe(true);
  });

  it("spills days over budget and stops at the last working day", () => {
    const { byId, rankedIds, capacity } = setup();
    const plan: Plan = { sprints: [{ theme: "All", days: [{ ids: rankedIds.slice(0, 40) }] }], rationale: "" };
    const out = assemble({ plan, byId, rankedIds, capacity, weakTopics: [] });
    const perDay = new Map<number, number>();
    for (const r of out.rows) perDay.set(r.day_no, (perDay.get(r.day_no) ?? 0) + (r.difficulty === "Basic" ? 20 : r.difficulty === "Core" ? 40 : 60));
    expect(Math.max(...out.rows.map((r) => r.day_no))).toBeLessThanOrEqual(capacity.workingDays);
    for (const m of perDay.values()) expect(m).toBeLessThanOrEqual(capacity.dailyMinutes + 60);
    expect(out.warnings.join(" ")).toMatch(/didn't fit/);
  });

  it("builds a full plan without an LLM", () => {
    const { byId, rankedIds, capacity } = setup();
    const out = assemble({ plan: null, byId, rankedIds, capacity, weakTopics: [] });
    expect(out.rows.length).toBeGreaterThanOrEqual(capacity.workingDays);
    expect(new Set(out.rows.map((r) => r.day_no)).size).toBe(capacity.workingDays);
    expect(out.rows.map((r) => r.position)).toEqual(out.rows.map((_, i) => i));
    expect(out.sprints.length).toBeGreaterThan(0);
  });
});

describe("heuristicGoal", () => {
  it("parses the headline example", () => {
    const g = heuristicGoal("Google SDE-2 interview in 6 weeks, 2 hrs/day, weak at DP and graphs, skip weekends.", "2026-10-01");
    expect(g).toMatchObject({ company: "Google", weeks: 6, hours_per_day: 2, skip_weekends: true });
    expect(g.weak_topics).toEqual(["Dynamic Programming", "Graphs"]);
    expect(g.difficulty_mix.pro).toBeGreaterThan(0.25);
    expect(GoalSchema.safeParse(g).success).toBe(true);
  });
  it("handles months, minutes and relative start dates", () => {
    const g = heuristicGoal("1 month, 90 minutes, start tomorrow", "2026-10-01");
    expect(g).toMatchObject({ weeks: 4, hours_per_day: 1.5, start_date: "2026-10-02", company: null, skip_weekends: false });
  });
});

describe("generateSprintPlan", () => {
  const today = "2026-10-03"; // Saturday

  it("uses the LLM for goal + plan and maps ids to catalogue rows", async () => {
    const llm = vi.fn()
      .mockResolvedValueOnce(goal)
      .mockResolvedValueOnce({ sprints: [{ theme: "DP first", days: [{ ids: ["p1", "p2"] }, { ids: ["p3"] }] }], rationale: "Because." });
    const out = await generateSprintPlan("Google in 2 weeks", today, { loadCatalogue: async () => dedupe(rows(80)), llm: llm as never });
    expect(out.ai).toBe(true);
    expect(out.start_date).toBe("2026-10-05"); // moved off the weekend
    expect(out.rationale).toBe("Because.");
    expect(out.goal.weak_topics.sort()).toEqual(["Dynamic Programming", "Graphs"]);
    expect(out.rows[0].url).toMatch(/^https:\/\/leetcode\.com\/problems\/p\d+\/$/);
    expect(out.sprints[0].theme).toBe("DP first");
    const planPrompt = llm.mock.calls[1][0].user as string;
    expect(planPrompt).not.toMatch(/leetcode|Problem \d/);
  });

  it("falls back to the built-in planner when the LLM fails", async () => {
    const llm = vi.fn().mockResolvedValueOnce(goal).mockRejectedValueOnce(new Error("timeout"));
    const out = await generateSprintPlan("Google in 2 weeks", today, { loadCatalogue: async () => dedupe(rows(80)), llm: llm as never });
    expect(out.ai).toBe(false);
    expect(out.rows.length).toBeGreaterThan(0);
    expect(out.warnings.join(" ")).toMatch(/built-in planner/);
  });

  it("works without any LLM configured", async () => {
    const out = await generateSprintPlan("Amazon in 1 week, 1 hour a day, weak at strings", today, { loadCatalogue: async () => dedupe(rows(40)), llm: null });
    expect(out.ai).toBe(false);
    expect(out.goal.company).toBe("Amazon");
    expect(out.rows.length).toBeGreaterThan(0);
  });

  it("errors clearly on an empty catalogue", async () => {
    await expect(generateSprintPlan("anything", today, { loadCatalogue: async () => dedupe([]), llm: null })).rejects.toBeInstanceOf(GenerateError);
  });
});
