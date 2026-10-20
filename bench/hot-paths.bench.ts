/**
 * Client hot paths re-run on every sprint view render / filter change (see `sprint-view.tsx`).
 * Run: `npm run bench` → results in `bench/results/`, report via `npm run bench:report`.
 */
import { describe, test } from "vitest";
import { applyFilters, DEFAULT_FILTERS, facets, matches, STATUSES, type Filters } from "@/lib/filters";
import { breakdown, difficultyPerformance, heatmap, streaks, summary } from "@/lib/stats";
import { buildCalendar, currentPlanDay, makeSprintForDay, workingDay, type ScheduleConfig } from "@/lib/schedule";
import { buildSignals } from "@/lib/coach/signals";
import type { Problem } from "@/lib/types";
import { makeProblems, resultPath, SIZES } from "./fixtures";

const RUN = { time: 300, warmupTime: 100 };
const TODAY = "2026-10-15";
const CFG: ScheduleConfig = { startDate: "2026-01-05", skipWeekends: true, restDays: ["2026-03-02", "2026-05-01"] };

const SEARCH: Filters = { ...DEFAULT_FILTERS, q: "graph" };
const COMBINED: Filters = { ...DEFAULT_FILTERS, companies: ["Google", "Amazon"], topics: ["DP"], difficulties: ["Pro"], status: "todo" };
const SORT_NAME: Filters = { ...DEFAULT_FILTERS, sort: "name", dir: "desc" };

/** Mirrors the `statusCounts` memo in `sprint-view.tsx`. */
const statusCounts = (problems: Problem[], f: Filters) => {
  const base = problems.filter((p) => matches(p, { ...f, status: "all" }));
  return STATUSES.map((s) => base.filter((p) => matches(p, { ...f, status: s })).length);
};

describe.each(SIZES)("%i problems", (size) => {
  const problems = makeProblems(size);
  const doneAts = problems.flatMap((p) => (p.done_at ? [p.done_at] : []));
  const maxDay = problems.reduce((m, p) => Math.max(m, p.day_no), 1);
  const calendar = buildCalendar(maxDay + 400, CFG)!;
  const dateFor = (d: number) => calendar[d - 1] ?? null;
  const out = (group: string, name: string) => ({ writeResult: resultPath(group, name, size) });

  test("filters", async ({ bench }) => {
    await bench.compare(
      bench("applyFilters:default", out("filters", "applyFilters-default"), () => void applyFilters(problems, DEFAULT_FILTERS)),
      bench("applyFilters:search", out("filters", "applyFilters-search"), () => void applyFilters(problems, SEARCH)),
      bench("applyFilters:combined", out("filters", "applyFilters-combined"), () => void applyFilters(problems, COMBINED)),
      bench("applyFilters:sortName", out("filters", "applyFilters-sortName"), () => void applyFilters(problems, SORT_NAME)),
      bench("facets", out("filters", "facets"), () => void facets(problems)),
      bench("statusCounts", out("filters", "statusCounts"), () => void statusCounts(problems, SEARCH)),
      RUN,
    );
  });

  test("stats", async ({ bench }) => {
    await bench.compare(
      bench("summary", out("stats", "summary"), () => void summary(problems, 200)),
      bench("heatmap", out("stats", "heatmap"), () => void heatmap(doneAts)),
      bench("streaks", out("stats", "streaks"), () => void streaks(doneAts, TODAY)),
      bench("difficultyPerformance", out("stats", "difficultyPerformance"), () => void difficultyPerformance(problems, dateFor)),
      bench("breakdown:topics", out("stats", "breakdown-topics"), () => void breakdown(problems, (p) => p.topics)),
      RUN,
    );
  });

  test("schedule", async ({ bench }) => {
    await bench.compare(
      bench("buildCalendar", out("schedule", "buildCalendar"), () => void buildCalendar(maxDay + 400, CFG)),
      bench("currentPlanDay", out("schedule", "currentPlanDay"), () => void currentPlanDay(CFG, TODAY)),
      bench("makeSprintForDay", out("schedule", "makeSprintForDay"), () => void makeSprintForDay(problems)),
      bench("workingDay", out("schedule", "workingDay"), () => void workingDay(problems, 200)),
      bench("coach:buildSignals", out("schedule", "buildSignals"), () => void buildSignals(problems, CFG, TODAY)),
      RUN,
    );
  });
});
