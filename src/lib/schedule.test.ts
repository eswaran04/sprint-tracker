import { describe, expect, it } from "vitest";
import { currentPlanDay, dayToDate, insertGapDays, makeSprintForDay, shiftBacklog, workingDay, type ScheduleConfig } from "./schedule";

// 2026-10-01 is a Thursday.
const base: ScheduleConfig = { startDate: "2026-10-01", skipWeekends: false, restDays: [] };

describe("dayToDate", () => {
  it("returns null without a start date", () => {
    expect(dayToDate(1, { ...base, startDate: null })).toBeNull();
  });
  it("maps consecutive days", () => {
    expect(dayToDate(1, base)).toBe("2026-10-01");
    expect(dayToDate(5, base)).toBe("2026-10-05");
  });
  it("skips weekends", () => {
    const cfg = { ...base, skipWeekends: true };
    expect(dayToDate(2, cfg)).toBe("2026-10-02"); // Fri
    expect(dayToDate(3, cfg)).toBe("2026-10-05"); // Mon
  });
  it("skips rest days", () => {
    expect(dayToDate(2, { ...base, restDays: ["2026-10-02"] })).toBe("2026-10-03");
  });
  it("moves start forward when the start itself is a weekend", () => {
    expect(dayToDate(1, { ...base, startDate: "2026-10-03", skipWeekends: true })).toBe("2026-10-05");
  });
});

describe("currentPlanDay", () => {
  it("is null without a start date", () => {
    expect(currentPlanDay({ ...base, startDate: null }, "2026-10-05")).toBeNull();
  });
  it("is 1 before the start", () => {
    expect(currentPlanDay(base, "2026-09-20")).toEqual({ day: 1, isWorkingDay: false });
  });
  it("counts working days through today", () => {
    expect(currentPlanDay(base, "2026-10-03")).toEqual({ day: 3, isWorkingDay: true });
  });
  it("on a weekend points at the next working day", () => {
    expect(currentPlanDay({ ...base, skipWeekends: true }, "2026-10-03")).toEqual({ day: 3, isWorkingDay: false });
  });
});

describe("makeSprintForDay", () => {
  const sprintFor = makeSprintForDay([
    { original_day_no: 1, sprint_no: 1 },
    { original_day_no: 7, sprint_no: 1 },
    { original_day_no: 8, sprint_no: 2 },
  ]);
  it("uses original mapping, carrying forward past the end", () => {
    expect(sprintFor(1)).toBe(1);
    expect(sprintFor(5)).toBe(1);
    expect(sprintFor(8)).toBe(2);
    expect(sprintFor(99)).toBe(2);
  });
});

describe("makeSprintForDay after a shift", () => {
  it("prefers the original sprint over the rescheduled one", () => {
    const sprintFor = makeSprintForDay([{ original_day_no: 5, sprint_no: 2, original_sprint_no: 1 }]);
    expect(sprintFor(5)).toBe(1);
  });
});

describe("shiftBacklog", () => {
  const p = (id: string, day_no: number, done = false) => ({ id, day_no, done_at: done ? "x" : null });
  const sprintFor = (d: number) => (d <= 7 ? 1 : 2);

  it("shifts undone items from the earliest missed day, keeping spacing", () => {
    const changes = shiftBacklog([p("a", 2, true), p("b", 3), p("c", 4), p("d", 6), p("e", 3, true)], 5, sprintFor);
    expect(changes).toEqual([
      { id: "b", day_no: 5, sprint_no: 1 },
      { id: "c", day_no: 6, sprint_no: 1 },
      { id: "d", day_no: 8, sprint_no: 2 },
    ]);
  });
  it("is a no-op with nothing overdue", () => {
    expect(shiftBacklog([p("a", 2, true), p("b", 5)], 5, sprintFor)).toEqual([]);
  });
});

describe("workingDay", () => {
  const p = (day_no: number, done_at: string | null = null) => ({ day_no, done_at });

  it("picks the next undone problem after the most recently completed one", () => {
    expect(workingDay([p(1, "2026-10-01T10:00Z"), p(2), p(3, "2026-10-03T10:00Z"), p(3), p(5)], 2)).toBe(3);
  });
  it("ignores a skipped problem in an earlier sprint", () => {
    expect(workingDay([p(1), p(8, "2026-10-01T09:00Z"), p(9, "2026-10-02T09:00Z"), p(10)], 1)).toBe(10);
  });
  it("uses completion time, not position, to find the latest done problem", () => {
    expect(workingDay([p(1), p(2, "2026-10-05T09:00Z"), p(3), p(4, "2026-10-01T09:00Z"), p(5)], null)).toBe(3);
  });
  it("wraps to the first undone problem when nothing is left after the latest", () => {
    expect(workingDay([p(1), p(2, "2026-10-01T09:00Z"), p(3, "2026-10-02T09:00Z")], null)).toBe(1);
  });
  it("uses the calendar day when nothing is done yet", () => {
    expect(workingDay([p(1), p(2), p(4), p(6)], 3)).toBe(4);
  });
  it("falls back to the first undone day without a start date", () => {
    expect(workingDay([p(4), p(1), p(2)], null)).toBe(1);
  });
  it("returns the last day when everything is done, and null when empty", () => {
    expect(workingDay([p(1, "a"), p(5, "b")], 2)).toBe(5);
    expect(workingDay([], 2)).toBeNull();
  });
});

describe("insertGapDays", () => {
  it("pushes undone problems on/after each gap day forward, leaving done ones put", () => {
    const ps = [
      { id: "a", day_no: 3, done_at: null },
      { id: "b", day_no: 4, done_at: null },
      { id: "c", day_no: 4, done_at: "2026-10-01T00:00:00Z" },
      { id: "d", day_no: 6, done_at: null },
    ];
    expect(insertGapDays(ps, [4, 6], () => 1)).toEqual([
      { id: "b", day_no: 5, sprint_no: 1 },
      { id: "d", day_no: 8, sprint_no: 1 },
    ]);
    expect(insertGapDays(ps, [], () => 1)).toEqual([]);
  });
});
