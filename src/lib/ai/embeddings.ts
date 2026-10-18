import "server-only";
import { pool } from "@/lib/db/pool";
import type { PublicSheet } from "@/lib/types";
import { contentHash, sheetDocument, toVectorLiteral } from "./sheet-document";
import { embedDimensions, embedModel, vertex } from "./vertex";

export type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const BATCH = 32;
const TIMEOUT_MS = 20_000;

/** Embeds texts in batches; returns one vector per input, in order. */
export async function embedTexts(texts: string[], taskType: EmbedTask): Promise<number[][]> {
  const dims = embedDimensions();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await vertex().models.embedContent({
      model: embedModel(),
      contents: batch,
      config: { taskType, outputDimensionality: dims, autoTruncate: true, abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
    });
    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== batch.length || vectors.some((v) => v.length !== dims)) {
      throw new Error(`Embedding response mismatch: expected ${batch.length}×${dims}`);
    }
    out.push(...vectors);
  }
  return out;
}

export interface EnsureResult {
  embedded: number;
  unchanged: number;
  removed: number;
}

/**
 * Brings `sheet_embeddings` in line with `public_sheets`: embeds sheets that are missing or whose document changed,
 * and drops rows of sheets that are no longer public. `ids` limits the work to specific sheets (e.g. after an edit).
 * Runs as the app role (writes are server-only).
 */
export async function ensureSheetEmbeddings(opts: { ids?: string[] } = {}): Promise<EnsureResult> {
  const db = await pool();
  const ids = opts.ids?.length ? opts.ids : null;
  const model = embedModel();
  const dims = embedDimensions();

  const removed = await db.query(
    `delete from public.sheet_embeddings e
      where ($1::uuid[] is null or e.sprint_id = any($1)) and not public.is_public_sheet(e.sprint_id)`,
    [ids],
  );

  const { rows } = await db.query<PublicSheet & { content_hash: string | null }>(
    `select p.*, e.content_hash from public.public_sheets p
       left join public.sheet_embeddings e on e.sprint_id = p.id
      where $1::uuid[] is null or p.id = any($1)`,
    [ids],
  );
  const stale = rows
    .map((r) => {
      const doc = sheetDocument(r);
      return { id: r.id, doc, hash: contentHash(doc, model, dims), current: r.content_hash };
    })
    .filter((r) => r.hash !== r.current);

  if (stale.length) {
    const vectors = await embedTexts(stale.map((s) => s.doc), "RETRIEVAL_DOCUMENT");
    for (let i = 0; i < stale.length; i++) {
      await db.query(
        `insert into public.sheet_embeddings (sprint_id, content_hash, embedding) values ($1, $2, $3::public.vector)
         on conflict (sprint_id) do update set content_hash = excluded.content_hash, embedding = excluded.embedding, updated_at = now()`,
        [stale[i].id, stale[i].hash, toVectorLiteral(vectors[i])],
      );
    }
  }
  return { embedded: stale.length, unchanged: rows.length - stale.length, removed: removed.rowCount ?? 0 };
}

export const MAX_GOAL_LENGTH = 300;

/** Saves the caller's study goal and its query embedding; an empty goal clears both. */
export async function saveGoal(uid: string, goal: string): Promise<void> {
  const text = goal.trim().slice(0, MAX_GOAL_LENGTH);
  const vector = text ? toVectorLiteral((await embedTexts([text], "RETRIEVAL_QUERY"))[0]) : null;
  await (await pool()).query(
    "update app.users set goal = $2, goal_embedding = $3::public.vector, updated_at = now() where id = $1",
    [uid, text || null, vector],
  );
}

export async function getGoal(uid: string): Promise<string | null> {
  const { rows } = await (await pool()).query<{ goal: string | null }>("select goal from app.users where id = $1", [uid]);
  return rows[0]?.goal ?? null;
}
