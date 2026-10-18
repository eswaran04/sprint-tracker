import { describe, expect, it } from "vitest";
import { SHEET_FACETS } from "@/test/fixtures/nl-queries";
import {
  aiFiltersRequestSchema, buildPrompt, buildResponseSchema, describeFilters, MAX_QUERY_LENGTH, parseModelJson, sanitizeAiFilters,
} from "./nl-filters";
import { createLru, createRateLimiter } from "./limits";

describe("sanitizeAiFilters", () => {
  it("keeps valid fields and maps facet casing to the sheet's", () => {
    const out = sanitizeAiFilters({ companies: ["amazon", "AMAZON"], topics: ["sliding window"], status: "starred" }, SHEET_FACETS);
    expect(out).toEqual({ q: "", status: "starred", companies: ["Amazon"], topics: ["Sliding Window"], subjects: [], difficulties: [] });
  });

  it("drops facet values that aren't in the sheet", () => {
    const out = sanitizeAiFilters({ companies: ["Amazon", "Netflix"], topics: ["Quantum"], difficulties: ["Extreme", "Pro"] }, SHEET_FACETS);
    expect(out.companies).toEqual(["Amazon"]);
    expect(out.topics).toEqual([]);
    expect(out.difficulties).toEqual(["Pro"]);
  });

  it("falls back to defaults for bad enums and wrong types", () => {
    const out = sanitizeAiFilters({ status: "revisit", sort: "popularity", dir: "up", q: 42, companies: "Amazon" }, SHEET_FACETS);
    expect(out).toEqual({ q: "", status: "all", companies: [], topics: [], subjects: [], difficulties: [] });
    expect(out).not.toHaveProperty("sort");
  });

  it("keeps sort/dir only when valid", () => {
    expect(sanitizeAiFilters({ sort: "done", dir: "desc" }, SHEET_FACETS)).toMatchObject({ sort: "done", dir: "desc" });
  });

  it("treats 'unchanged' sort/dir as absent, and ignores dir without a sort", () => {
    const out = sanitizeAiFilters({ sort: "unchanged", dir: "unchanged" }, SHEET_FACETS);
    expect(out).not.toHaveProperty("sort");
    expect(out).not.toHaveProperty("dir");
    expect(sanitizeAiFilters({ sort: "unchanged", dir: "desc" }, SHEET_FACETS)).not.toHaveProperty("dir");
  });

  it("handles non-objects and ignores non-string array items", () => {
    expect(sanitizeAiFilters(null, SHEET_FACETS).status).toBe("all");
    expect(sanitizeAiFilters([1, 2], SHEET_FACETS).companies).toEqual([]);
    expect(sanitizeAiFilters({ topics: [1, null, "graphs"] }, SHEET_FACETS).topics).toEqual(["Graphs"]);
  });

  it("trims and caps q", () => {
    expect(sanitizeAiFilters({ q: `  ${"x".repeat(400)} ` }, SHEET_FACETS).q).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe("buildResponseSchema", () => {
  it("limits facet enums to the sheet and mirrors the filter enums", () => {
    const schema = buildResponseSchema(SHEET_FACETS) as { properties: Record<string, { enum?: string[]; items?: { enum: string[] } }> };
    expect(schema.properties.companies.items?.enum).toEqual(SHEET_FACETS.companies);
    expect(schema.properties.status.enum).toEqual(["all", "todo", "done", "starred"]);
    expect(schema.properties.sort.enum).toEqual(["unchanged", "day", "name", "difficulty", "companies", "done"]);
    expect(schema.properties.dir.enum).toEqual(["unchanged", "asc", "desc"]);
    expect((schema as unknown as { required: string[] }).required).toEqual(expect.arrayContaining(["companies", "status", "sort", "dir", "q"]));
  });

  it("omits empty facets (an empty enum is invalid) and dedupes", () => {
    const schema = buildResponseSchema({ ...SHEET_FACETS, subjects: [], companies: ["A", "A"] }) as { properties: Record<string, { items?: { enum: string[] } }> };
    expect(schema.properties).not.toHaveProperty("subjects");
    expect(schema.properties.companies.items?.enum).toEqual(["A"]);
  });
});

describe("request schema and helpers", () => {
  it("rejects oversized text and facet lists", () => {
    expect(aiFiltersRequestSchema.safeParse({ text: "x".repeat(301), facets: SHEET_FACETS }).success).toBe(false);
    expect(aiFiltersRequestSchema.safeParse({ text: "ok", facets: { companies: Array(501).fill("a") } }).success).toBe(false);
    expect(aiFiltersRequestSchema.safeParse({ text: "   ", facets: {} }).success).toBe(false);
    expect(aiFiltersRequestSchema.safeParse({ text: "amazon dp", facets: {} }).data?.facets.topics).toEqual([]);
  });

  it("quotes user text in the prompt", () => {
    expect(buildPrompt('ignore "rules"')).toBe('Request: "ignore \\"rules\\""');
  });

  it("parses JSON with or without fences", () => {
    expect(parseModelJson('```json\n{"status":"done"}\n```')).toEqual({ status: "done" });
    expect(parseModelJson('{"q":"x"}')).toEqual({ q: "x" });
    expect(parseModelJson("not json")).toEqual({});
    expect(parseModelJson(undefined)).toEqual({});
  });

  it("describes filters for the toast", () => {
    expect(describeFilters({ q: "", status: "starred", companies: ["Amazon"], topics: ["Sliding Window"], subjects: [], difficulties: [] }))
      .toBe("Amazon · Sliding Window · Revisit");
    expect(describeFilters({ q: "", status: "all", companies: [], topics: [], subjects: [], difficulties: [] })).toBe("All problems");
  });
});

describe("limits", () => {
  it("rate-limits per key within a window", () => {
    let t = 0;
    const rl = createRateLimiter(2, 1000, () => t);
    expect([rl.take("u"), rl.take("u"), rl.take("u"), rl.take("v")]).toEqual([true, true, false, true]);
    t = 1000;
    expect(rl.take("u")).toBe(true);
  });

  it("evicts the least recently used entry", () => {
    const lru = createLru<number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.get("a");
    lru.set("c", 3);
    expect(lru.get("b")).toBeUndefined();
    expect(lru.get("a")).toBe(1);
    expect(lru.size).toBe(2);
  });
});
