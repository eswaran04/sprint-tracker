import { describe, expect, it } from "vitest";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import { companyReadiness, readinessHeadline, reportStats, skillProfile } from "./readiness";

const done = "2026-10-05T10:00:00Z";
const many = (n: number, p: Parameters<typeof mkProblem>[0]) => Array.from({ length: n }, () => mkProblem(p));

describe("companyReadiness", () => {
  it("weights completion by difficulty (Basic 1 · Core 2 · Pro 3)", () => {
    // Google: 4 Basic done (4) + 1 Pro not done (3) → 4/7 = 57%. Solving the Pro instead flips it.
    const problems = [...many(4, { companies: ["Google"], difficulty: "Basic", done_at: done }), mkProblem({ companies: ["Google"], difficulty: "Pro" })];
    expect(companyReadiness(problems)).toEqual([{ company: "Google", score: 57, done: 4, total: 5, confidence: "low" }]);

    const proFirst = [...many(4, { companies: ["Google"], difficulty: "Basic" }), mkProblem({ companies: ["Google"], difficulty: "Pro", done_at: done })];
    expect(companyReadiness(proFirst)[0].score).toBe(43);
  });

  it("drops small samples and marks medium ones as low confidence", () => {
    const problems = [
      ...many(4, { companies: ["Netflix"], done_at: done }),
      ...many(8, { companies: ["Zoho"], done_at: done }),
      ...many(5, { companies: ["Amazon"] }),
    ];
    const r = companyReadiness(problems);
    expect(r.map((c) => c.company)).toEqual(["Zoho", "Amazon"]);
    expect(r[0]).toMatchObject({ score: 100, confidence: "high" });
    expect(r[1]).toMatchObject({ score: 0, confidence: "low" });
  });

  it("treats unrated problems as 1.5 and ranks by total weight, then score, then name", () => {
    const problems = [
      ...many(5, { companies: ["B"], difficulty: null, done_at: done }),
      ...many(5, { companies: ["A"], difficulty: null }),
      ...many(5, { companies: ["C"], difficulty: "Pro" }),
    ];
    expect(companyReadiness(problems, { limit: 5 }).map((c) => c.company)).toEqual(["C", "B", "A"]);
  });

  it("is empty for an empty sprint and ignores duplicate company tags", () => {
    expect(companyReadiness([])).toEqual([]);
    expect(companyReadiness(many(5, { companies: ["Zoho", "Zoho", " "] }))[0].total).toBe(5);
  });
});

describe("skillProfile", () => {
  it("finds strengths and weaknesses across topics and non-DSA subjects", () => {
    const problems = [
      ...many(4, { topics: ["Trees"], done_at: done }),
      ...many(3, { topics: ["Sliding Window"], done_at: done }),
      ...many(3, { topics: ["Backtracking"], difficulty: "Pro" }),
      ...many(3, { subject: "os", topics: [] }),
      ...many(2, { topics: ["Graphs"] }), // too few to judge
    ];
    const p = skillProfile(problems);
    expect(p.strengths).toEqual(["Trees", "Sliding Window"]);
    expect(p.weaknesses).toEqual(["Backtracking", "OS"]); // tie at 0%: most unsolved Pro first
    expect(p.skills.map((s) => s.key)).not.toContain("Graphs");
    expect(p.skills.map((s) => s.key)).not.toContain("DSA");
  });

  it("returns empty buckets for an empty sprint", () => {
    expect(skillProfile([])).toEqual({ skills: [], strengths: [], weaknesses: [] });
  });
});

describe("reportStats", () => {
  it("matches the dashboard summary and counts Pro", () => {
    const problems = [mkProblem({ difficulty: "Pro", done_at: "2026-10-05T10:00:00" }), mkProblem({ difficulty: "Pro" }), mkProblem({ done_at: "2026-10-04T10:00:00" })];
    expect(reportStats(problems, mkSprint(), "2026-10-05")).toEqual({ pct: 67, done: 2, total: 3, streak: 2, longest: 2, pro_done: 1, pro_total: 2 });
    expect(reportStats([], mkSprint(), "2026-10-05").pct).toBe(0);
  });
});

it("formats the headline", () => {
  expect(readinessHeadline([
    { company: "Google", score: 82, done: 1, total: 1, confidence: "high" },
    { company: "Zoho", score: 91, done: 1, total: 1, confidence: "high" },
  ])).toBe("82% Ready for Google · 91% Ready for Zoho");
});
