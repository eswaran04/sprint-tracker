/**
 * Live prompt-quality check for the backlog coach against Vertex AI. Not part of CI (needs ADC credentials).
 *   npm run test:ai
 */
import { GoogleGenAI } from "@google/genai";
import { expect, it } from "vitest";
import type { CoachSignals } from "@/lib/coach/signals";
import { defaultStrategy } from "@/lib/coach/planner";
import { buildCoachPrompt, buildCoachResponseSchema, COACH_SYSTEM_PROMPT, sanitizeCoachStrategy } from "./coach";
import { parseModelJson } from "./nl-filters";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || "global",
});
const model = process.env.AI_COACH_MODEL || "gemini-2.5-flash";

const perf = (done: number, avgLagDays: number | null) => ({ total: done + 5, done, completionRate: done / (done + 5), avgLagDays });
const base = (s: Partial<CoachSignals>): CoachSignals => ({
  today: 10,
  pace: { perActiveDay: 3, perCalendarDay: 2, activeDays: 8 },
  difficulty: { Basic: perf(10, 0), Core: perf(8, 0.5), Pro: perf(4, 0.3), None: perf(0, null) },
  weights: { Basic: 1, Core: 1.5, Pro: 2.5, None: 1 },
  overdue: { total: 6, byDifficulty: { Basic: 2, Core: 2, Pro: 2, None: 0 } },
  remaining: { total: 60, byDifficulty: { Basic: 20, Core: 25, Pro: 15, None: 0 } },
  plannedPerDay: 4,
  flaggedUndone: 0,
  flaggedTopics: [],
  heavyRuns: [],
  ...s,
});

const CASES: { name: string; signals: CoachSignals; check: (s: ReturnType<typeof sanitizeCoachStrategy>["strategy"]) => boolean }[] = [
  {
    name: "slow on Pro → caps Pro",
    signals: base({ difficulty: { ...base({}).difficulty, Pro: perf(4, 3) }, overdue: { total: 8, byDifficulty: { Basic: 1, Core: 1, Pro: 6, None: 0 } } }),
    check: (s) => s.maxProPerDay >= 1 && s.maxProPerDay <= 2,
  },
  {
    name: "flagged DP run → review day",
    signals: base({
      flaggedUndone: 3,
      flaggedTopics: [{ topic: "Dynamic Programming", struggle: 3, revisit: 1 }],
      heavyRuns: [{ startDay: 12, topic: "Dynamic Programming", days: 4, proCount: 3 }],
    }),
    check: (s) => s.reviewBefore.includes("Dynamic Programming"),
  },
  {
    name: "fast pace → generous capacity",
    signals: base({ pace: { perActiveDay: 8, perCalendarDay: 6, activeDays: 10 } }),
    check: (s) => s.dailyCapacity >= 8,
  },
];

it(`live coach picks sensible strategies (${model})`, { timeout: 120_000 }, async () => {
  let pass = 0;
  for (const c of CASES) {
    const res = await ai.models.generateContent({
      model,
      contents: buildCoachPrompt(c.signals),
      config: { systemInstruction: COACH_SYSTEM_PROMPT, responseMimeType: "application/json", responseJsonSchema: buildCoachResponseSchema(c.signals), temperature: 0.2 },
    });
    const { strategy, rationale } = sanitizeCoachStrategy(parseModelJson(res.text), c.signals, defaultStrategy(c.signals));
    const ok = c.check(strategy) && rationale.length > 0;
    if (ok) pass++;
    console.log(`${ok ? "✓" : "✗"} ${c.name}: ${JSON.stringify(strategy)}\n    ${rationale.join("\n    ")}`);
  }
  expect(pass).toBe(CASES.length);
});
