import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createLru, createRateLimiter } from "@/lib/ai/limits";
import { reviewModel, vertexLlm } from "@/lib/ai/vertex";
import { getSessionUser } from "@/lib/firebase/admin";
import { generateRecall, generateViva } from "@/lib/recall/recall";
import { RecallRequest, type RecallResponse, type VivaResponse } from "@/lib/recall/schema";

export const runtime = "nodejs";

// Short prompts and short answers: a warmup question should never keep the user waiting long.
const TIMEOUT_MS = 15_000;
const limiter = createRateLimiter(20, 60_000);
const cache = createLru<RecallResponse | VivaResponse>(300);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const log = (msg: string, e?: unknown) => console.warn(`[ai:recall] ${msg}`, e instanceof Error ? e.message : (e ?? ""));

/**
 * POST { mode: "recall", problem, notes, daysAgo } → { data: RecallResponse }
 * POST { mode: "viva", problem, notes } → { data: VivaResponse }
 * Gemini when enabled; otherwise (or when the model fails) built-in questions with `ai: false`.
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
  const parsed = RecallRequest.safeParse(body);
  if (!parsed.success) return fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);
  const req = parsed.data;

  const run = (llm: ReturnType<typeof vertexLlm>) =>
    req.mode === "recall"
      ? generateRecall(req.problem, req.notes, req.daysAgo, { llm, log })
      : generateViva(req.problem, req.notes, { llm, log });

  const llm = vertexLlm(reviewModel(), TIMEOUT_MS);
  // Built-in questions are cheap and deterministic: no cache or rate limit needed.
  if (!llm) return NextResponse.json({ data: await run(null) });

  // daysAgo is part of the key, so a recall question naturally refreshes the next day.
  const key = createHash("sha256").update(JSON.stringify(req)).digest("hex");
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ data: hit });

  if (!limiter.take(user.uid)) return fail("Too many warmup questions. Try again in a minute.", 429);

  const data = await run(llm);
  // Only AI questions are cached, so a transient model failure doesn't pin the fallback.
  if (data.ai) cache.set(key, data);
  return NextResponse.json({ data });
}
