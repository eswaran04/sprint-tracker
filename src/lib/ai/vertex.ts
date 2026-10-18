import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import { parseModelJson } from "./nl-filters";

/**
 * Vertex AI access through Application Default Credentials: the App Hosting runtime service account in production,
 * `gcloud auth application-default login` locally. No API keys.
 */

let client: GoogleGenAI | null = null;
let clientKey: string | null = null;

/** False when AI_ENABLED=false (CI, offline dev) or neither project nor API key is configured. */
export function isAiEnabled() {
  if (process.env.AI_ENABLED === "false") return false;
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY
  );
}

export function vertex(): GoogleGenAI {
  if (!isAiEnabled()) throw new Error("Vertex AI is disabled");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const currentKey = apiKey ? `key:${apiKey}` : `proj:${project}:${location}`;

  if (!client || clientKey !== currentKey) {
    client = apiKey
      ? new GoogleGenAI({ apiKey })
      : new GoogleGenAI({ vertexai: true, project, location });
    clientKey = currentKey;
  }
  return client;
}

export const filtersModel = () => process.env.AI_FILTERS_MODEL || "gemini-2.5-flash-lite";
/** "Analyze note" and "Describe your goal" (longer, reasoning-heavier prompts than filters). */
export const reviewModel = () => process.env.AI_REVIEW_MODEL || "gemini-2.5-flash-lite";
export const generateModel = () => process.env.AI_GENERATE_MODEL || "gemini-2.5-flash-lite";

/** Recursively drops keys Vertex rejects or can't compile in a response schema. */
function stripKeys(node: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(node)) return node.map((n) => stripKeys(n, keys));
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node).filter(([k]) => !keys.has(k)).map(([k, v]) => [k, stripKeys(v, keys)]),
  );
}

/**
 * JSON Schema for `responseJsonSchema`. Vertex rejects the `$schema` key, and nested `maxItems`/`minItems`
 * (e.g. sprints × days × ids in `PlanSchema`) make constrained decoding too large ("400 INVALID_ARGUMENT").
 * The Zod schema still enforces those limits on the output in `vertexJson`.
 */
export function jsonSchemaOf(schema: z.ZodType) {
  return stripKeys(z.toJSONSchema(schema), new Set(["$schema", "maxItems", "minItems"])) as Record<string, unknown>;
}

export interface VertexJsonOptions<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  model: string;
  timeoutMs: number;
  maxOutputTokens?: number;
}

/**
 * Structured Gemini call on Vertex AI: constrained JSON output, validated with the Zod schema. Throws on timeout,
 * model errors or invalid output, so callers (`reviewNote`, `generateSprintPlan`) fall back to their heuristics.
 */
export async function vertexJson<T>({ system, user, schema, model, timeoutMs, maxOutputTokens = 4096 }: VertexJsonOptions<T>): Promise<T> {
  const res = await vertex().models.generateContent({
    model,
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaOf(schema),
      temperature: 0.2,
      maxOutputTokens,
      httpOptions: { timeout: timeoutMs },
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });
  const parsed = schema.safeParse(parseModelJson(res.text));
  if (!parsed.success) throw new Error(`Model output failed validation: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

/** Bound `llm` dependency for `reviewNote` / `generateSprintPlan`, or null when AI is off (they use heuristics). */
export function vertexLlm(model: string, timeoutMs: number) {
  if (!isAiEnabled()) return null;
  return <T>(o: { system: string; user: string; schema: ZodType<T> }) => vertexJson({ ...o, model, timeoutMs });
}
export const embedModel = () => process.env.AI_EMBED_MODEL || "gemini-embedding-001";
export const embedDimensions = () => Number(process.env.AI_EMBED_DIMENSIONS) || 768;
