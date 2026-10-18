/**
 * Live accuracy check of the NL → filters prompt against Vertex AI. Not part of CI (needs ADC credentials).
 *   npm run test:ai
 */
import { GoogleGenAI } from "@google/genai";
import { expect, it } from "vitest";
import { NL_QUERIES, SHEET_FACETS } from "@/test/fixtures/nl-queries";
import { buildPrompt, buildResponseSchema, FACET_KEYS, parseModelJson, sanitizeAiFilters, SYSTEM_PROMPT, type AiFilters } from "./nl-filters";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || "global",
});
const model = process.env.AI_FILTERS_MODEL || "gemini-2.5-flash-lite";

const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((v) => b.includes(v));

function matchesExpected(got: AiFilters, want: Partial<AiFilters>) {
  const diffs: string[] = [];
  for (const k of FACET_KEYS) if (!sameSet(got[k], want[k])) diffs.push(`${k}: ${JSON.stringify(got[k])} ≠ ${JSON.stringify(want[k] ?? [])}`);
  if ((got.status ?? "all") !== (want.status ?? "all")) diffs.push(`status: ${got.status} ≠ ${want.status ?? "all"}`);
  if ((got.q ?? "").toLowerCase() !== (want.q ?? "").toLowerCase()) diffs.push(`q: "${got.q}" ≠ "${want.q ?? ""}"`);
  if (want.sort && got.sort !== want.sort) diffs.push(`sort: ${got.sort} ≠ ${want.sort}`);
  if (want.dir && got.dir !== want.dir) diffs.push(`dir: ${got.dir} ≠ ${want.dir}`);
  return diffs;
}

it(`live model matches the golden set (${model})`, { timeout: 120_000 }, async () => {
  let pass = 0;
  for (const { text, expected } of NL_QUERIES) {
    const res = await ai.models.generateContent({
      model,
      contents: buildPrompt(text),
      config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", responseJsonSchema: buildResponseSchema(SHEET_FACETS), temperature: 0 },
    });
    const got = sanitizeAiFilters(parseModelJson(res.text), SHEET_FACETS);
    const diffs = matchesExpected(got, expected);
    if (!diffs.length) pass++;
    console.log(`${diffs.length ? "✗" : "✓"} ${text}${diffs.length ? `\n    ${diffs.join("\n    ")}` : ""}`);
  }
  const pct = Math.round((100 * pass) / NL_QUERIES.length);
  console.log(`\n${model}: ${pass}/${NL_QUERIES.length} exact (${pct}%)`);
  expect(pct).toBeGreaterThanOrEqual(Number(process.env.AI_EVAL_MIN ?? 75));
});
