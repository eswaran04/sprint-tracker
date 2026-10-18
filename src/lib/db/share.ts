import "server-only";
import { cache } from "react";
import { z } from "zod";
import { isSlug } from "@/lib/share/schema";
import type { ShareReport, SharedProblem } from "@/lib/types";
import { pool } from "./pool";

/**
 * Public (signed-out) reads for share links. They run as the app role and only call the column-limited
 * security-definer functions from `20261012000000_share_reports.sql`, so notes, stars and timestamps never leave
 * the database.
 */

const isUuid = (s: string) => z.uuid().safeParse(s).success;

type Row = Omit<ShareReport, "updated_at"> & { updated_at: Date | string };
const toReport = (r: Row | undefined): ShareReport | null =>
  r ? { ...r, updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at } : null;

/** Snapshot by slug, or null. Cached per request so `generateMetadata` and the page share one query. */
export const getShareReport = cache(async (slug: string): Promise<ShareReport | null> => {
  if (!isSlug(slug)) return null;
  const { rows } = await (await pool()).query<Row>("select * from public.share_report($1)", [slug]);
  return toReport(rows[0]);
});

/** Snapshot for a sprint (the OG image), or null when the owner hasn't generated a report. */
export async function getShareReportForSprint(sprintId: string): Promise<ShareReport | null> {
  if (!isUuid(sprintId)) return null;
  const { rows } = await (await pool()).query<Row>("select * from public.share_report_for_sprint($1)", [sprintId]);
  return toReport(rows[0]);
}

/** Read-only roadmap of a shared sprint (empty for unknown slugs). */
export async function getSharedRoadmap(slug: string): Promise<SharedProblem[]> {
  if (!isSlug(slug)) return [];
  const { rows } = await (await pool()).query<SharedProblem>("select * from public.shared_roadmap($1)", [slug]);
  return rows;
}
