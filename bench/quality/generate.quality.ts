/**
 * Sprint generation — response time and the share of generated plans that pass validation (`validatePlan`).
 * Runs the production `generateSprintPlan` with `llm: null` (the built-in planner) on 20 representative prompts.
 * No model is called.
 */
import { expect, it } from "vitest";
import { generateSprintPlan } from "@/lib/generate/generate";
import type { GenerateResponse } from "@/lib/generate/schema";
import { validatePlan } from "@/lib/generate/validate";
import { BENCH_TODAY, makeCatalogue } from "../fixtures";
import { pct, percentile, round, sample, writeMetrics } from "../metrics";
import { GENERATE_PROMPTS } from "./golden/generate-prompts";

const CATALOGUE_SIZES = [2_000, 10_000];
const RUNS = 10;

it("sprint generation quality (built-in planner)", { timeout: 300_000 }, async () => {
  const rows: (string | number)[][] = [];
  const metrics = [];
  const violations = new Map<string, number>();
  let passed = 0, total = 0, fallbacks = 0;

  for (const size of CATALOGUE_SIZES) {
    const catalogue = makeCatalogue(size);
    const deps = { loadCatalogue: async () => catalogue, llm: null };
    const latencies: number[] = [];
    for (const prompt of GENERATE_PROMPTS) {
      const req = { prompt, today: BENCH_TODAY, skip_questions: true };
      const res = await generateSprintPlan(req, deps);
      if (res.kind !== "plan") throw new Error(`expected a plan for "${prompt}"`);
      const check = validatePlan(res as GenerateResponse, catalogue, BENCH_TODAY);
      total++;
      passed += +check.ok;
      fallbacks += +!res.ai;
      for (const v of check.violations) violations.set(v.code, (violations.get(v.code) ?? 0) + 1);
      const times = await sample(() => generateSprintPlan(req, deps), RUNS, 1);
      latencies.push(...times);
      if (size === CATALOGUE_SIZES[0]) {
        rows.push([prompt, res.rows.length, Math.max(...res.rows.map((r) => r.day_no)), check.ok ? "✅" : `❌ ${check.violations.map((v) => v.code).join(", ")}`, round(percentile(times, 50), 1)]);
      }
    }
    metrics.push(
      { id: `generate.latency.p50@${size}`, label: `Response time p50 (${size.toLocaleString("en-US")}-problem catalogue)`, value: round(percentile(latencies, 50), 1), unit: "ms" as const, better: "lower" as const },
      { id: `generate.latency.p95@${size}`, label: `Response time p95 (${size.toLocaleString("en-US")}-problem catalogue)`, value: round(percentile(latencies, 95), 1), unit: "ms" as const, budget: 500, better: "lower" as const },
    );
  }

  metrics.push(
    { id: "generate.pass", label: "Plans passing validation", value: pct(passed, total), unit: "%" as const, budget: 95, better: "higher" as const },
    { id: "generate.fallback", label: "Fallback activation", value: pct(fallbacks, total), unit: "%" as const, better: "lower" as const, note: "100% expected: AI is off for benchmarks." },
  );

  const file = writeMetrics("generate", {
    section: "Sprint generation",
    method: `Production \`generateSprintPlan\` with AI off (built-in planner), ${GENERATE_PROMPTS.length} prompts × ${CATALOGUE_SIZES.length} catalogue sizes, ${RUNS} timed runs each. ` +
      "Validation checks catalogue-only problems, no duplicates, per-day time budget, day count, ordering, fill vs target, weak topics first and start date. " +
      "Details below are for the 2,000-problem catalogue." +
      (violations.size ? ` Violations: ${[...violations].map(([k, v]) => `${k} ×${v}`).join(", ")}.` : ""),
    gate: true,
    context: { prompts: GENERATE_PROMPTS.length, runsPerPrompt: RUNS, model: "none (built-in planner)" },
    metrics,
    details: { columns: ["Prompt", "Problems", "Days", "Validation", "p50 (ms)"], rows },
  });
  console.log(`wrote ${file}`);
  expect(total).toBe(GENERATE_PROMPTS.length * CATALOGUE_SIZES.length);
});
