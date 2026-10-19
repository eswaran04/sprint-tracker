import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import type { Problem } from "@/lib/types";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => session);
const genai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: genai.generateContent };
  },
}));
const db = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("@/lib/db/session", () => ({
  withUser: vi.fn(async () => {
    if (db.data instanceof Error) throw db.data;
    return db.data;
  }),
}));

import { OpError } from "@/lib/db/ops";
import { POST } from "./route";

const SPRINT_ID = "3f0f6f4e-8a52-4c3e-9a51-0c1d3c9b2a10";
const TODAY = "2026-10-05"; // start 2026-10-01 → plan day 5

let n = 0;
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/ai/coach", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

function sheet(): Problem[] {
  const dp = (day_no: number) => mkProblem({ day_no, difficulty: "Core", topics: ["Dynamic Programming"], notes: "secret note: struggled" });
  return [
    mkProblem({ name: "Top Secret Name", day_no: 1, difficulty: "Pro", done_at: new Date(2026, 9, 3, 12).toISOString() }),
    mkProblem({ day_no: 2, difficulty: "Pro" }),
    mkProblem({ day_no: 3, difficulty: "Pro" }),
    mkProblem({ day_no: 4, difficulty: "Basic" }),
    dp(6), dp(6), dp(7), dp(7),
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  session.getSessionUser.mockResolvedValue({ uid: `u${++n}`, email: "a@b.c", name: null, picture: null });
  // Unique updated_at per test so the route's cache never leaks between tests.
  db.data = { sprint: mkSprint({ id: SPRINT_ID, start_date: "2026-10-01", updated_at: `t${n}` }), problems: sheet() };
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/coach", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await post({ sprintId: SPRINT_ID, today: TODAY })).status).toBe(401);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("400 for bad JSON, bad ids, bad dates and extra fields", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ sprintId: "nope", today: TODAY })).status).toBe(400);
    expect((await post({ sprintId: SPRINT_ID, today: "yesterday" })).status).toBe(400);
    expect((await post({ sprintId: SPRINT_ID, today: TODAY, problems: [] })).status).toBe(400);
  });

  it("404 when the sprint isn't visible to the user; 400 without a start date", async () => {
    db.data = new OpError("Sprint not found", 404);
    expect((await post({ sprintId: SPRINT_ID, today: TODAY })).status).toBe(404);
    db.data = { sprint: mkSprint({ id: SPRINT_ID, start_date: null }), problems: sheet() };
    expect((await post({ sprintId: SPRINT_ID, today: TODAY })).status).toBe(400);
  });

  it("falls back to the rule-based plan when AI is off", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const res = await post({ sprintId: SPRINT_ID, today: TODAY });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.aiUsed).toBe(false);
    expect(data.changes.length).toBeGreaterThan(0);
    expect(data.summary.label).toMatch(/problems? moves?/);
    expect(data.rationale.length).toBeGreaterThan(0);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("sanitizes a bad model response and sends only summary signals", async () => {
    genai.generateContent.mockResolvedValue({
      text: JSON.stringify({ dailyCapacity: 999, maxProPerDay: "two", reviewBefore: ["Dynamic Programming", "Made Up"], frontLoadFlagged: 1, rationale: ["x".repeat(500), 5] }),
    });
    const res = await post({ sprintId: SPRINT_ID, today: TODAY });
    const { data } = await res.json();
    expect(data.aiUsed).toBe(true);
    expect(data.strategy.dailyCapacity).toBe(20);
    expect(data.strategy.reviewBefore).toEqual(["Dynamic Programming"]);
    expect(Number.isInteger(data.strategy.maxProPerDay)).toBe(true);
    expect(data.rationale).toEqual(["x".repeat(140)]);

    const req = genai.generateContent.mock.calls[0][0];
    expect(req.config).toMatchObject({ responseMimeType: "application/json", temperature: 0.2 });
    expect(req.config.responseJsonSchema.properties.reviewBefore.items.enum).toEqual(["Dynamic Programming"]);
    expect(req.contents).not.toMatch(/secret|Top Secret Name/i);
  });

  it("returns the rule-based plan (not an error) when the model fails or times out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    genai.generateContent.mockRejectedValueOnce(new Error("boom"));
    const a = await post({ sprintId: SPRINT_ID, today: TODAY });
    expect(a.status).toBe(200);
    expect((await a.json()).data.aiUsed).toBe(false);

    genai.generateContent.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    const b = await post({ sprintId: SPRINT_ID, today: TODAY });
    expect(b.status).toBe(200);
    expect((await b.json()).data.aiUsed).toBe(false);
  });

  it("caches AI plans and rate-limits model calls to 5 a minute per user", async () => {
    session.getSessionUser.mockResolvedValue({ uid: "rate-limited", email: "", name: null, picture: null });
    genai.generateContent.mockResolvedValue({ text: '{"dailyCapacity":4,"maxProPerDay":1,"reviewBefore":[],"frontLoadFlagged":false,"rationale":["ok"]}' });

    await post({ sprintId: SPRINT_ID, today: TODAY });
    await post({ sprintId: SPRINT_ID, today: TODAY });
    expect(genai.generateContent).toHaveBeenCalledTimes(1);

    const used: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      db.data = { sprint: mkSprint({ id: SPRINT_ID, start_date: "2026-10-01", updated_at: `rl${i}` }), problems: sheet() };
      used.push((await (await post({ sprintId: SPRINT_ID, today: TODAY })).json()).data.aiUsed);
    }
    expect(used).toEqual([true, true, true, true, false]);
    expect(genai.generateContent).toHaveBeenCalledTimes(5);
  });
});
