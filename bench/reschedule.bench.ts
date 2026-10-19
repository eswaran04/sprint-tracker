/**
 * Rescheduling: the work `POST /api/ai/coach` does on the server for a sprint with an overdue backlog
 * (always the built-in strategy here — no model is called).
 */
import { describe, test } from "vitest";
import { buildCoachPlan, coachInputs } from "@/lib/coach/plan";
import { defaultStrategy, planReschedule } from "@/lib/coach/planner";
import { shiftBacklog } from "@/lib/schedule";
import { BENCH_TODAY, makeOverdueBacklog, resultPath, SIZES } from "./fixtures";

// The 10k end-to-end path takes ~1 s per call, so cap iterations (tinybench defaults to a 64-run minimum).
const RUN = { time: 500, warmupTime: 100, iterations: 10, warmupIterations: 2 };

describe.each(SIZES)("%i problems", (size) => {
  const { sprint, problems } = makeOverdueBacklog(size);
  const inputs = coachInputs(sprint, problems, BENCH_TODAY);
  if (!inputs || !inputs.signals.overdue.total) throw new Error("fixture must have an overdue backlog");
  const { signals, sprintFor } = inputs;
  const strategy = defaultStrategy(signals);
  const out = (name: string) => ({ writeResult: resultPath("reschedule", name, size) });

  test("reschedule", { timeout: 120_000 }, async ({ bench }) => {
    await bench.compare(
      bench("coachInputs", out("coachInputs"), () => void coachInputs(sprint, problems, BENCH_TODAY)),
      bench("planReschedule", out("planReschedule"), () =>
        void planReschedule(problems, { today: signals.today, sprintFor, strategy, weights: signals.weights }),
      ),
      bench("shiftBacklog", out("shiftBacklog"), () => void shiftBacklog(problems, signals.today, sprintFor)),
      // Everything the coach route computes after loading the sprint (rule-based path).
      bench("end-to-end", out("end-to-end"), () => {
        const i = coachInputs(sprint, problems, BENCH_TODAY)!;
        const s = defaultStrategy(i.signals);
        void buildCoachPlan(problems, i.signals, i.sprintFor, s, [], false);
      }),
      RUN,
    );
  });
});
