import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHEET_FACETS } from "@/test/fixtures/nl-queries";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => session);
const genai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: genai.generateContent };
  },
}));

import { POST } from "./route";

let n = 0;
/** Unique text per call so the route's cache never leaks between tests. */
const uniq = (text: string) => `${text} #${++n}`;
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/ai/filters", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  session.getSessionUser.mockResolvedValue({ uid: `u${n}`, email: "a@b.c", name: null, picture: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/filters", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    const res = await post({ text: "amazon dp", facets: SHEET_FACETS });
    expect(res.status).toBe(401);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("503 when AI is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    expect((await post({ text: "amazon dp", facets: SHEET_FACETS })).status).toBe(503);
  });

  it("400 for oversized text or bad JSON", async () => {
    expect((await post({ text: "x".repeat(301), facets: SHEET_FACETS })).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("returns sanitized filters and sends only facet names with a constrained schema", async () => {
    genai.generateContent.mockResolvedValue({
      text: JSON.stringify({ companies: ["amazon", "Netflix"], topics: ["Sliding Window"], status: "starred", sort: "bogus" }),
    });
    const text = uniq("Amazon sliding window I starred");
    const res = await post({ text, facets: SHEET_FACETS });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { q: "", status: "starred", companies: ["Amazon"], topics: ["Sliding Window"], subjects: [], difficulties: [] },
    });
    const req = genai.generateContent.mock.calls[0][0];
    expect(req.contents).toContain(text);
    expect(req.config).toMatchObject({ responseMimeType: "application/json", temperature: 0 });
    expect(req.config.responseJsonSchema.properties.companies.items.enum).toEqual(SHEET_FACETS.companies);
  });

  it("serves repeated queries from cache", async () => {
    genai.generateContent.mockResolvedValue({ text: '{"status":"done"}' });
    const text = uniq("what did I finish");
    await post({ text, facets: SHEET_FACETS });
    const res = await post({ text: `  ${text.toUpperCase()} `, facets: SHEET_FACETS });
    expect((await res.json()).data.status).toBe("done");
    expect(genai.generateContent).toHaveBeenCalledTimes(1);
  });

  it("429 after 20 model calls per minute for one user", async () => {
    session.getSessionUser.mockResolvedValue({ uid: "rate-limited", email: "", name: null, picture: null });
    genai.generateContent.mockResolvedValue({ text: "{}" });
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await post({ text: uniq("q"), facets: SHEET_FACETS })).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it("502 when the model call fails, 504 on timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    genai.generateContent.mockRejectedValueOnce(new Error("boom"));
    expect((await post({ text: uniq("x"), facets: SHEET_FACETS })).status).toBe(502);
    genai.generateContent.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect((await post({ text: uniq("x"), facets: SHEET_FACETS })).status).toBe(504);
  });
});
