import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createLru, createRateLimiter } from "@/lib/ai/limits";
import { reviewModel, vertexLlm } from "@/lib/ai/vertex";
import { getSessionUser } from "@/lib/firebase/admin";
import { reviewNote } from "@/lib/review/review";
import { ReviewRequest, type ReviewResponse } from "@/lib/review/schema";

export const runtime = "nodejs";

// Reviews are longer than filter queries (code listings + reasoning), so allow more time than /api/ai/filters.
const TIMEOUT_MS = 25_000;
const limiter = createRateLimiter(10, 60_000);
const cache = createLru<ReviewResponse>(200);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const log = (msg: string, e?: unknown) => console.warn(`[ai:review] ${msg}`, e instanceof Error ? e.message : (e ?? ""));

/**
 * POST { problem, notes } → { data: ReviewResponse }. Gemini on Vertex AI when enabled; otherwise (or when the model
 * fails) the built-in analyzer answers with `ai: false`, so "Analyze note" always works.
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
  const parsed = ReviewRequest.safeParse(body);
  if (!parsed.success) return fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);
  const { problem, notes } = parsed.data;

  const llm = vertexLlm(reviewModel(), TIMEOUT_MS);
  // Built-in analysis is cheap and deterministic: no cache or rate limit needed.
  if (!llm) return NextResponse.json({ data: await reviewNote(problem, notes, { llm: null }) });

  const key = createHash("sha256").update(JSON.stringify([problem, notes])).digest("hex");
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ data: hit });

  if (!limiter.take(user.uid)) return fail("Too many reviews. Try again in a minute.", 429);

  const data = await reviewNote(problem, notes, { llm, log });
  // Only AI reviews are cached, so a transient model failure doesn't pin the fallback for these notes.
  if (data.ai) cache.set(key, data);
  return NextResponse.json({ data });
}
