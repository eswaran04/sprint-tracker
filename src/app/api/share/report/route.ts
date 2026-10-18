import { format } from "date-fns";
import { NextResponse, type NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { z } from "zod";
import { createRateLimiter } from "@/lib/ai/limits";
import { reviewModel, vertexLlm } from "@/lib/ai/vertex";
import { getUserRow, withUser } from "@/lib/db/session";
import { getSessionUser } from "@/lib/firebase/admin";
import { companyReadiness, reportStats, skillProfile } from "@/lib/readiness";
import { ShareReportRequest, type ShareReportResponse } from "@/lib/share/schema";
import { scoutReport } from "@/lib/share/scout";
import { makeSlug } from "@/lib/share/slug";
import type { Problem, Sprint } from "@/lib/types";

export const runtime = "nodejs";

const TIMEOUT_MS = 15_000;
// Each generation may call the model; regenerating a few times while tweaking is fine, spamming is not.
const limiter = createRateLimiter(5, 60_000);

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const log = (msg: string, e?: unknown) => console.warn(`[share:report] ${msg}`, e instanceof Error ? e.message : (e ?? ""));

async function readBody(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: fail("Invalid JSON", 400) };
  }
  const parsed = ShareReportRequest.safeParse(body);
  if (!parsed.success) return { error: fail(`Invalid request: ${z.prettifyError(parsed.error)}`, 400) };
  return { sprintId: parsed.data.sprintId };
}

const RETURNING = "slug, sprint_id, title, readiness, scout, stats, to_json(updated_at) #>> '{}' as updated_at";

/** Insert or refresh the snapshot. Regenerating keeps the existing slug (links already shared keep working). */
async function upsert(db: PoolClient, slug: string, sprint: Sprint, owner: { name: string | null; avatar: string | null }, report: Omit<ShareReportResponse, "slug" | "sprint_id" | "title" | "updated_at">) {
  const { rows } = await db.query<ShareReportResponse>(
    `insert into public.share_reports (slug, sprint_id, title, owner_name, owner_avatar, show_owner, readiness, scout, stats)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
     on conflict (sprint_id) do update set
       title = excluded.title, owner_name = excluded.owner_name, owner_avatar = excluded.owner_avatar,
       show_owner = excluded.show_owner, readiness = excluded.readiness, scout = excluded.scout, stats = excluded.stats
     returning ${RETURNING}`,
    [
      slug, sprint.id, sprint.title, owner.name, owner.avatar, sprint.show_owner,
      JSON.stringify(report.readiness), JSON.stringify(report.scout), JSON.stringify(report.stats),
    ],
  );
  return rows[0];
}

/**
 * POST { sprintId } → { data: ShareReportResponse }. Snapshots weighted company readiness, headline stats and a
 * 2-line scout report (Gemini on Vertex AI, or the built-in template when AI is off or fails).
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);
  const body = await readBody(request);
  if (body.error) return body.error;
  const { sprintId } = body;

  if (!limiter.take(user.uid)) return fail("Too many reports. Try again in a minute.", 429);

  try {
    // RLS: other users' sprints simply aren't visible.
    const loaded = await withUser(user.uid, async (db) => {
      const sprint = (await db.query<Sprint>("select * from public.sprints where id = $1", [sprintId])).rows[0];
      if (!sprint) return null;
      const problems = (await db.query<Problem>("select * from public.problems where sprint_id = $1", [sprintId])).rows;
      const existing = (await db.query<{ slug: string }>("select slug from public.share_reports where sprint_id = $1", [sprintId])).rows[0];
      return { sprint, problems, slug: existing?.slug ?? null };
    });
    if (!loaded) return fail("Sprint not found", 404);
    const { sprint, problems } = loaded;

    // The model runs outside the transaction so a slow call never holds a pooled connection.
    const today = format(new Date(), "yyyy-MM-dd");
    const readiness = companyReadiness(problems);
    const stats = reportStats(problems, sprint, today);
    const scout = await scoutReport(skillProfile(problems), readiness, stats.pct, { llm: vertexLlm(reviewModel(), TIMEOUT_MS), log });

    const row = await getUserRow(user.uid);
    const owner = { name: row?.display_name ?? user.name, avatar: row?.avatar_url ?? user.picture };
    const report = { readiness, scout, stats };

    let slug = loaded.slug ?? makeSlug(sprint.title);
    for (let attempt = 0; ; attempt++) {
      try {
        const data = await withUser(user.uid, (db) => upsert(db, slug, sprint, owner, report));
        return NextResponse.json({ data });
      } catch (e) {
        // A random-suffix collision with another sprint's slug: pick a new one once.
        if ((e as { code?: string }).code === "23505" && attempt === 0) {
          slug = makeSlug(sprint.title);
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    console.error("[share:report]", e);
    return fail("Couldn't create the report", 500);
  }
}

/** DELETE { sprintId }: stop sharing. The link, image and clone link stop working at once. */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);
  const body = await readBody(request);
  if (body.error) return body.error;
  try {
    await withUser(user.uid, (db) => db.query("delete from public.share_reports where sprint_id = $1", [body.sprintId]));
    return NextResponse.json({ data: null });
  } catch (e) {
    console.error("[share:report]", e);
    return fail("Couldn't stop sharing", 500);
  }
}
