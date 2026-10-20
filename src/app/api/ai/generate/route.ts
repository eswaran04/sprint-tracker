import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRateLimiter } from "@/lib/ai/limits";
import { generateModel, isAiEnabled, vertexLlm } from "@/lib/ai/vertex";
import { withUser } from "@/lib/db/session";
import { getSessionUser } from "@/lib/firebase/admin";
import { dedupe, loadCatalogueRows } from "@/lib/generate/catalogue";
import { GenerateError, generateSprintPlan } from "@/lib/generate/generate";
import { GenerateRequest } from "@/lib/generate/schema";

export const runtime = "nodejs";

// Two model calls (goal + plan) with a large catalogue in the prompt.
const TIMEOUT_MS = 30_000;
const limiter = createRateLimiter(5, 60_000);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const log = (msg: string, e?: unknown) => console.warn(`[ai:generate] ${msg}`, e instanceof Error ? e.message : (e ?? ""));

/**
 * POST { prompt, today, goal?, answers?, skip_questions? } → { data: GenerateResult }: either clarifying questions
 * (`kind: "questions"`) or a sprint plan (`kind: "plan"`, not saved) built from public sheets.
 * Gemini on Vertex AI when enabled; the built-in planner covers AI being off or failing (`ai: false`).
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
  const parsed = GenerateRequest.safeParse(body);
  if (!parsed.success) return fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);

  if (isAiEnabled() && !limiter.take(user.uid)) return fail("Too many requests. Try again in a minute.", 429);

  try {
    const data = await generateSprintPlan(parsed.data, {
      loadCatalogue: () => withUser(user.uid, async (db) => dedupe(await loadCatalogueRows(db))),
      llm: vertexLlm(generateModel(), TIMEOUT_MS),
      log,
    });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof GenerateError) return fail(e.message, e.status);
    console.error("[ai:generate]", e);
    return fail("Couldn't build a sprint", 500);
  }
}
