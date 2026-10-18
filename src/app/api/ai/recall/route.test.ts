import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Recall, RecallProblem, Viva } from "@/lib/recall/schema";

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

const problem: RecallProblem = { name: "LRU Cache", url: "", difficulty: "Core", subject: "dsa", topics: ["Linked List"] };
const aiRecall: Recall = {
  intro: "Two weeks ago you solved LRU Cache. In your notes, you wrote about a Doubly Linked List + HashMap.",
  question: "Why couldn't a singly linked list give O(1) deletion here?",
  hint: "What do you need to unlink a node?",
  answer: "Unlinking needs the previous node; a singly linked list would need an O(n) walk to find it.",
};
const aiViva: Viva = {
  questions: [
    { question: "What is a deadlock?", answer: "A cycle of processes each waiting on a resource held by the next." },
    { question: "How does ordering locks prevent it?", answer: "It breaks the circular-wait condition." },
  ],
};

let n = 0;
/** Unique notes per call so the route's cache never leaks between tests. */
const uniq = (text: string) => `${text}\n// ${++n}`;
const recall = (notes: string, daysAgo = 14) => ({ mode: "recall", problem, notes, daysAgo });
const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/ai/recall", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("AI_ENABLED", "true");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  session.getSessionUser.mockResolvedValue({ uid: `u${n}`, email: "a@b.c", name: null, picture: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/recall", () => {
  it("401 when signed out", async () => {
    session.getSessionUser.mockResolvedValue(null);
    expect((await post(recall("notes"))).status).toBe(401);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("400 for malformed requests", async () => {
    expect((await post({ mode: "recall", problem, notes: "x" })).status).toBe(400);
    expect((await post({ mode: "quiz", problem, notes: "x" })).status).toBe(400);
    expect((await post(recall("x".repeat(8_001)))).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("returns an AI recall question grounded in the notes", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiRecall) });
    const res = await post(recall(uniq("Doubly linked list + hashmap.")));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ mode: "recall", ai: true, recall: { question: aiRecall.question } });
    const req = genai.generateContent.mock.calls[0][0];
    expect(req.contents).toContain("Doubly linked list + hashmap.");
    expect(req.contents).toContain("two weeks ago");
    expect(req.config.responseJsonSchema.properties.question).toBeDefined();
  });

  it("returns viva questions", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiViva) });
    const res = await post({ mode: "viva", problem: { ...problem, name: "Deadlock", subject: "os" }, notes: uniq("") });
    const { data } = await res.json();
    expect(data).toMatchObject({ mode: "viva", ai: true });
    expect(data.viva.questions).toHaveLength(2);
  });

  it("falls back to built-in questions when AI is disabled or the model fails", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    let res = await post(recall(uniq("Use two pointers.")));
    expect((await res.json()).data).toMatchObject({ mode: "recall", ai: false });
    expect(genai.generateContent).not.toHaveBeenCalled();

    vi.stubEnv("AI_ENABLED", "true");
    genai.generateContent.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ text: '{"questions":[]}' });
    res = await post(recall(uniq("a")));
    expect((await res.json()).data.ai).toBe(false);
    res = await post({ mode: "viva", problem: { ...problem, subject: "cn" }, notes: uniq("") });
    const { data } = await res.json();
    expect(data.ai).toBe(false);
    expect(data.viva.questions).toHaveLength(2);
  });

  it("serves repeated AI questions from cache", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiRecall) });
    const notes = uniq("cached");
    await post(recall(notes));
    const res = await post(recall(notes));
    expect((await res.json()).data.ai).toBe(true);
    expect(genai.generateContent).toHaveBeenCalledTimes(1);
  });

  it("429 after 20 model calls per minute for one user", async () => {
    session.getSessionUser.mockResolvedValue({ uid: "rate-limited", email: "", name: null, picture: null });
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(aiRecall) });
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await post(recall(uniq("q")))).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
