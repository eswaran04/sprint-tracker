import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  buildCoachPrompt, buildCoachResponseSchema, COACH_SYSTEM_PROMPT, coachRequestSchema, describeStrategy, sanitizeCoachStrategy,
} from "@/lib/ai/coach";
import { createLru, createRateLimiter } from "@/lib/ai/limits";
import { parseModelJson } from "@/lib/ai/nl-filters";
import { coachModel, isAiEnabled, vertex } from "@/lib/ai/vertex";
import { buildCoachPlan, coachInputs, type CoachPlan } from "@/lib/coach/plan";
import { defaultStrategy } from "@/lib/coach/planner";
import { OpError, ops } from "@/lib/db/ops";
import { withUser } from "@/lib/db/session";
import { getSessionUser } from "@/lib/firebase/admin";
import type { Problem, Sprint } from "@/lib/types";

export const runtime = "nodejs";

const TIMEOUT_MS = 8_000;
const limiter = createRateLimiter(5, 60_000);
const cache = createLru<CoachPlan>(200);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const stamp = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""));

/**
 * POST { sprintId, today } → { data: CoachPlan }. Proposes a reschedule; nothing is saved here.
 * The client applies `changes` through the existing `reschedule` op after the user approves.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = coachRequestSchema.safeParse(body);
  if (!parsed.success) return fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);
  const { sprintId, today } = parsed.data;

  // Loaded server-side under RLS: notes and progress never come from the client.
  let sprint: Sprint;
  let problems: Problem[];
  try {
    ({ sprint, problems } = (await withUser(user.uid, (db) => ops.getSprint.run(db, { id: sprintId } as never))) as {
      sprint: Sprint;
      problems: Problem[];
    });
  } catch (e) {
    if (e instanceof OpError) return fail(e.message, e.status);
    console.error("[ai:coach] load", e);
    return fail("Couldn't load this sprint", 500);
  }

  const inputs = coachInputs(sprint, problems, today);
  if (!inputs) return fail("Set a start date to use smart reschedule", 400);
  const { signals, sprintFor } = inputs;
  const fallback = defaultStrategy(signals);
  const ruleBased = () => buildCoachPlan(problems, signals, sprintFor, fallback, describeStrategy(fallback, signals), false);

  if (!signals.overdue.total) return NextResponse.json({ data: ruleBased() });

  const aiOn = isAiEnabled();
  const lastEdit = problems.reduce((m, p) => (stamp(p.updated_at) > m ? stamp(p.updated_at) : m), stamp(sprint.updated_at));
  const key = createHash("sha256").update(JSON.stringify([user.uid, sprintId, today, lastEdit, problems.length, aiOn])).digest("hex");
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ data: hit });

  if (!aiOn || !limiter.take(user.uid)) return NextResponse.json({ data: ruleBased() });

  try {
    const res = await vertex().models.generateContent({
      model: coachModel(),
      contents: buildCoachPrompt(signals),
      config: {
        systemInstruction: COACH_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: buildCoachResponseSchema(signals),
        temperature: 0.2,
        maxOutputTokens: 1024,
        httpOptions: { timeout: TIMEOUT_MS },
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    });
    const advice = sanitizeCoachStrategy(parseModelJson(res.text), signals, fallback);
    const rationale = advice.rationale.length ? advice.rationale : describeStrategy(advice.strategy, signals);
    const data = buildCoachPlan(problems, signals, sprintFor, advice.strategy, rationale, true);
    cache.set(key, data);
    return NextResponse.json({ data });
  } catch (e) {
    // The rule-based plan is always a valid answer; a slow or failing model shouldn't block the user.
    const name = (e as Error)?.name;
    if (name !== "TimeoutError" && name !== "AbortError") console.error("[ai:coach]", e);
    return NextResponse.json({ data: ruleBased() });
  }
}
