import { describe, expect, it } from "vitest";
import { shiftBacklog } from "@/lib/schedule";
import { mkProblem } from "@/test/fixtures/problems";
import { clampStrategy, defaultStrategy, planReschedule, type CoachStrategy } from "./planner";
import type { CoachSignals } from "./signals";

const sprintFor = (d: number) => Math.ceil(d / 7);
const strategy = (s: Partial<CoachStrategy> = {}): CoachStrategy => ({
  dailyCapacity: 20, maxProPerDay: 0, reviewBefore: [], frontLoadFlagged: false, ...s,
});
const dayOf = (changes: { id: string; day_no: number }[], id: string, fallback: number) => changes.find((c) => c.id === id)?.day_no ?? fallback;

describe("planReschedule", () => {
  it("returns nothing when nothing is overdue", () => {
    const ps = [mkProblem({ day_no: 3 }), mkProblem({ day_no: 4 })];
    expect(planReschedule(ps, { today: 3, sprintFor, strategy: strategy() })).toEqual({ changes: [], reviewDays: [], fallback: false });
  });

  it("never moves finished problems and counts them against their day", () => {
    const done = mkProblem({ id: "done", day_no: 3, difficulty: "Pro", done_at: "2026-10-01T10:00:00Z" });
    const late1 = mkProblem({ id: "late1", day_no: 1, difficulty: "Basic" });
    const late2 = mkProblem({ id: "late2", day_no: 1, difficulty: "Basic" });
    const { changes } = planReschedule([done, late1, late2], { today: 3, sprintFor, strategy: strategy({ dailyCapacity: 2.5 }) });
    expect(changes.map((c) => c.id)).not.toContain("done");
    // Day 3 is already full with the finished Pro: it still takes one problem (no stalling), the next waits.
    expect(changes).toEqual([
      { id: "late1", day_no: 3, sprint_no: 1 },
      { id: "late2", day_no: 4, sprint_no: 1 },
    ]);
  });

  it("only moves undone problems from the earliest overdue day onward, never pulling future work earlier", () => {
    const ps = [
      mkProblem({ id: "a", day_no: 2, difficulty: "Basic" }),
      mkProblem({ id: "b", day_no: 2, difficulty: "Basic" }),
      mkProblem({ id: "c", day_no: 6, difficulty: "Basic" }),
      mkProblem({ id: "d", day_no: 9, difficulty: "Basic" }),
    ];
    const { changes } = planReschedule(ps, { today: 4, sprintFor, strategy: strategy({ dailyCapacity: 1 }) });
    expect(dayOf(changes, "a", 2)).toBe(4);
    expect(dayOf(changes, "b", 2)).toBe(5);
    expect(dayOf(changes, "c", 6)).toBeGreaterThanOrEqual(6);
    expect(dayOf(changes, "d", 9)).toBeGreaterThanOrEqual(9);
    for (const c of changes) expect(c.day_no).toBeGreaterThanOrEqual(4);
  });

  it("ignores undone problems before the earliest overdue day's scope (done ones before it stay)", () => {
    const ps = [
      mkProblem({ id: "old-done", day_no: 1, done_at: "2026-10-01T10:00:00Z" }),
      mkProblem({ id: "late", day_no: 2 }),
    ];
    const { changes } = planReschedule(ps, { today: 3, sprintFor, strategy: strategy() });
    expect(changes).toEqual([{ id: "late", day_no: 3, sprint_no: 1 }]);
  });

  it("respects the Pro cap", () => {
    const ps = Array.from({ length: 4 }, (_, i) => mkProblem({ id: `pro${i}`, day_no: 1, difficulty: "Pro" }));
    const { changes } = planReschedule(ps, { today: 3, sprintFor, strategy: strategy({ maxProPerDay: 1 }) });
    expect(changes.map((c) => c.day_no)).toEqual([3, 4, 5, 6]);
  });

  it("lets lighter problems move ahead of a Pro that doesn't fit, within the window", () => {
    const ps = [
      mkProblem({ id: "basic1", day_no: 1, difficulty: "Basic" }),
      mkProblem({ id: "pro", day_no: 1, difficulty: "Pro" }),
      mkProblem({ id: "basic2", day_no: 2, difficulty: "Basic" }),
    ];
    const { changes } = planReschedule(ps, { today: 3, sprintFor, strategy: strategy({ dailyCapacity: 2.5 }) });
    expect(dayOf(changes, "basic1", 1)).toBe(3);
    expect(dayOf(changes, "basic2", 2)).toBe(3);
    expect(dayOf(changes, "pro", 1)).toBe(4);
  });

  it("inserts a review day before a heavy run of a chosen topic", () => {
    const dp = (id: string, day: number) => mkProblem({ id, day_no: day, difficulty: "Basic", topics: ["Dynamic Programming"] });
    const ps = [mkProblem({ id: "warm", day_no: 1, difficulty: "Basic" }), dp("d1", 2), dp("d2", 2), dp("d3", 3), dp("d4", 3)];
    const res = planReschedule(ps, { today: 3, sprintFor, strategy: strategy({ dailyCapacity: 2, reviewBefore: ["Dynamic Programming"] }) });
    expect(res.reviewDays).toEqual([4]);
    expect(res.changes.some((c) => c.day_no === 4)).toBe(false);
    expect(dayOf(res.changes, "warm", 1)).toBe(3);
    expect(dayOf(res.changes, "d1", 2)).toBe(5);
    expect(dayOf(res.changes, "d4", 3)).toBe(6);

    const without = planReschedule(ps, { today: 3, sprintFor, strategy: strategy({ dailyCapacity: 2 }) });
    expect(without.reviewDays).toEqual([]);
  });

  it("is deterministic", () => {
    const ps = Array.from({ length: 30 }, (_, i) =>
      mkProblem({ id: `x${i}`, day_no: 1 + (i % 7), difficulty: (["Basic", "Core", "Pro"] as const)[i % 3], topics: [i % 2 ? "Graphs" : "Arrays"] }),
    );
    const opts = { today: 5, sprintFor, strategy: strategy({ dailyCapacity: 4, maxProPerDay: 1 }) };
    const sorted = (r: ReturnType<typeof planReschedule>) => ({ ...r, changes: [...r.changes].sort((a, b) => a.id.localeCompare(b.id)) });
    const first = planReschedule(ps, opts);
    expect(first.changes.length).toBeGreaterThan(0);
    expect(sorted(first)).toEqual(sorted(planReschedule(structuredClone(ps).reverse(), opts)));
  });

  it("falls back to the plain shift past the 60-day limit", () => {
    const ps = Array.from({ length: 100 }, (_, i) => mkProblem({ id: `b${i}`, day_no: 1, difficulty: "Basic" }));
    const res = planReschedule(ps, { today: 2, sprintFor, strategy: strategy({ dailyCapacity: 1 }) });
    expect(res.fallback).toBe(true);
    expect(res.changes).toEqual(shiftBacklog(ps, 2, sprintFor));
  });
});

describe("clampStrategy / defaultStrategy", () => {
  it("clamps capacity and Pro cap", () => {
    expect(clampStrategy(strategy({ dailyCapacity: 100, maxProPerDay: -3 }))).toMatchObject({ dailyCapacity: 20, maxProPerDay: 0 });
    expect(clampStrategy(strategy({ dailyCapacity: 0, maxProPerDay: 99 }))).toMatchObject({ dailyCapacity: 1, maxProPerDay: 10 });
    expect(clampStrategy(strategy({ dailyCapacity: Number.NaN })).dailyCapacity).toBe(4);
  });

  it("caps Pro when Pro runs late and reviews flagged heavy runs", () => {
    const perf = (avgLagDays: number | null) => ({ total: 1, done: 1, completionRate: 1, avgLagDays });
    const signals: CoachSignals = {
      today: 5,
      pace: { perActiveDay: 3, perCalendarDay: 2, activeDays: 5 },
      difficulty: { Basic: perf(0), Core: perf(0), Pro: perf(2.5), None: perf(null) },
      weights: { Basic: 1, Core: 1.5, Pro: 2.5, None: 1 },
      overdue: { total: 4, byDifficulty: { Basic: 2, Core: 0, Pro: 2, None: 0 } },
      remaining: { total: 4, byDifficulty: { Basic: 2, Core: 0, Pro: 2, None: 0 } },
      plannedPerDay: 3,
      flaggedUndone: 1,
      flaggedTopics: [{ topic: "Graphs", struggle: 1, revisit: 0 }],
      heavyRuns: [{ startDay: 6, topic: "Graphs", days: 2, proCount: 0 }, { startDay: 9, topic: "Arrays", days: 2, proCount: 0 }],
    };
    expect(defaultStrategy(signals)).toEqual({ dailyCapacity: 5.5, maxProPerDay: 1, reviewBefore: ["Graphs"], frontLoadFlagged: true });
  });
});
