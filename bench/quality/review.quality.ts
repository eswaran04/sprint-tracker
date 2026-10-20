/**
 * AI note review — latency and agreement with hand-labelled assessments (`golden/review-golden.ts`).
 * Runs the production `reviewNote` with `llm: null`, i.e. the built-in analyzer users get when AI is off or fails.
 * No model is called.
 */
import { expect, it } from "vitest";
import { normComplexity } from "@/lib/review/blocks";
import { reviewNote } from "@/lib/review/review";
import type { Review } from "@/lib/review/schema";
import { pct, percentile, round, sample, writeMetrics } from "../metrics";
import { REVIEW_GOLDEN, type GoldenReview } from "./golden/review-golden";

const RUNS = 30;

function score(item: GoldenReview, review: Review) {
  const e = item.expected;
  const time = normComplexity(review.complexity.time) === normComplexity(e.time);
  const space = normComplexity(review.complexity.space) === normComplexity(e.space);
  const verdict = review.complexity.verdict === e.verdict;
  const found = e.edgeCases.filter((x) =>
    review.edge_cases.some((f) => f.severity === x.severity && x.keywords.some((k) => f.message.toLowerCase().includes(k.toLowerCase()))),
  ).length;
  const falseAlarm = Boolean(e.clean) && review.edge_cases.some((f) => f.severity !== "note");
  return { time, space, verdict, found, expectedEdges: e.edgeCases.length, falseAlarm };
}

it("note review quality (built-in analyzer)", async () => {
  const rows: (string | number)[][] = [];
  const latencies: number[] = [];
  let time = 0, space = 0, verdict = 0, found = 0, expectedEdges = 0, cleanItems = 0, falseAlarms = 0, fallbacks = 0;

  for (const item of REVIEW_GOLDEN) {
    const res = await reviewNote(item.problem, item.notes, { llm: null });
    if (!res.ai) fallbacks++;
    latencies.push(...(await sample(() => reviewNote(item.problem, item.notes, { llm: null }), RUNS)));
    const s = score(item, res.review);
    time += +s.time;
    space += +s.space;
    verdict += +s.verdict;
    found += s.found;
    expectedEdges += s.expectedEdges;
    if (item.expected.clean) cleanItems++;
    falseAlarms += +s.falseAlarm;
    rows.push([
      item.id,
      `${res.review.complexity.time} ${s.time ? "✅" : `❌ (want ${item.expected.time})`}`,
      `${res.review.complexity.space} ${s.space ? "✅" : `❌ (want ${item.expected.space})`}`,
      s.expectedEdges ? `${s.found}/${s.expectedEdges}` : s.falseAlarm ? "false alarm" : "—",
      item.reviewed ? "yes" : "draft",
    ]);
  }

  const n = REVIEW_GOLDEN.length;
  const file = writeMetrics("review", {
    section: "AI note review",
    method: `Production \`reviewNote\` with AI off (built-in analyzer) on ${n} labelled notes, ${RUNS} timed runs each. ` +
      "Agreement = exact match after normalising complexity notation; edge-case recall = expected findings matched by severity + keyword. " +
      `${REVIEW_GOLDEN.filter((g) => !g.reviewed).length} of ${n} labels are drafts awaiting a second reviewer.`,
    gate: true,
    context: { items: n, runsPerItem: RUNS, model: "none (built-in analyzer)" },
    metrics: [
      { id: "review.latency.p50", label: "Response time p50", value: round(percentile(latencies, 50), 3), unit: "ms", better: "lower" },
      { id: "review.latency.p95", label: "Response time p95", value: round(percentile(latencies, 95), 3), unit: "ms", budget: 50, better: "lower" },
      { id: "review.agree.time", label: "Time-complexity agreement", value: pct(time, n), unit: "%", budget: 70, better: "higher" },
      { id: "review.agree.space", label: "Space-complexity agreement", value: pct(space, n), unit: "%", budget: 60, better: "higher" },
      { id: "review.edge.recall", label: "Edge-case recall", value: pct(found, expectedEdges), unit: "%", budget: 70, better: "higher" },
      { id: "review.edge.falseAlarm", label: "False alarms on clean code", value: pct(falseAlarms, cleanItems), unit: "%", budget: 20, better: "lower" },
      {
        id: "review.agree.verdict", label: "Optimal/suboptimal verdict agreement", value: pct(verdict, n), unit: "%", better: "higher",
        note: "The built-in analyzer never judges optimality (always \"unknown\"); only the AI reviewer can.",
      },
      { id: "review.fallback", label: "Fallback activation", value: pct(fallbacks, n), unit: "%", better: "lower", note: "100% expected: AI is off for benchmarks." },
    ],
    details: { columns: ["Item", "Time", "Space", "Edge cases found", "Label"], rows },
  });
  console.log(`wrote ${file}`);
  expect(rows).toHaveLength(n);
});
