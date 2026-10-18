import { addDays, format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import type { CatalogueProblem } from "@/lib/generate/catalogue";
import type { Difficulty, Problem, Sprint } from "@/lib/types";

/** Fixed "today" for every offline benchmark, so runs are comparable. */
export const BENCH_TODAY = "2026-10-15";

/** Sheet sizes benchmarked: a typical sheet, a large one, and a stress case. */
export const SIZES = [500, 2_000, 10_000] as const;

const COMPANIES = ["Google", "Amazon", "Adobe", "Zoho", "Microsoft", "Meta", "Uber", "Flipkart", "Accenture", "Atlassian"];
const TOPICS = ["Arrays", "Hashing", "Strings", "Graphs", "DP", "Trees", "Greedy", "Heaps", "Sorting", "Recursion", "Stack", "Two Pointers"];
const SUBJECTS = ["dsa", "oops", "dbms", "os", "cn"];
const DIFFICULTIES: (Difficulty | null)[] = ["Basic", "Core", "Pro", null];

/** Deterministic PRNG (mulberry32) so every run benchmarks identical data. */
export function rng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const pickSome = (r: () => number, xs: readonly string[], max: number) => [
  ...new Set(Array.from({ length: Math.floor(r() * (max + 1)) }, () => pick(r, xs))),
];

/** ~6 problems per plan day, 7 days per sprint, ~40% done with timestamps over the last 90 days. */
export function makeProblems(n: number, seed = 42): Problem[] {
  const r = rng(seed);
  const now = Date.UTC(2026, 9, 15);
  return Array.from({ length: n }, (_, i) => {
    const day = Math.floor(i / 6) + 1;
    const done = r() < 0.4;
    return {
      id: `p${i}`, sprint_id: "s1", position: i + 1, name: `Problem ${i + 1} ${pick(r, TOPICS)}`,
      url: `https://example.com/p/${i}`, subject: pick(r, SUBJECTS), difficulty: pick(r, DIFFICULTIES),
      companies: pickSome(r, COMPANIES, 4), topics: pickSome(r, TOPICS, 3),
      sprint_no: Math.ceil(day / 7), day_no: day, original_day_no: day, original_sprint_no: null, source_id: null,
      done_at: done ? new Date(now - Math.floor(r() * 90) * 86_400_000).toISOString() : null,
      starred: r() < 0.1, notes: "",
    };
  });
}

/** Builds an .xlsx ArrayBuffer shaped like a real prep sheet, for import benchmarks. */
export function makeWorkbook(n: number, seed = 42): ArrayBuffer {
  const headers = ["Name", "Url", "Subject", "Difficulty", "Companies", "Topics", "Sprint", "Day"];
  const rows = makeProblems(n, seed).map((p) => [
    p.name, p.url, p.subject, p.difficulty ?? "", p.companies.join(" | "), p.topics.join(" | "), p.sprint_no, p.day_no,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Sheet");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

/**
 * A sprint that is ~60% through its plan with a real backlog: past days are ~70% done, the rest overdue, and a
 * few notes carry "struggle"/"revisit" keywords so the coach's flagged-topic and review-day paths run.
 */
export function makeOverdueBacklog(n: number, seed = 7): { sprint: Sprint; problems: Problem[] } {
  const r = rng(seed);
  const perDay = 6;
  const maxDay = Math.ceil(n / perDay);
  const todayDay = Math.max(2, Math.floor(maxDay * 0.6));
  const startDate = format(addDays(parseISO(BENCH_TODAY), -(todayDay - 1)), "yyyy-MM-dd");
  const problems = makeProblems(n, seed).map((p) => {
    const past = p.day_no < todayDay;
    const done = past && r() < 0.7;
    const doneDay = format(addDays(parseISO(startDate), p.day_no - 1 + Math.floor(r() * 3)), "yyyy-MM-dd");
    const flag = r();
    return {
      ...p,
      done_at: done ? `${doneDay}T12:00:00.000Z` : null,
      notes: flag < 0.04 ? "Struggled with this one, got stuck on the recurrence" : flag < 0.08 ? "revisit later" : "",
    };
  });
  const sprint: Sprint = {
    id: "s1", user_id: "bench", title: "Bench backlog", start_date: startDate, skip_weekends: false, rest_days: [],
    visibility: "private", description: "", show_owner: false, owner_name: null, owner_avatar: null,
    published_at: null, copied_from: null, copy_count: 0, created_at: `${startDate}T00:00:00.000Z`,
  };
  return { sprint, problems };
}

const CATALOGUE_TOPICS = [
  "Arrays", "Hashing", "Strings", "Graphs", "Dynamic Programming", "Trees", "Greedy", "Heap", "Sorting", "Recursion",
  "Stack", "Two Pointers", "Sliding Window", "Binary Search", "Linked List", "Trie", "Bit Manipulation",
];

/** De-duplicated public catalogue, as `generateSprintPlan` receives it from `dedupe(loadCatalogueRows())`. */
export function makeCatalogue(n: number, seed = 11): CatalogueProblem[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => ({
    name: `Catalogue problem ${i + 1}`,
    url: `https://example.com/c/${i}`,
    subject: "dsa",
    difficulty: pick(r, DIFFICULTIES),
    companies: pickSome(r, COMPANIES, 3),
    topics: [pick(r, CATALOGUE_TOPICS), ...pickSome(r, CATALOGUE_TOPICS, 1)].filter((t, j, a) => a.indexOf(t) === j),
    sheets: 1 + Math.floor(r() * 5),
    order: i,
  }));
}

/** Result file for one benchmark; `scripts/bench-report.mjs` turns these into the report. */
export const resultPath = (group: string, name: string, size: number) => `bench/results/${group}/${name}@${size}.json`;
