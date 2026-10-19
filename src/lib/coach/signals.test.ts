import { describe, expect, it } from "vitest";
import { mkProblem } from "@/test/fixtures/problems";
import { buildSignals, detectHeavyRuns, noteFlags } from "./signals";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("noteFlags", () => {
  it("detects struggle and revisit keywords", () => {
    expect(noteFlags({ notes: "Really struggled with the recurrence", starred: false })).toEqual({ struggle: true, revisit: false });
    expect(noteFlags({ notes: "Got stuck, couldnt see the trick", starred: false })).toEqual({ struggle: true, revisit: false });
    expect(noteFlags({ notes: "Should REDO this one", starred: false })).toEqual({ struggle: false, revisit: true });
    expect(noteFlags({ notes: "clean two pointers", starred: false })).toEqual({ struggle: false, revisit: false });
  });
  it("counts starred problems as revisit", () => {
    expect(noteFlags({ notes: "", starred: true }).revisit).toBe(true);
  });
  it("matches at word starts only", () => {
    expect(noteFlags({ notes: "orchard", starred: false }).struggle).toBe(false);
  });
});

describe("detectHeavyRuns", () => {
  const p = (day_no: number, topics: string[], difficulty: "Basic" | "Pro" = "Basic") => mkProblem({ day_no, topics, difficulty });

  it("groups consecutive days dominated by one topic", () => {
    const ps = [
      p(1, ["Arrays"]),
      p(2, ["Dynamic Programming"]), p(2, ["Dynamic Programming"]), p(2, ["Graphs"]),
      p(3, ["Dynamic Programming"]),
      p(4, ["Graphs"]),
    ];
    expect(detectHeavyRuns(ps)).toEqual([{ startDay: 2, topic: "Dynamic Programming", days: 2, proCount: 0 }]);
  });

  it("counts a single Pro-dense day and ignores mixed days", () => {
    const ps = [p(5, ["Graphs"], "Pro"), p(5, ["Graphs"], "Pro"), p(5, ["Graphs"], "Pro"), p(6, ["A"]), p(6, ["B"])];
    expect(detectHeavyRuns(ps)).toEqual([{ startDay: 5, topic: "Graphs", days: 1, proCount: 3 }]);
  });

  it("breaks runs on gaps between days", () => {
    expect(detectHeavyRuns([p(1, ["DP"]), p(3, ["DP"])])).toEqual([]);
  });
});

describe("buildSignals", () => {
  const cfg = { startDate: "2026-10-01", skipWeekends: false, restDays: [] };
  const ps = [
    mkProblem({ name: "Secret Problem Name", day_no: 1, difficulty: "Pro", done_at: at(2026, 10, 4), notes: "struggled a lot, private note", topics: ["DP"] }),
    mkProblem({ name: "Another Secret", day_no: 2, difficulty: "Basic", done_at: at(2026, 10, 2), topics: ["Arrays"] }),
    mkProblem({ name: "Overdue One", day_no: 3, difficulty: "Pro", notes: "revisit later", topics: ["DP"] }),
    mkProblem({ day_no: 6, topics: ["DP"] }),
    mkProblem({ day_no: 7, topics: ["DP"] }),
  ];

  it("summarises pace, lag, overdue and flags", () => {
    const s = buildSignals(ps, cfg, "2026-10-05")!;
    expect(s.today).toBe(5);
    expect(s.pace).toEqual({ perActiveDay: 1, perCalendarDay: 0.14, activeDays: 2 });
    expect(s.difficulty.Pro).toMatchObject({ total: 2, done: 1, avgLagDays: 3 });
    expect(s.difficulty.Basic.avgLagDays).toBe(0);
    expect(s.weights.Pro).toBeGreaterThan(2.5);
    expect(s.overdue).toEqual({ total: 1, byDifficulty: { Basic: 0, Core: 0, Pro: 1, None: 0 } });
    expect(s.flaggedTopics).toEqual([{ topic: "DP", struggle: 1, revisit: 1 }]);
    expect(s.flaggedUndone).toBe(1);
    expect(s.heavyRuns).toEqual([{ startDay: 6, topic: "DP", days: 2, proCount: 0 }]);
  });

  it("never includes notes, problem names or ids (privacy)", () => {
    const json = JSON.stringify(buildSignals(ps, cfg, "2026-10-05"));
    for (const secret of ["Secret", "private note", "struggled a lot", "revisit later", "Overdue One", ...ps.map((p) => `"${p.id}"`)]) {
      expect(json).not.toContain(secret);
    }
  });

  it("returns null without a start date", () => {
    expect(buildSignals(ps, { ...cfg, startDate: null }, "2026-10-05")).toBeNull();
  });
});
