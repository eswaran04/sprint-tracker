import { z } from "zod";
import { DEFAULT_FILTERS, filtersSchema, SORTS, STATUSES, type Filters } from "@/lib/filters";

/**
 * Pure helpers for turning a typed sentence into `Filters` with Gemini.
 * Safe to import on the client (no SDK, no secrets): the route uses the prompt/schema, the UI uses `describeFilters`.
 */

export const MAX_QUERY_LENGTH = 300;
export const MAX_FACET_VALUES = 500;

const facetList = z.array(z.string().max(200)).max(MAX_FACET_VALUES).default([]);

/** Facet names of the current sheet. Only names are sent to the model, never problem rows or progress. */
export const facetNamesSchema = z.object({
  companies: facetList,
  topics: facetList,
  subjects: facetList,
  difficulties: facetList,
});
export type FacetNames = z.infer<typeof facetNamesSchema>;

export const aiFiltersRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  facets: facetNamesSchema,
});

export const FACET_KEYS = ["companies", "topics", "subjects", "difficulties"] as const;

/** What the model may set. `sort`/`dir` are optional so the caller can keep the user's current ordering. */
export type AiFilters = Omit<Filters, "sort" | "dir"> & Partial<Pick<Filters, "sort" | "dir">>;

/** Sentinel the model returns for sort/dir when no ordering was asked for; the client keeps the user's current one. */
export const UNCHANGED = "unchanged";

const FACET_HINTS: Record<(typeof FACET_KEYS)[number], string> = {
  companies: "Companies explicitly named in the request. Empty if none named.",
  topics: "Topics explicitly named in the request (match synonyms like DP, BFS/DFS → Graphs). Empty if none named. Never list every topic.",
  subjects: "Subjects explicitly named (e.g. SQL). Empty if none named.",
  difficulties: "easy → Basic, medium → Core, hard → Pro. Empty if no difficulty word is used.",
};

/**
 * JSON Schema (for `responseJsonSchema`) mirroring `filtersSchema`, with facet enums limited to this sheet.
 * Every field is required: flash-lite models tend to skip optional fields, so "nothing" is an explicit [] / "unchanged".
 */
export function buildResponseSchema(facets: FacetNames) {
  const properties: Record<string, unknown> = {};
  for (const key of FACET_KEYS) {
    const values = [...new Set(facets[key])];
    // An empty enum is an invalid schema; leave the facet out so the model can't fill it.
    if (values.length) properties[key] = { type: "array", description: FACET_HINTS[key], items: { type: "string", enum: values } };
  }
  Object.assign(properties, {
    status: {
      type: "string",
      enum: [...STATUSES],
      description: "starred = Revisit list / starred / bookmarked; todo = not done, unsolved, haven't done; done = solved, completed, finished; all = otherwise.",
    },
    sort: {
      type: "string",
      enum: [UNCHANGED, ...SORTS],
      description: "unchanged unless an order is requested. companies = most asked / popular; difficulty = hardest/easiest first; done = recently finished; name = alphabetical; day = plan order.",
    },
    dir: { type: "string", enum: [UNCHANGED, "asc", "desc"], description: "desc for most/hardest/recent/latest first, asc for least/easiest/oldest first, unchanged when sort is unchanged." },
    q: { type: "string", description: "Only words that match no allowed value, such as a problem name. Usually empty." },
  });
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false, propertyOrdering: Object.keys(properties) };
}

export const SYSTEM_PROMPT = `You convert a student's request about their coding-interview problem sheet into JSON filters.

Fields:
- companies, topics, subjects, difficulties: pick only from the allowed values in the schema. Match synonyms and abbreviations (e.g. "DP" -> "Dynamic Programming", "FB" -> "Meta" if present). Leave empty if not mentioned.
- difficulties: "Basic" = easy, "Core" = medium, "Pro" = hard, "None" = no difficulty set.
- status: "starred" = the Revisit list (problems they starred / bookmarked / marked to revisit), "todo" = not done yet / unsolved / pending, "done" = completed / solved, "all" = no status constraint.
- sort: "unchanged" unless an order is requested. "companies" = most asked / popular, "difficulty" = hardest or easiest first, "done" = by completion date, "name" = alphabetical, "day" = plan order. dir: "desc" for most / hardest / most recent first, "asc" for least / easiest / oldest first, "unchanged" when sort is unchanged.
- Every field is required. Use [] for facets that are not mentioned; never fill a facet with all its values.
- q: only for words that match none of the allowed values (e.g. a specific problem name). Never repeat a value already used in another field.

Examples (the topic/company names are illustrations; use the schema's allowed values):
"Amazon sliding window I starred but haven't redone" -> {"companies":["Amazon"],"topics":["Sliding Window"],"subjects":[],"difficulties":[],"status":"starred","sort":"unchanged","dir":"unchanged","q":""}
"hard DP problems I haven't solved" -> {"companies":[],"topics":["Dynamic Programming"],"subjects":[],"difficulties":["Pro"],"status":"todo","sort":"unchanged","dir":"unchanged","q":""}
"easy google array questions" -> {"companies":["Google"],"topics":["Arrays"],"subjects":[],"difficulties":["Basic"],"status":"all","sort":"unchanged","dir":"unchanged","q":""}
"what did I finish most recently" -> {"companies":[],"topics":[],"subjects":[],"difficulties":[],"status":"done","sort":"done","dir":"desc","q":""}
"most asked graph problems" -> {"companies":[],"topics":["Graphs"],"subjects":[],"difficulties":[],"status":"all","sort":"companies","dir":"desc","q":""}
"medium stack questions, hardest first" -> {"companies":[],"topics":["Stack"],"subjects":[],"difficulties":["Core"],"status":"all","sort":"difficulty","dir":"desc","q":""}
"two sum" -> {"companies":[],"topics":[],"subjects":[],"difficulties":[],"status":"all","sort":"unchanged","dir":"unchanged","q":"two sum"}

Return only the JSON object.`;

export function buildPrompt(text: string) {
  return `Request: ${JSON.stringify(text.slice(0, MAX_QUERY_LENGTH))}`;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Keeps only values that exist in `allowed`, mapped to their real casing, de-duplicated. */
function keepKnown(values: unknown, allowed: string[]): string[] {
  if (!Array.isArray(values)) return [];
  const byNorm = new Map(allowed.map((v) => [norm(v), v]));
  const out = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const hit = byNorm.get(norm(v));
    if (hit) out.add(hit);
  }
  return [...out];
}

/**
 * The guarantee that the model can only produce a valid query: every field is checked against `filtersSchema`
 * and the sheet's facets; anything unknown is dropped and falls back to `DEFAULT_FILTERS`.
 */
export function sanitizeAiFilters(raw: unknown, facets: FacetNames): AiFilters {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const field = <K extends keyof Filters>(key: K): Filters[K] | undefined => {
    const r = filtersSchema.shape[key].safeParse(obj[key]);
    return r.success && obj[key] !== undefined ? (r.data as Filters[K]) : undefined;
  };

  const out: AiFilters = {
    q: (field("q") ?? DEFAULT_FILTERS.q).trim().slice(0, MAX_QUERY_LENGTH),
    status: field("status") ?? DEFAULT_FILTERS.status,
    companies: keepKnown(obj.companies, facets.companies),
    topics: keepKnown(obj.topics, facets.topics),
    subjects: keepKnown(obj.subjects, facets.subjects),
    difficulties: keepKnown(obj.difficulties, facets.difficulties),
  };
  const sort = obj.sort === UNCHANGED ? undefined : field("sort");
  const dir = obj.dir === UNCHANGED || !sort ? undefined : field("dir");
  if (sort) out.sort = sort;
  if (dir) out.dir = dir;
  return out;
}

/** Parses the model's text response; tolerates ```json fences. */
export function parseModelJson(text: string | undefined): unknown {
  if (!text) return {};
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

const STATUS_LABELS: Record<Filters["status"], string> = { all: "", todo: "To do", done: "Done", starred: "Revisit" };

/** "Amazon · Sliding Window · Revisit" for the confirmation toast. */
export function describeFilters(f: AiFilters): string {
  const parts = [...f.companies, ...f.topics, ...f.subjects, ...f.difficulties, STATUS_LABELS[f.status], f.q && `“${f.q}”`];
  if (f.sort) parts.push(`sorted by ${f.sort}${f.dir === "desc" ? " ↓" : ""}`);
  return parts.filter(Boolean).join(" · ") || "All problems";
}
