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

/** In-memory stand-in for the DB: one sprint the caller owns, plus the share_reports row once written. */
const db = vi.hoisted(() => ({
  sprint: null as unknown,
  problems: [] as unknown[],
  report: null as null | Record<string, unknown>,
  inserts: [] as unknown[][],
  collideOnce: false,
}));
vi.mock("@/lib/db/session", () => ({
  getUserRow: vi.fn(async () => ({ display_name: "Ada", avatar_url: null, accent: null })),
  withUser: vi.fn(async (_uid: string, fn: (c: unknown) => unknown) =>
    fn({
      query: async (sql: string, params: unknown[]) => {
        if (sql.includes("from public.sprints")) return { rows: db.sprint ? [db.sprint] : [] };
        if (sql.includes("from public.problems")) return { rows: db.problems };
        if (sql.startsWith("select slug from public.share_reports")) return { rows: db.report ? [{ slug: db.report.slug }] : [] };
        if (sql.includes("insert into public.share_reports")) {
          db.inserts.push(params);
          if (db.collideOnce) {
            db.collideOnce = false;
            throw Object.assign(new Error("duplicate key"), { code: "23505" });
          }
          const [slug, sprint_id, title, , , , readiness, scout, stats] = params as string[];
          db.report = { slug, sprint_id, title, readiness: JSON.parse(readiness), scout: JSON.parse(scout), stats: JSON.parse(stats), updated_at: new Date().toISOString() };
          return { rows: [db.report] };
        }
        if (sql.startsWith("delete from public.share_reports")) {
          db.report = null;
          return { rows: [] };
        }
        throw new Error(`unexpected SQL: ${sql}`);
      },
    }),
  ),
}));

import { DELETE, POST } from "./route";

const SPRINT = "11111111-1111-4111-8111-111111111111";
const done = new Date().toISOString();
let n = 0;

const req = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/share/report", { method, body: typeof body === "string" ? body : JSON.stringify(body) });
const post = (body: unknown = { sprintId: SPRINT }) => POST(req("POST", body));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  session.getSessionUser.mockResolvedValue({ uid: `u${++n}`, email: "a@b.c", name: null, picture: null });
  db.sprint = mkSprint({ id: SPRINT, title: "Google Prep" });
  db.problems = [
    ...Array.from({ length: 6 }, () => mkProblem({ companies: ["Google"], topics: ["Trees"], done_at: done })),
    ...Array.from({ length: 4 }, () => mkProblem({ companies: ["Google"], topics: ["Backtracking"], difficulty: "Pro" })),
  ];
  db.report = null;
  db.inserts = [];
  db.collideOnce = false;
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/share/report", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
  });

  it("400 for malformed requests", async () => {
    expect((await post({ sprintId: "nope" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post("{x")).status).toBe(400);
  });

  it("404 for a sprint the caller can't see", async () => {
    db.sprint = null;
    expect((await post()).status).toBe(404);
  });

  it("snapshots readiness, stats and an AI scout report", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify({ line1: "Battle-tested in Trees.", line2: "Vulnerable in Backtracking." }) });
    const res = await post();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // Google: 6 Core done (12) of 12 + 4 Pro (12) → 50%.
    expect(data.readiness).toEqual([{ company: "Google", score: 50, done: 6, total: 10, confidence: "high" }]);
    expect(data.stats).toMatchObject({ done: 6, total: 10, pct: 60, pro_done: 0, pro_total: 4 });
    expect(data.scout).toMatchObject({ ai: true, line1: "Battle-tested in Trees.", strengths: ["Trees"], weaknesses: ["Backtracking"] });
    expect(data.slug).toMatch(/^google-prep-[a-z0-9]{6}$/);
    // Only aggregates reach the model.
    expect(genai.generateContent.mock.calls[0][0].contents).not.toContain("Problem ");
  });

  it("falls back to the template when AI is off", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const { data } = await (await post()).json();
    expect(data.scout).toMatchObject({ ai: false, line1: "Battle-tested in Trees." });
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("keeps the slug when regenerating", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const first = (await (await post()).json()).data.slug;
    const second = (await (await post()).json()).data.slug;
    expect(second).toBe(first);
  });

  it("retries once with a fresh slug on a collision", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    db.collideOnce = true;
    expect((await post()).status).toBe(200);
    expect(db.inserts).toHaveLength(2);
    expect(db.inserts[0][0]).not.toBe(db.inserts[1][0]);
  });

  it("429 after 5 reports per minute for one user", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    session.getSessionUser.mockResolvedValue({ uid: "rate-limited", email: "", name: null, picture: null });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await post()).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("DELETE /api/share/report", () => {
  it("stops sharing", async () => {
    db.report = { slug: "x-abcdef" };
    expect((await DELETE(req("DELETE", { sprintId: SPRINT }))).status).toBe(200);
    expect(db.report).toBeNull();
  });

  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await DELETE(req("DELETE", { sprintId: SPRINT }))).status).toBe(401);
  });
});
