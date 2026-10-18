import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGoal, MAX_GOAL_LENGTH, saveGoal } from "@/lib/ai/embeddings";
import { createRateLimiter } from "@/lib/ai/limits";
import { isAiEnabled } from "@/lib/ai/vertex";
import { getSessionUser } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const body = z.object({ goal: z.string().max(MAX_GOAL_LENGTH) }).strict();
const limiter = createRateLimiter(10, 60_000);

/** The caller's study goal (drives "Recommended for your goal" on Explore). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);
  return NextResponse.json({ data: { goal: await getGoal(user.uid), enabled: isAiEnabled() } });
}

/** Saves the goal and embeds it on the server (RETRIEVAL_QUERY). An empty goal clears it. */
export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(`Invalid goal: ${z.prettifyError(parsed.error)}`, 400);
  const goal = parsed.data.goal.trim();
  if (goal && !isAiEnabled()) return fail("AI features are turned off", 503);
  if (!limiter.take(user.uid)) return fail("Too many updates, try again in a minute", 429);
  try {
    await saveGoal(user.uid, goal);
    return NextResponse.json({ data: { goal: goal || null } });
  } catch (e) {
    console.error("[goal]", e);
    return fail("Couldn't save your goal", 502);
  }
}
