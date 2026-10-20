/**
 * Reliability — success, timeout and fallback rates for the AI-backed features, measured offline by fault
 * injection. A fake `llm` (no network, no cost) behaves like `vertexJson`: it validates output against the zod
 * schema and aborts after a timeout. Each call is assigned a fault from a fixed mix, and we check that the
 * production `reviewNote` / `generateSprintPlan` always return a usable result and fall back when they should.
 */
import { expect, it } from "vitest";
import type { ZodType } from "zod";
import { generateSprintPlan } from "@/lib/generate/generate";
import type { GenerateResponse } from "@/lib/generate/schema";
import { validatePlan } from "@/lib/generate/validate";
import { reviewNote } from "@/lib/review/review";
import { BENCH_TODAY, makeCatalogue, rng } from "../fixtures";
import { pct, percentile, round, writeMetrics } from "../metrics";
import { GENERATE_PROMPTS } from "./golden/generate-prompts";
import { REVIEW_GOLDEN } from "./golden/review-golden";

type Fault = "ok" | "slow" | "error" | "invalid";
/** Injected fault mix: 70% healthy, 10% each of timeout, provider error and malformed output. */
const MIX: [Fault, number][] = [["ok", 0.7], ["slow", 0.1], ["error", 0.1], ["invalid", 0.1]];
const TIMEOUT_MS = 50;
const ROUNDS = 5;

type Call = { fault: Fault; outcome: "ok" | "timeout" | "error"; ms: number };

/** Fake structured LLM: returns `good(schema)` or misbehaves per `fault`; mirrors vertexJson's timeout + zod check. */
function fakeLlm(nextFault: () => Fault, good: (system: string) => unknown, calls: Call[]) {
  return async <T,>(o: { system: string; user: string; schema: ZodType<T> }): Promise<T> => {
    const fault = nextFault();
    const t = performance.now();
    let recorded = false;
    const record = (outcome: Call["outcome"]) => {
      if (recorded) return;
      recorded = true;
      calls.push({ fault, outcome, ms: performance.now() - t });
    };
    const work = new Promise<unknown>((resolve, reject) => {
      if (fault === "slow") setTimeout(() => resolve(good(o.system)), TIMEOUT_MS * 4);
      else if (fault === "error") setTimeout(() => reject(new Error("503 UNAVAILABLE")), 2);
      else setTimeout(() => resolve(fault === "invalid" ? { nonsense: true } : good(o.system)), 5);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)));
    try {
      const raw = await Promise.race([work, timeout]);
      const parsed = o.schema.safeParse(raw);
      if (!parsed.success) {
        record("error");
        throw new Error("Model output failed validation");
      }
      record("ok");
      return parsed.data;
    } catch (e) {
      record((e as Error).message === "timeout" ? "timeout" : "error");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}

function faultPicker(seed: number) {
  const r = rng(seed);
  return (): Fault => {
    let x = r();
    for (const [f, w] of MIX) if ((x -= w) < 0) return f;
    return "ok";
  };
}

const rates = (calls: Call[]) => ({
  success: pct(calls.filter((c) => c.outcome === "ok").length, calls.length),
  timeout: pct(calls.filter((c) => c.outcome === "timeout").length, calls.length),
  error: pct(calls.filter((c) => c.outcome === "error").length, calls.length),
});

it("reliability under injected AI faults", { timeout: 120_000 }, async () => {
  // --- Note review: one model call per request.
  const reviewCalls: Call[] = [];
  const goodReview = () => ({
    summary: "Looks fine.",
    complexity: { time: "O(n)", space: "O(n)", optimal_time: "O(n)", optimal_space: "O(1)", verdict: "optimal", explanation: "x" },
    edge_cases: [],
    suggested_tags: [],
  });
  const reviewLlm = fakeLlm(faultPicker(1), goodReview, reviewCalls);
  let reviewReqs = 0, reviewFallback = 0, reviewUsable = 0, reviewThrew = 0;
  const reviewLatency: number[] = [];
  for (let round = 0; round < ROUNDS; round++) {
    for (const item of REVIEW_GOLDEN) {
      reviewReqs++;
      const t = performance.now();
      try {
        const res = await reviewNote(item.problem, item.notes, { llm: reviewLlm });
        reviewLatency.push(performance.now() - t);
        if (!res.ai) reviewFallback++;
        if (res.review.summary && res.review.complexity) reviewUsable++;
      } catch {
        reviewThrew++;
      }
    }
  }

  // --- Sprint generation: goal call + plan call per request; any failure falls back to heuristics.
  const genCalls: Call[] = [];
  const catalogue = makeCatalogue(2_000);
  const goodGen = (system: string) =>
    system.includes("structured settings")
      ? {
          goal: {
            company: "Google", weeks: 2, hours_per_day: 2, weak_topics: ["Graphs"], focus_topics: [], skip_weekends: false,
            start_date: null, rest_days: [], difficulty_mix: { basic: 0.25, core: 0.5, pro: 0.25 }, title: "Bench plan",
          },
          unspecified: [],
        }
      : { sprints: [{ theme: "Warm-up", days: [{ ids: ["p1", "p2"] }, { ids: ["p3"] }] }], rationale: "Fake planner output." };
  const genLlm = fakeLlm(faultPicker(2), goodGen, genCalls);
  let genReqs = 0, genFallback = 0, genValid = 0, genThrew = 0;
  const genLatency: number[] = [];
  for (let round = 0; round < ROUNDS; round++) {
    for (const prompt of GENERATE_PROMPTS) {
      genReqs++;
      const t = performance.now();
      try {
        const res = await generateSprintPlan({ prompt, today: BENCH_TODAY, skip_questions: true }, { loadCatalogue: async () => catalogue, llm: genLlm });
        genLatency.push(performance.now() - t);
        if (res.kind !== "plan") continue;
        if (!res.ai) genFallback++;
        if (validatePlan(res as GenerateResponse, catalogue, BENCH_TODAY).ok) genValid++;
      } catch {
        genThrew++;
      }
    }
  }

  const r = rates(reviewCalls), g = rates(genCalls);
  const all = rates([...reviewCalls, ...genCalls]);
  const faulty = [...reviewCalls, ...genCalls].filter((c) => c.fault !== "ok").length;
  const file = writeMetrics("reliability", {
    section: "Reliability",
    method: `Offline fault injection (no model calls): a fake LLM fails ${MIX.filter(([f]) => f !== "ok").map(([f, w]) => `${w * 100}% ${f}`).join(", ")}, ` +
      `with a ${TIMEOUT_MS} ms timeout. Production \`reviewNote\` (${reviewReqs} requests) and \`generateSprintPlan\` (${genReqs} requests) run against it. ` +
      "Model-call rates show what was injected; the gated metrics are how the app copes: no request may fail and every fallback must still produce a valid result.",
    gate: true,
    context: { faultyCalls: faulty, totalCalls: reviewCalls.length + genCalls.length, timeoutMs: TIMEOUT_MS },
    metrics: [
      { id: "rel.requests.failed", label: "Requests that failed (threw)", value: pct(reviewThrew + genThrew, reviewReqs + genReqs), unit: "%", budget: 0, better: "lower" },
      { id: "rel.review.usable", label: "Note reviews returning a usable result", value: pct(reviewUsable, reviewReqs), unit: "%", budget: 100, better: "higher" },
      { id: "rel.generate.valid", label: "Generated plans passing validation", value: pct(genValid, genReqs), unit: "%", budget: 95, better: "higher" },
      { id: "rel.calls.success", label: "Model-call success rate (injected)", value: all.success, unit: "%", better: "higher" },
      { id: "rel.calls.timeout", label: "Model-call timeout rate (injected)", value: all.timeout, unit: "%", better: "lower" },
      { id: "rel.calls.error", label: "Model-call error rate incl. invalid output (injected)", value: all.error, unit: "%", better: "lower" },
      { id: "rel.review.fallback", label: "Fallback activation: note review", value: pct(reviewFallback, reviewReqs), unit: "%", better: "lower" },
      { id: "rel.generate.fallback", label: "Fallback activation: sprint generation", value: pct(genFallback, genReqs), unit: "%", better: "lower" },
      { id: "rel.review.p95", label: "Note review p95 incl. timeouts", value: round(percentile(reviewLatency, 95), 1), unit: "ms", budget: TIMEOUT_MS * 1.5, better: "lower" },
      { id: "rel.generate.p95", label: "Sprint generation p95 incl. timeouts", value: round(percentile(genLatency, 95), 1), unit: "ms", budget: TIMEOUT_MS * 2 + 200, better: "lower" },
    ],
    details: {
      columns: ["Feature", "Model calls", "Success", "Timeout", "Error / invalid"],
      rows: [
        ["Note review", reviewCalls.length, `${r.success}%`, `${r.timeout}%`, `${r.error}%`],
        ["Sprint generation", genCalls.length, `${g.success}%`, `${g.timeout}%`, `${g.error}%`],
      ],
    },
  });
  console.log(`wrote ${file}`);
  expect(reviewThrew + genThrew).toBe(0);
});
