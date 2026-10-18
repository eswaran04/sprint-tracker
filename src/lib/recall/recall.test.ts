import { describe, expect, it, vi } from "vitest";
import { mkProblem } from "@/test/fixtures/problems";
import { heuristicRecall, heuristicViva, keySentence } from "./heuristics";
import { recallUser } from "./prompt";
import { generateRecall, generateViva } from "./recall";
import { RecallRequest, type Recall } from "./schema";
import { agoLabel, daysSince, isTheory, pickRecall, theorySubject } from "./select";

const TODAY = "2026-11-20";
/** done_at at local noon `n` days before TODAY. */
const ago = (n: number) => new Date(2026, 10, 20 - n, 12).toISOString();
const rp = { name: "LRU Cache", url: "", difficulty: "Core" as const, subject: "dsa", topics: ["Linked List", "Hashing"] };

describe("pickRecall", () => {
  it("picks problems at the 7/14/30-day checkpoints, longest interval first", () => {
    const ps = [
      mkProblem({ id: "d7", done_at: ago(7) }),
      mkProblem({ id: "d14", done_at: ago(14) }),
      mkProblem({ id: "d30", done_at: ago(30) }),
      mkProblem({ id: "d10", done_at: ago(10) }),
    ];
    expect(pickRecall(ps, TODAY).map((c) => [c.problem.id, c.daysAgo, c.reason])).toEqual([
      ["d30", 30, "interval"],
      ["d14", 14, "interval"],
    ]);
    expect(pickRecall(ps, TODAY, 5).map((c) => c.problem.id)).toEqual(["d30", "d14", "d7"]);
  });

  it("allows ±1 day of slack but prefers the exact day", () => {
    const ps = [mkProblem({ id: "d8", done_at: ago(8) }), mkProblem({ id: "d7", done_at: ago(7) }), mkProblem({ id: "d9", done_at: ago(9) })];
    expect(pickRecall(ps, TODAY, 5).map((c) => c.problem.id)).toEqual(["d7", "d8"]);
  });

  it("fills remaining slots with starred problems and skips undone or today's problems", () => {
    const ps = [
      mkProblem({ id: "d7", done_at: ago(7) }),
      mkProblem({ id: "star", done_at: ago(3), starred: true }),
      mkProblem({ id: "todayStar", done_at: ago(0), starred: true }),
      mkProblem({ id: "undone", starred: true }),
    ];
    expect(pickRecall(ps, TODAY).map((c) => [c.problem.id, c.reason])).toEqual([["d7", "interval"], ["star", "starred"]]);
  });

  it("ranks problems with notes higher and is deterministic", () => {
    const ps = [mkProblem({ id: "a", done_at: ago(7) }), mkProblem({ id: "b", done_at: ago(7), notes: "Use a deque." })];
    expect(pickRecall(ps, TODAY, 1)[0].problem.id).toBe("b");
    const many = Array.from({ length: 6 }, (_, i) => mkProblem({ id: `s${i}`, done_at: ago(3), starred: true }));
    expect(pickRecall(many, TODAY)).toEqual(pickRecall([...many].reverse(), TODAY));
  });
});

describe("helpers", () => {
  it("recognises theory subjects and their spellings", () => {
    expect(["dbms", "OOPS", "oop", "os", "CN", "Operating Systems", "computer-networks"].map(theorySubject)).toEqual([
      "dbms", "oops", "oops", "os", "cn", "os", "cn",
    ]);
    expect(isTheory({ subject: "dsa" })).toBe(false);
  });

  it("counts calendar days and labels them", () => {
    expect(daysSince(ago(14), TODAY)).toBe(14);
    expect([agoLabel(7), agoLabel(14), agoLabel(30), agoLabel(9)]).toEqual(["a week ago", "two weeks ago", "a month ago", "9 days ago"]);
  });

  it("validates requests per mode", () => {
    expect(RecallRequest.safeParse({ mode: "recall", problem: rp, notes: "", daysAgo: 7 }).success).toBe(true);
    expect(RecallRequest.safeParse({ mode: "recall", problem: rp, notes: "" }).success).toBe(false);
    expect(RecallRequest.safeParse({ mode: "viva", problem: rp, notes: "" }).success).toBe(true);
    expect(RecallRequest.safeParse({ mode: "quiz", problem: rp, notes: "" }).success).toBe(false);
  });
});

describe("heuristics", () => {
  const notes = "## Approach\n- Use a doubly linked list + hashmap for O(1) get/put.\n- Time: O(1)\n\n```java\nclass LRU {}\n```";

  it("quotes the user's own notes", () => {
    expect(keySentence(notes)).toBe("Use a doubly linked list + hashmap for O(1) get/put.");
    const r = heuristicRecall(rp, notes, 14);
    expect(r.intro).toContain("Two weeks ago you solved LRU Cache");
    expect(r.intro).toContain("doubly linked list + hashmap");
    expect(r.answer).toContain("O(1)");
  });

  it("falls back to topics when there are no notes", () => {
    const r = heuristicRecall(rp, "", 7);
    expect(r.intro).toContain("A week ago you solved LRU Cache (Linked List, Hashing)");
    expect(r.hint).toContain("Linked List");
  });

  it("asks two subject-specific viva questions", () => {
    const v = heuristicViva({ ...rp, name: "Normalization", subject: "dbms" });
    expect(v.questions).toHaveLength(2);
    expect(v.questions[0].question).toContain("Normalization");
  });

  it("leaves the AI review block out of the prompt", () => {
    const withReview = `${notes}\n\n<!-- ai-review:start -->\nSECRET REVIEW\n<!-- ai-review:end -->`;
    expect(recallUser(rp, withReview, 14)).not.toContain("SECRET REVIEW");
    expect(recallUser(rp, withReview, 14)).toContain("doubly linked list");
  });
});

describe("generateRecall / generateViva", () => {
  const aiRecall: Recall = { intro: "Two weeks ago…", question: "Why not singly linked?", hint: "prev pointer", answer: "Deletion needs prev." };

  it("returns the model's question when it works", async () => {
    const llm = vi.fn().mockResolvedValue(aiRecall);
    const res = await generateRecall(rp, "notes", 14, { llm: llm as never });
    expect(res).toEqual({ mode: "recall", recall: aiRecall, ai: true });
    expect(llm.mock.calls[0][0].user).toContain("two weeks ago");
  });

  it("falls back when the model throws or AI is off", async () => {
    const log = vi.fn();
    const llm = vi.fn().mockRejectedValue(new Error("boom"));
    expect((await generateRecall(rp, "", 7, { llm: llm as never, log })).ai).toBe(false);
    expect(log).toHaveBeenCalled();
    const viva = await generateViva({ ...rp, subject: "os" }, "", { llm: null });
    expect(viva.ai).toBe(false);
    expect(viva.viva.questions).toHaveLength(2);
  });
});
