import { describe, expect, it } from "vitest";
import { breakdown, difficultyPerformance, effortWeight, effortWeights, heatmap, pace, streaks, summary, toLocalDate } from "./stats";
import { mkProblem } from "@/test/fixtures/problems";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("streaks", () => {
  it("counts the current run ending today", () => {
    const done = [at(2026, 10, 1), at(2026, 10, 2), at(2026, 10, 2, 20), at(2026, 10, 3)];
    expect(streaks(done, "2026-10-03")).toEqual({ current: 3, longest: 3 });
  });
  it("keeps the run alive if nothing yet today", () => {
    expect(streaks([at(2026, 10, 1), at(2026, 10, 2)], "2026-10-03").current).toBe(2);
  });
  it("breaks after a missed day", () => {
    const done = [at(2026, 9, 1), at(2026, 9, 2), at(2026, 9, 3), at(2026, 9, 4), at(2026, 10, 1)];
    expect(streaks(done, "2026-10-03")).toEqual({ current: 0, longest: 4 });
  });
  it("handles no data", () => {
    expect(streaks([], "2026-10-03")).toEqual({ current: 0, longest: 0 });
  });
});

describe("heatmap", () => {
  it("buckets completions by local date", () => {
    expect(heatmap([at(2026, 10, 1), at(2026, 10, 1, 22), at(2026, 10, 2)])).toEqual(
      new Map([["2026-10-01", 2], ["2026-10-02", 1]]),
    );
    expect(toLocalDate(at(2026, 10, 1, 23))).toBe("2026-10-01");
  });
});

describe("summary / breakdown", () => {
  const ps = [
    mkProblem({ difficulty: "Basic", companies: ["Google"], day_no: 1, done_at: at(2026, 10, 1) }),
    mkProblem({ difficulty: "Basic", companies: ["Google", "Meta"], day_no: 2, starred: true }),
    mkProblem({ difficulty: "Pro", companies: ["Meta"], day_no: 5 }),
  ];
  it("summarises progress and pace", () => {
    expect(summary(ps, 3)).toEqual({ total: 3, done: 1, starred: 1, scheduledSoFar: 2, overdue: 1 });
    expect(summary(ps, null).scheduledSoFar).toBe(0);
  });
  it("breaks down by key with done counts", () => {
    expect(breakdown(ps, (p) => [p.difficulty ?? "None"])).toEqual([
      { key: "Basic", total: 2, done: 1 },
      { key: "Pro", total: 1, done: 0 },
    ]);
    expect(breakdown(ps, (p) => p.companies)[0]).toEqual({ key: "Google", total: 2, done: 1 });
  });
});

describe("pace", () => {
  it("averages over active days and calendar days within the window", () => {
    const done = [at(2026, 10, 1), at(2026, 10, 1, 18), at(2026, 10, 3), at(2026, 10, 10), at(2026, 9, 1)];
    expect(pace(done, "2026-10-10", 14)).toEqual({ perActiveDay: 4 / 3, perCalendarDay: 4 / 14, activeDays: 3 });
    expect(pace([], "2026-10-10")).toEqual({ perActiveDay: 0, perCalendarDay: 0, activeDays: 0 });
  });
});

describe("difficultyPerformance / effort weights", () => {
  // Day N is 2026-10-0N.
  const dateFor = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
  const ps = [
    mkProblem({ difficulty: "Basic", day_no: 1, done_at: at(2026, 10, 1) }),
    mkProblem({ difficulty: "Basic", day_no: 2 }),
    mkProblem({ difficulty: "Pro", day_no: 2, done_at: at(2026, 10, 5) }),
    mkProblem({ difficulty: "Pro", day_no: 3, done_at: at(2026, 10, 4) }),
    mkProblem({ difficulty: null, day_no: 3 }),
  ];

  it("reports completion rate and average lag per difficulty", () => {
    const perf = difficultyPerformance(ps, dateFor);
    expect(perf.Basic).toEqual({ total: 2, done: 1, completionRate: 0.5, avgLagDays: 0 });
    expect(perf.Pro).toEqual({ total: 2, done: 2, completionRate: 1, avgLagDays: 2 });
    expect(perf.Core).toEqual({ total: 0, done: 0, completionRate: 0, avgLagDays: null });
    expect(perf.None).toEqual({ total: 1, done: 0, completionRate: 0, avgLagDays: null });
  });

  it("makes difficulties you fall behind on heavier", () => {
    expect(effortWeight("Basic")).toBe(1);
    expect(effortWeight("Core")).toBe(1.5);
    expect(effortWeight("Pro")).toBe(2.5);
    const w = effortWeights(difficultyPerformance(ps, dateFor));
    expect(w.Basic).toBe(1);
    expect(w.Core).toBe(1.5);
    expect(w.Pro).toBeGreaterThan(2.5);
    expect(w.Pro).toBeLessThanOrEqual(5);
  });
});
