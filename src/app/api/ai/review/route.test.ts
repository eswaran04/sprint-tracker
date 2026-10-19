import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Review, ReviewProblem } from "@/lib/review/schema";

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

const problem: ReviewProblem = { name: "Binary Search", url: "", difficulty: "Basic", subject: "dsa", topics: ["Arrays"] };
const aiReview: Review = {
  summary: "Looks right.",
  complexity: { time: "O(log n)", space: "O(1)", optimal_time: "O(log n)", optimal_space: "O(1)", verdict: "optimal", explanation: "Halves each step." },
  edge_cases: [],
  suggested_tags: ["Binary Search"],
};

let n = 0;
/** Unique notes per call so the route's cache never leaks between tests. */
const uniq = (text: string) => `${text}\n// ${++n}`;
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/ai/review", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  session.getSessionUser.mockResolvedValue({ uid: `u${n}`, email: "a@b.c", name: null, picture: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/review", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await post({ problem, notes: "while (l <= r) {}" })).status).toBe(401);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("400 for empty, oversized or malformed requests", async () => {
    expect((await post({ problem, notes: "   " })).status).toBe(400);
    expect((await post({ problem, notes: "x".repeat(50_001) })).status).toBe(400);
    expect((await post({ notes: "x" })).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("returns the Vertex review with a JSON-constrained request", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiReview) });
    const res = await post({ problem, notes: uniq("int mid = (l + r) / 2;") });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.ai).toBe(true);
    expect(data.review.summary).toBe("Looks right.");
    const req = genai.generateContent.mock.calls[0][0];
    expect(req.contents).toContain("Binary Search");
    expect(req.config).toMatchObject({ responseMimeType: "application/json" });
    expect(req.config.responseJsonSchema.properties.complexity).toBeDefined();
    expect(req.config.responseJsonSchema.$schema).toBeUndefined();
  });

  it("falls back to the built-in analyzer when AI is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const res = await post({ problem, notes: uniq("int mid = (l + r) / 2;") });
    expect(res.status).toBe(200);
    expect((await res.json()).data.ai).toBe(false);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("falls back when the model fails or returns invalid output", async () => {
    genai.generateContent.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ text: '{"summary":1}' });
    for (let i = 0; i < 2; i++) {
      const res = await post({ problem, notes: uniq("for (int i = 0; i <= n; i++) {}") });
      expect(res.status).toBe(200);
      expect((await res.json()).data.ai).toBe(false);
    }
  });

  it("serves repeated AI reviews from cache", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiReview) });
    const notes = uniq("cached");
    await post({ problem, notes });
    const res = await post({ problem, notes });
    expect((await res.json()).data.ai).toBe(true);
    expect(genai.generateContent).toHaveBeenCalledTimes(1);
  });

  it("429 after 10 model calls per minute for one user", async () => {
    session.getSessionUser.mockResolvedValue({ uid: "rate-limited", email: "", name: null, picture: null });
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiReview) });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await post({ problem, notes: uniq("q") })).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
