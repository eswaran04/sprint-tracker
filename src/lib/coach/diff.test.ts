import { describe, expect, it } from "vitest";
import { mkProblem } from "@/test/fixtures/problems";
import { isPlanStale, planLabel, summarizePlan } from "./diff";

describe("planLabel", () => {
  it("handles singular, plural, zero and saved days", () => {
    expect(planLabel(1, 1)).toBe("1 problem moves, 1 day added");
    expect(planLabel(12, 3)).toBe("12 problems move, 3 days added");
    expect(planLabel(4, 0)).toBe("4 problems move, 0 days added");
    expect(planLabel(2, -1)).toBe("2 problems move, 1 day saved");
    expect(planLabel(0, 0)).toBe("No changes needed");
  });
});

describe("summarizePlan", () => {
  const ps = [
    mkProblem({ id: "a", day_no: 1 }),
    mkProblem({ id: "b", day_no: 2 }),
    mkProblem({ id: "c", day_no: 4, done_at: "2026-10-01T00:00:00Z" }),
  ];

  it("counts moves, added days and groups changed days", () => {
    const s = summarizePlan(ps, [
      { id: "a", day_no: 3, sprint_no: 1 },
      { id: "b", day_no: 6, sprint_no: 1 },
    ], [5]);
    expect(s).toMatchObject({ moved: 2, daysAdded: 2, oldEnd: 4, newEnd: 6, reviewDays: [5], label: "2 problems move, 2 days added", from: { a: 1, b: 2 } });
    expect(s.byDay.map((d) => d.day)).toEqual([1, 2, 3, 6]);
    expect(s.byDay[0].before.map((p) => p.id)).toEqual(["a"]);
    expect(s.byDay[0].after).toEqual([]);
    expect(s.byDay[2].after.map((p) => p.id)).toEqual(["a"]);
  });

  it("ignores no-op changes", () => {
    expect(summarizePlan(ps, [{ id: "a", day_no: 1, sprint_no: 1 }]).moved).toBe(0);
  });
});

describe("isPlanStale", () => {
  it("detects moved, finished or missing problems", () => {
    const ps = [mkProblem({ id: "a", day_no: 1 }), mkProblem({ id: "b", day_no: 2 })];
    expect(isPlanStale({ a: 1, b: 2 }, ps)).toBe(false);
    expect(isPlanStale({ a: 2 }, ps)).toBe(true);
    expect(isPlanStale({ a: 1 }, [{ ...ps[0], done_at: "2026-10-01T00:00:00Z" }])).toBe(true);
    expect(isPlanStale({ z: 1 }, ps)).toBe(true);
  });
});
