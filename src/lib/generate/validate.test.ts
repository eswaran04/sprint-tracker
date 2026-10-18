import { describe, expect, it } from "vitest";
import type { CatalogueProblem } from "./catalogue";
import { generateSprintPlan } from "./generate";
import type { GenerateResponse } from "./schema";
import { validatePlan, validateRawPlan } from "./validate";

const TODAY = "2026-10-12"; // a Monday

const catalogue: CatalogueProblem[] = Array.from({ length: 300 }, (_, i) => ({
  name: `Problem ${i}`,
  url: `https://leetcode.com/problems/p${i}/`,
  subject: "dsa",
  difficulty: (["Basic", "Core", "Pro"] as const)[i % 3],
  companies: i % 3 ? ["Google"] : ["Amazon"],
  topics: [["Dynamic Programming", "Graphs", "Arrays", "Strings"][i % 4]],
  sheets: 1,
  order: i,
}));

async function plan(prompt: string) {
  const res = await generateSprintPlan({ prompt, today: TODAY, skip_questions: true }, { loadCatalogue: async () => catalogue, llm: null });
  if (res.kind !== "plan") throw new Error("expected a plan");
  return res as GenerateResponse;
}

describe("validatePlan", () => {
  it("passes plans from the built-in planner", async () => {
    for (const prompt of ["Google in 2 weeks, 2 hours a day, weak at DP", "3 weeks, skip weekends, 1 hour a day", "6 weeks for Amazon, graphs"]) {
      const res = validatePlan(await plan(prompt), catalogue, TODAY);
      expect(res.violations).toEqual([]);
      expect(res.ok).toBe(true);
    }
  });

  it("flags unknown, altered and duplicate problems", async () => {
    const good = await plan("Google in 2 weeks, 2 hours a day");
    const rows = [...good.rows];
    rows[1] = { ...rows[0], position: rows[1].position, day_no: rows[1].day_no };
    rows[2] = { ...rows[2], name: "Made up", url: "https://nowhere.dev/x" };
    rows[3] = { ...rows[3], difficulty: rows[3].difficulty === "Pro" ? "Basic" : "Pro" };
    const codes = validatePlan({ ...good, rows }, catalogue, TODAY).violations.map((v) => v.code);
    expect(codes).toEqual(expect.arrayContaining(["duplicate", "unknown_problem", "altered_problem"]));
  });

  it("flags over-budget days, extra days, gaps and ordering", async () => {
    const good = await plan("Google in 1 week, 1 hour a day");
    const crammed = good.rows.map((r) => ({ ...r, day_no: 1, sprint_no: 1 }));
    expect(validatePlan({ ...good, rows: crammed }, catalogue, TODAY).violations.map((v) => v.code)).toContain("day_over_budget");

    const last = good.rows.at(-1)!;
    const extra = [...good.rows, { ...catalogueRow(299), position: last.position + 1, day_no: last.day_no + 30, sprint_no: last.sprint_no }];
    const codes = validatePlan({ ...good, rows: extra }, catalogue, TODAY).violations.map((v) => v.code);
    expect(codes).toEqual(expect.arrayContaining(["too_many_days", "day_gap"]));

    const reversed = [...good.rows].reverse();
    expect(validatePlan({ ...good, rows: reversed }, catalogue, TODAY).violations.map((v) => v.code)).toContain("position_order");
  });

  it("flags empty, underfilled, weak topics not first and bad start dates", async () => {
    const good = await plan("Google in 2 weeks, 2 hours a day, weak at DP");
    expect(validatePlan({ ...good, rows: [] }, catalogue, TODAY).violations[0].code).toBe("empty");
    expect(validatePlan({ ...good, rows: good.rows.slice(0, 2) }, catalogue, TODAY).violations.map((v) => v.code)).toContain("underfilled");

    const noWeakFirst = good.rows.filter((r) => !r.topics.includes("Dynamic Programming") || r.day_no > 1);
    expect(validatePlan({ ...good, rows: noWeakFirst.map((r, i) => ({ ...r, position: i })) }, catalogue, TODAY).violations.map((v) => v.code)).toContain(
      "weak_not_first",
    );

    expect(validatePlan({ ...good, start_date: "2026-01-01" }, catalogue, TODAY).violations.map((v) => v.code)).toContain("bad_start");
  });
});

describe("validateRawPlan", () => {
  const ids = new Set(["p1", "p2", "p3"]);
  it("accepts a schema-valid plan using known ids once", () => {
    expect(validateRawPlan({ sprints: [{ theme: "x", days: [{ ids: ["p1", "p2"] }, { ids: ["p3"] }] }], rationale: "r" }, ids).ok).toBe(true);
  });
  it("rejects schema errors, unknown ids and repeats", () => {
    expect(validateRawPlan({ sprints: "nope" }, ids).ok).toBe(false);
    const res = validateRawPlan({ sprints: [{ theme: "x", days: [{ ids: ["p1", "p9"] }, { ids: ["p1"] }] }], rationale: "" }, ids);
    expect(res.violations.map((v) => v.code)).toEqual(["unknown_problem", "duplicate"]);
  });
});

function catalogueRow(i: number) {
  const p = catalogue[i];
  return { name: p.name, url: p.url, subject: p.subject, difficulty: p.difficulty, companies: p.companies, topics: p.topics };
}
