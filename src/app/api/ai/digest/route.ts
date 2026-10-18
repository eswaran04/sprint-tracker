import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createLru, createRateLimiter } from "@/lib/ai/limits";
import { digestModel, vertexLlm } from "@/lib/ai/vertex";
import { OpError, ops } from "@/lib/db/ops";
import { withUser } from "@/lib/db/session";
import { fallbackDigest, generateDigest } from "@/lib/digest/digest";
import { buildDigestFacts, isQuietWeek } from "@/lib/digest/facts";
import { DigestRequest } from "@/lib/digest/schema";
import { getSessionUser } from "@/lib/firebase/admin";
import type { Group, GroupActivityRow, GroupDigest, GroupMember, GroupProgressRow, Problem, Sprint } from "@/lib/types";

export const runtime = "nodejs";

const TIMEOUT_MS = 8_000;
const limiter = createRateLimiter(10, 60_000);
const cache = createLru<GroupDigest>(300);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const log = (msg: string, e?: unknown) => {
  const name = (e as Error | undefined)?.name;
  if (name !== "TimeoutError" && name !== "AbortError") console.error(`[ai:digest] ${msg}`, e);
};

interface Loaded {
  group: { group: Group; members: GroupMember[] } | null;
  progress: GroupProgressRow[];
  activity: GroupActivityRow[];
  sprint: { sprint: Sprint; problems: Problem[] } | null;
}

/**
 * POST { groupId, today } → { data: GroupDigest }. Facts are computed here from data loaded under RLS; Gemini only
 * rewords them. AI off, rate limit or model failure → the built-in template (`ai: false`).
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
  const parsed = DigestRequest.safeParse(body);
  if (!parsed.success) return fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);
  const { groupId, today } = parsed.data;

  let loaded: Loaded;
  try {
    loaded = (await withUser(user.uid, async (db): Promise<Loaded> => {
      const empty: Loaded = { group: null, progress: [], activity: [], sprint: null };
      const group = (await ops.getGroup.run(db, { id: groupId } as never)) as Loaded["group"];
      const mine = group?.members.find((m) => m.user_id === user.uid);
      if (!group || !mine) return empty;
      const progress = (await ops.groupProgress.run(db, { groupId } as never)) as GroupProgressRow[];
      const activity = (await ops.groupActivity.run(db, { groupId } as never)) as GroupActivityRow[];
      const sprint = (await ops.getSprint.run(db, { id: mine.sprint_id } as never)) as Loaded["sprint"];
      return { group, progress, activity, sprint };
    })) as Loaded;
  } catch (e) {
    if (e instanceof OpError) return fail(e.message, e.status);
    console.error("[ai:digest] load", e);
    return fail("Couldn't load this group", 500);
  }

  const { group, progress, activity, sprint } = loaded;
  if (!group || !group.members.some((m) => m.user_id === user.uid)) return fail("Group not found", 404);
  if (!sprint) return fail("Group not found", 404);

  const stamp = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""));
  const facts = buildDigestFacts({
    groupName: group.group.name,
    me: user.uid,
    members: group.members,
    progress: progress.map((r) => ({ ...r, problem_key: String(r.problem_key), done_at: stamp(r.done_at) })),
    activity: activity.map((a) => ({ ...a, done_at: stamp(a.done_at) })),
    problems: sprint.problems,
    sprint: sprint.sprint,
    today,
  });
  // Empty sheet: nothing to say, the card stays hidden.
  if (!facts) return NextResponse.json({ data: null });
  if (isQuietWeek(facts)) return NextResponse.json({ data: fallbackDigest(facts) });

  const llm = vertexLlm(digestModel(), TIMEOUT_MS);
  // Facts already reflect every solve, so they make the key: a new solve (or a new day) gives a fresh digest.
  const key = createHash("sha256").update(JSON.stringify([user.uid, groupId, today, facts, Boolean(llm)])).digest("hex");
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ data: hit });

  if (!llm || !limiter.take(user.uid)) return NextResponse.json({ data: fallbackDigest(facts) });

  const data = await generateDigest(facts, { llm, log });
  // Only AI digests are cached, so a transient model failure doesn't pin the template.
  if (data.ai) cache.set(key, data);
  return NextResponse.json({ data });
}
