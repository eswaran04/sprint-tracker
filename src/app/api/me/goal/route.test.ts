import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => session);
const emb = vi.hoisted(() => ({ saveGoal: vi.fn(), getGoal: vi.fn(), MAX_GOAL_LENGTH: 300 }));
vi.mock("@/lib/ai/embeddings", () => emb);

import { GET, PUT } from "./route";

let n = 0;
const put = (body: unknown) =>
  PUT(new NextRequest("http://localhost/api/me/goal", { method: "PUT", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  session.getSessionUser.mockResolvedValue({ uid: `u${++n}`, email: "a@b.c", name: null, picture: null });
  emb.saveGoal.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/me/goal", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await put({ goal: "x" })).status).toBe(401);
  });

  it("GET returns the goal and whether AI is enabled", async () => {
    emb.getGoal.mockResolvedValue("DP");
    expect(await (await GET()).json()).toEqual({ data: { goal: "DP", enabled: true } });
    vi.stubEnv("AI_ENABLED", "false");
    expect(await (await GET()).json()).toEqual({ data: { goal: "DP", enabled: false } });
  });

  it("PUT saves a trimmed goal", async () => {
    const res = await put({ goal: "  FAANG in 8 weeks " });
    expect(res.status).toBe(200);
    expect(emb.saveGoal).toHaveBeenCalledWith(expect.stringMatching(/^u\d+$/), "FAANG in 8 weeks");
  });

  it("400 for oversized or extra fields; 503 when AI is off (clearing still works)", async () => {
    expect((await put({ goal: "x".repeat(301) })).status).toBe(400);
    expect((await put({ goal: "x", embedding: [1] })).status).toBe(400);
    vi.stubEnv("AI_ENABLED", "false");
    expect((await put({ goal: "x" })).status).toBe(503);
    expect((await put({ goal: "" })).status).toBe(200);
  });

  it("429 after 10 updates a minute; 502 when embedding fails", async () => {
    for (let i = 0; i < 10; i++) expect((await put({ goal: `g${i}` })).status).toBe(200);
    expect((await put({ goal: "again" })).status).toBe(429);
    session.getSessionUser.mockResolvedValue({ uid: "other", email: "", name: null, picture: null });
    emb.saveGoal.mockRejectedValueOnce(new Error("vertex down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await put({ goal: "x" })).status).toBe(502);
  });
});
