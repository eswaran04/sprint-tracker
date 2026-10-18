import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";

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

import { POST } from "./route";

const GROUP_ID = "3f0f6f4e-8a52-4c3e-9a51-0c1d3c9b2a10";
const TODAY = "2026-10-08";
const recent = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let n = 0;
let uid = "";
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/ai/digest", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

const member = (user_id: string, display_name: string) => ({
  group_id: GROUP_ID, user_id, sprint_id: `s-${user_id}`, display_name, avatar: null, role: "member", joined_at: "",
});

function loaded(me: string) {
  return {
    group: { group: { id: GROUP_ID, name: "Prep squad" }, members: [member(me, "Prathis"), member("e", "Eswaran")] },
    progress: [
      { user_id: "e", problem_key: "a", done_at: recent(30) },
      { user_id: "e", problem_key: "b", done_at: recent(2) },
    ],
    activity: [{ user_id: "e", problem_name: "Two Sum", done_at: recent(30) }, { user_id: "e", problem_name: "3 Sum", done_at: recent(2) }],
    sprint: {
      sprint: mkSprint({ start_date: "2026-10-01" }),
      problems: [
        mkProblem({ id: "a", name: "Two Sum", day_no: 1, notes: "secret note" }),
        mkProblem({ id: "b", name: "3 Sum", day_no: 2 }),
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => {});
  uid = `u${++n}`;
  session.getSessionUser.mockResolvedValue({ uid, email: "a@b.c", name: null, picture: null });
  db.data = loaded(uid);
});
afterEach(() => vi.unstubAllEnvs());

const aiText = JSON.stringify({ headline: "Eswaran cleared Sprint 1!", lines: ["Big week for Eswaran.", "Ask him about 3 Sum."] });

describe("POST /api/ai/digest", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await post({ groupId: GROUP_ID, today: TODAY })).status).toBe(401);
  });

  it("400 for bad JSON, ids, dates and extra fields", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ groupId: "nope", today: TODAY })).status).toBe(400);
    expect((await post({ groupId: GROUP_ID, today: "today" })).status).toBe(400);
    expect((await post({ groupId: GROUP_ID, today: TODAY, facts: {} })).status).toBe(400);
  });

  it("404 when not a member", async () => {
    db.data = { group: null, progress: [], activity: [], sprint: null };
    expect((await post({ groupId: GROUP_ID, today: TODAY })).status).toBe(404);
    db.data = { ...loaded("someone-else") };
    expect((await post({ groupId: GROUP_ID, today: TODAY })).status).toBe(404);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("uses the template when AI is off", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const { data } = await (await post({ groupId: GROUP_ID, today: TODAY })).json();
    expect(data.ai).toBe(false);
    expect(data.headline).toBe("Eswaran cleared Sprint 1!");
    expect(data.pairUp.map((p: { problem: { name: string } }) => p.problem.name)).toEqual(["Two Sum", "3 Sum"]);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("asks Gemini with facts only, keeps pair-ups from the facts and caches", async () => {
    genai.generateContent.mockResolvedValue({ text: aiText });
    const { data } = await (await post({ groupId: GROUP_ID, today: TODAY })).json();
    expect(data).toMatchObject({ ai: true, headline: "Eswaran cleared Sprint 1!", weekSolves: 2 });
    expect(data.pairUp).toHaveLength(2);
    const req = genai.generateContent.mock.calls[0][0];
    expect(req.contents).toContain("Eswaran");
    expect(req.contents).not.toMatch(/secret note/);

    await post({ groupId: GROUP_ID, today: TODAY });
    expect(genai.generateContent).toHaveBeenCalledTimes(1);
  });

  it("falls back to the template on invalid output or model errors, without caching", async () => {
    genai.generateContent.mockResolvedValueOnce({ text: JSON.stringify({ headline: "x".repeat(200), lines: [] }) });
    expect((await (await post({ groupId: GROUP_ID, today: TODAY })).json()).data.ai).toBe(false);
    genai.generateContent.mockRejectedValueOnce(new Error("boom"));
    expect((await (await post({ groupId: GROUP_ID, today: TODAY })).json()).data.ai).toBe(false);
    genai.generateContent.mockResolvedValueOnce({ text: aiText });
    expect((await (await post({ groupId: GROUP_ID, today: TODAY })).json()).data.ai).toBe(true);
  });

  it("skips the model for quiet weeks", async () => {
    db.data = { ...loaded(uid), progress: [], activity: [], sprint: { ...loaded(uid).sprint, sprint: mkSprint({ start_date: null }) } };
    const { data } = await (await post({ groupId: GROUP_ID, today: TODAY })).json();
    expect(data).toMatchObject({ ai: false, headline: "A quiet week in Prep squad" });
    expect(genai.generateContent).not.toHaveBeenCalled();
  });
});
