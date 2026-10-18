import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkSheet } from "@/test/fixtures/sheets";

vi.mock("server-only", () => ({}));
const genai = vi.hoisted(() => ({ embedContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { embedContent: genai.embedContent };
  },
}));
const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/pool", () => ({ pool: async () => db }));

import { embedTexts, ensureSheetEmbeddings, saveGoal } from "./embeddings";
import { contentHash, sheetDocument } from "./sheet-document";

const vec = (seed: number, dims = 768) => Array.from({ length: dims }, (_, i) => (seed + i) / 1000);
const reply = (n: number, dims = 768) => ({ embeddings: Array.from({ length: n }, (_, i) => ({ values: vec(i, dims) })) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_EMBED_MODEL", "gemini-embedding-001");
  vi.stubEnv("AI_EMBED_DIMENSIONS", "768");
  genai.embedContent.mockImplementation(async ({ contents }: { contents: string[] }) => reply(contents.length));
});
afterEach(() => vi.unstubAllEnvs());

describe("embedTexts", () => {
  it("batches by 32, keeps order, and passes task type and dimensions", async () => {
    const texts = Array.from({ length: 70 }, (_, i) => `t${i}`);
    const out = await embedTexts(texts, "RETRIEVAL_DOCUMENT");
    expect(out).toHaveLength(70);
    expect(genai.embedContent).toHaveBeenCalledTimes(3);
    expect(genai.embedContent.mock.calls.map(([a]) => a.contents.length)).toEqual([32, 32, 6]);
    expect(genai.embedContent.mock.calls[0][0]).toMatchObject({
      model: "gemini-embedding-001",
      config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 },
    });
  });

  it("rejects responses with the wrong count or size", async () => {
    genai.embedContent.mockResolvedValueOnce(reply(1, 3072));
    await expect(embedTexts(["a"], "RETRIEVAL_QUERY")).rejects.toThrow("mismatch");
    genai.embedContent.mockResolvedValueOnce(reply(1));
    await expect(embedTexts(["a", "b"], "RETRIEVAL_QUERY")).rejects.toThrow("mismatch");
  });
});

describe("ensureSheetEmbeddings", () => {
  const fresh = mkSheet({ id: "fresh" });
  const changed = mkSheet({ id: "changed", title: "New title" });
  const missing = mkSheet({ id: "missing" });
  const freshHash = contentHash(sheetDocument(fresh), "gemini-embedding-001", 768);

  beforeEach(() => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes("delete from public.sheet_embeddings")) return { rows: [], rowCount: 2 };
      if (sql.includes("from public.public_sheets")) {
        return { rows: [{ ...fresh, content_hash: freshHash }, { ...changed, content_hash: "old" }, { ...missing, content_hash: null }] };
      }
      return { rows: [], rowCount: 1 };
    });
  });

  it("embeds only missing or changed sheets and upserts them", async () => {
    const r = await ensureSheetEmbeddings();
    expect(r).toEqual({ embedded: 2, unchanged: 1, removed: 2 });
    expect(genai.embedContent).toHaveBeenCalledOnce();
    expect(genai.embedContent.mock.calls[0][0].contents).toEqual([sheetDocument(changed), sheetDocument(missing)]);
    const upserts = db.query.mock.calls.filter(([sql]) => sql.includes("insert into public.sheet_embeddings"));
    expect(upserts.map(([, p]) => p[0])).toEqual(["changed", "missing"]);
    expect(upserts[0][1][2]).toMatch(/^\[0,0\.001,/);
  });

  it("passes the id filter through and skips the model when nothing changed", async () => {
    db.query.mockImplementation(async (sql: string) =>
      sql.includes("from public.public_sheets") ? { rows: [{ ...fresh, content_hash: freshHash }] } : { rows: [], rowCount: 0 },
    );
    const r = await ensureSheetEmbeddings({ ids: ["fresh"] });
    expect(r).toEqual({ embedded: 0, unchanged: 1, removed: 0 });
    expect(genai.embedContent).not.toHaveBeenCalled();
    expect(db.query.mock.calls.every(([, p]) => JSON.stringify(p) === JSON.stringify([["fresh"]]))).toBe(true);
  });
});

describe("saveGoal", () => {
  it("embeds the goal as a query and stores it", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await saveGoal("u1", "  FAANG SDE2, weak at DP  ");
    expect(genai.embedContent.mock.calls[0][0]).toMatchObject({ contents: ["FAANG SDE2, weak at DP"], config: { taskType: "RETRIEVAL_QUERY" } });
    expect(db.query.mock.calls[0][1].slice(0, 2)).toEqual(["u1", "FAANG SDE2, weak at DP"]);
  });

  it("clears without calling the model", async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 1 });
    await saveGoal("u1", "   ");
    expect(genai.embedContent).not.toHaveBeenCalled();
    expect(db.query.mock.calls[0][1]).toEqual(["u1", null, null]);
  });
});
