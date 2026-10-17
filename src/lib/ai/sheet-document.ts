import { createHash } from "node:crypto";
import type { PublicSheet } from "@/lib/types";

/** Fields of a public sheet that describe what it's *about* (counts like copies don't change meaning). */
export type SheetDocInput = Pick<PublicSheet, "title" | "description" | "topics" | "company_counts"> &
  Partial<Pick<PublicSheet, "problem_count" | "day_count" | "basic_count" | "core_count" | "pro_count">>;

const MAX_DESCRIPTION = 2000;
const TOP_TOPICS = 15;
const TOP_COMPANIES = 10;

/**
 * One deterministic text block per sheet, used as the RETRIEVAL_DOCUMENT input. Ordering is fixed (topics keep the
 * view's frequency order; companies sort by count desc, then name) so the same sheet always hashes the same.
 */
export function sheetDocument(sheet: SheetDocInput): string {
  const companies = Object.entries(sheet.company_counts ?? {})
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, TOP_COMPANIES)
    .map(([c, n]) => `${c} (${n})`);
  const lines = [
    `Title: ${sheet.title.trim()}`,
    sheet.description.trim() && `Description: ${sheet.description.trim().slice(0, MAX_DESCRIPTION)}`,
    sheet.topics.length > 0 && `Topics: ${sheet.topics.slice(0, TOP_TOPICS).join(", ")}`,
    companies.length > 0 && `Companies: ${companies.join(", ")}`,
    sheet.problem_count != null && `Size: ${sheet.problem_count} problems over ${sheet.day_count ?? 0} days`,
    sheet.basic_count != null &&
      `Difficulty: ${sheet.basic_count} basic, ${sheet.core_count ?? 0} core, ${sheet.pro_count ?? 0} pro`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Changes whenever the document, the model or the dimensions change, which is when an embedding goes stale. */
export function contentHash(doc: string, model: string, dims: number): string {
  return createHash("sha256").update(`${model}\n${dims}\n${doc}`).digest("hex");
}

/** pgvector text literal: `[0.1,0.2,…]`. */
export const toVectorLiteral = (values: number[]) => `[${values.join(",")}]`;
