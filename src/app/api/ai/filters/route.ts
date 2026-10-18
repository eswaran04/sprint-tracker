import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createLru, createRateLimiter } from "@/lib/ai/limits";
import {
  aiFiltersRequestSchema, buildPrompt, buildResponseSchema, parseModelJson, sanitizeAiFilters, SYSTEM_PROMPT, type AiFilters,
} from "@/lib/ai/nl-filters";
import { filtersModel, isAiEnabled, vertex } from "@/lib/ai/vertex";
import { getSessionUser } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const TIMEOUT_MS = 8_000;
const limiter = createRateLimiter(20, 60_000);
const cache = createLru<AiFilters>(500);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** POST { text, facets } → { data: AiFilters }. The client merges it into the URL filters and runs `applyFilters`. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);
  if (!isAiEnabled()) return fail("AI filters are not available right now", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = aiFiltersRequestSchema.safeParse(body);
  if (!parsed.success) return fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);
  const { text, facets } = parsed.data;

  const key = createHash("sha256").update(JSON.stringify([text.toLowerCase().replace(/\s+/g, " "), facets])).digest("hex");
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ data: hit });

  if (!limiter.take(user.uid)) return fail("Too many AI requests. Try again in a minute.", 429);

  try {
    const res = await vertex().models.generateContent({
      model: filtersModel(),
      contents: buildPrompt(text),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: buildResponseSchema(facets),
        temperature: 0,
        maxOutputTokens: 512,
        httpOptions: { timeout: TIMEOUT_MS },
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    });
    const data = sanitizeAiFilters(parseModelJson(res.text), facets);
    cache.set(key, data);
    return NextResponse.json({ data });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") return fail("The AI took too long. Try a shorter query.", 504);
    console.error("[ai:filters]", e);
    return fail("Couldn't interpret that query", 502);
  }
}
