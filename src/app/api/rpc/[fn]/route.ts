import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/admin";
import { ensureSheetEmbeddings } from "@/lib/ai/embeddings";
import { isAiEnabled } from "@/lib/ai/vertex";
import { isOp, OpError, ops, type OpName } from "@/lib/db/ops";
import { withUser } from "@/lib/db/session";

export const runtime = "nodejs";

// Sprint fields that feed the sheet's embedding document or its public visibility.
const EMBEDDED_FIELDS = ["visibility", "title", "description"];

/** The sheet whose embedding may be stale after this op (new sprints start private, so createSprint needs nothing). */
function sheetToReembed(fn: OpName, args: unknown): string | null {
  if (fn !== "updateSprint") return null;
  const { id, patch } = args as { id: string; patch: Record<string, unknown> };
  return EMBEDDED_FIELDS.some((f) => f in patch) ? id : null;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest, ctx: RouteContext<"/api/rpc/[fn]">) {
  const { fn } = await ctx.params;
  if (!isOp(fn)) return fail("Unknown operation", 404);

  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const op = ops[fn];
  const parsed = op.args.safeParse(body ?? {});
  if (!parsed.success) return fail(`Invalid arguments: ${z.prettifyError(parsed.error)}`, 400);

  try {
    const data = await withUser(user.uid, (db) => op.run(db, parsed.data as never));
    const reembed = sheetToReembed(fn, parsed.data);
    if (reembed && isAiEnabled()) {
      // After the response: re-embed (or drop) this sheet's vector. Unchanged content is skipped by hash.
      after(() => ensureSheetEmbeddings({ ids: [reembed] }).catch((e) => console.error("[embeddings]", e)));
    }
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof OpError) return fail(e.message, e.status);
    const pgCode = (e as { code?: string }).code;
    // P0001 = raise exception in our SQL functions: messages are written for users.
    if (pgCode === "P0001") return fail((e as Error).message, 400);
    if (pgCode === "42501") return fail("Not allowed", 403);
    if (pgCode === "23505") return fail("Already exists", 409);
    console.error(`[rpc:${fn}]`, e);
    return fail("Something went wrong", 500);
  }
}
