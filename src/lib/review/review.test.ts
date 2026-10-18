import { describe, expect, it, vi } from "vitest";
import { extractBlocks, normComplexity, statedComplexity, stripMarkers, stripReview } from "./blocks";
import { renderReview, upsertReview } from "./format";
import { heuristicReview, newTags } from "./heuristics";
import { reviewUser } from "./prompt";
import { reviewNote } from "./review";
import type { Review, ReviewProblem } from "./schema";

const problem: ReviewProblem = { name: "Binary Search", url: "", difficulty: "Basic", subject: "dsa", topics: ["Arrays"] };

const BINARY = [
  "## Approach",
  "Classic binary search.",
  "",
  "## Complexity",
  "- Time: O(log n)",
  "- Space: O()",
  "",
  "```java",
  "int search(int[] nums, int target) {",
  "  int left = 0, right = nums.length - 1;",
  "  while (left <= right) {",
  "    int mid = (left + right) / 2;",
  "    if (nums[mid] == target) return mid;",
  "    if (nums[mid] < target) left = mid + 1;",
  "    else right = mid - 1;",
  "  }",
  "  return -1;",
  "}",
  "```",
].join("\n");

const aiReview: Review = {
  summary: "Correct, but watch the midpoint.",
  complexity: { time: "O(log n)", space: "O(1)", optimal_time: "O(log n)", optimal_space: "O(1)", verdict: "optimal", explanation: "Halves the range each step." },
  edge_cases: [{ block: 1, line: 4, severity: "risk", message: "left + right can overflow." }],
  suggested_tags: ["Binary Search"],
};

describe("blocks", () => {
  it("extracts fenced code blocks with language and skips empty ones", () => {
    const blocks = extractBlocks("```py\nx = 1\n```\n\n```java\n\n```\n~~~\ny\n~~~");
    expect(blocks).toEqual([
      { index: 1, lang: "py", lines: ["x = 1"] },
      { index: 2, lang: "", lines: ["y"] },
    ]);
  });

  it("reads stated complexity and ignores the empty template", () => {
    expect(statedComplexity(BINARY)).toEqual({ time: "O(log n)", space: null });
    expect(statedComplexity("Time complexity: `O(n log n)`\nSpace = O(1)")).toEqual({ time: "O(n log n)", space: "O(1)" });
  });

  it("normalises complexity notation", () => {
    expect(normComplexity("O(N log N)")).toBe(normComplexity("O(n·logn)"));
    expect(normComplexity("O(n²)")).toBe(normComplexity("O(n^{2})"));
  });

  it("strips a previous review before re-analysis and hides markers when rendering", () => {
    const withReview = upsertReview("my notes", renderReview(aiReview, true));
    expect(stripReview(withReview)).toBe("my notes");
    expect(stripMarkers(withReview)).not.toContain("<!--");
  });
});

describe("heuristicReview", () => {
  it("flags the (left + right) / 2 overflow on the right line", () => {
    const r = heuristicReview(problem, BINARY);
    const overflow = r.edge_cases.find((e) => e.message.includes("overflow"));
    expect(overflow).toMatchObject({ block: 1, line: 4, severity: "risk" });
  });

  it("does not flag overflow in Python, where ints are unbounded", () => {
    const r = heuristicReview(problem, "```python\ndef f(a):\n    lo, hi = 0, len(a) - 1\n    mid = (lo + hi) // 2\n```");
    expect(r.edge_cases.some((e) => e.message.includes("overflow"))).toBe(false);
  });

  it("estimates complexity from loop nesting and sorting", () => {
    const nested = "```java\nfor (int i = 0; i < n; i++) {\n  for (int j = 0; j < n; j++) {\n    s += a[i] * a[j];\n  }\n}\n```";
    expect(heuristicReview(problem, nested).complexity.time).toBe("O(n^2)");
    expect(heuristicReview(problem, "```java\nArrays.sort(a);\nreturn a[a.length - 1];\n```").complexity.time).toBe("O(n log n)");
    expect(heuristicReview(problem, BINARY).complexity).toMatchObject({ time: "O(log n)", space: "O(1)", verdict: "unknown", optimal_time: "Unknown" });
  });

  it("flags <= length loop bounds as an off-by-one bug", () => {
    const r = heuristicReview(problem, "```java\nfor (int i = 0; i <= nums.length; i++) sum += nums[i];\n```");
    expect(r.edge_cases).toContainEqual(expect.objectContaining({ line: 1, severity: "bug" }));
  });

  it("suggests pattern tags not already in the topics", () => {
    const notes = "Use a HashMap of seen values and a sliding window.\n```java\nMap<Integer, Integer> seen = new HashMap<>();\n```";
    expect(heuristicReview({ ...problem, topics: ["Hashing"] }, notes).suggested_tags).toEqual(["Sliding Window"]);
  });

  it("handles notes without code", () => {
    const r = heuristicReview(problem, "## Approach\nSort then scan.\n- Time: O(n log n)");
    expect(r.complexity.time).toBe("O(n log n)");
    expect(r.edge_cases).toEqual([]);
  });
});

describe("newTags", () => {
  it("dedupes and drops tags covered by existing topics", () => {
    expect(newTags(["Two Pointers", "two pointer", "Hash Map", "Greedy"], ["Hashing", "greedy"])).toEqual(["Two Pointers"]);
  });
});

describe("prompt", () => {
  it("numbers code lines and includes problem context", () => {
    const user = reviewUser(problem, BINARY);
    expect(user).toContain("Problem: Binary Search");
    expect(user).toContain("Existing topics: Arrays");
    expect(user).toContain("time O(log n), space (not stated)");
    expect(user).toContain("Code block 1 (java):");
    expect(user).toContain(" 4 |     int mid = (left + right) / 2;");
  });
});

describe("format", () => {
  it("renders all three sections", () => {
    const md = renderReview(aiReview, true, new Date("2026-10-01T00:00:00Z"));
    expect(md).toContain("### Complexity Check");
    expect(md).toContain("| Time | `O(log n)` | `O(log n)` |");
    expect(md).toContain("Line 4: left + right can overflow.");
    expect(md).toContain("Consider tagging: `Binary Search`");
    expect(md).toContain("Generated by AI · 2026-10-01");
  });

  it("escapes table pipes and strips comment markers from model text", () => {
    const md = renderReview({ ...aiReview, complexity: { ...aiReview.complexity, time: "O(|V| + |E|) -->" } }, true);
    expect(md).toContain("O(\\|V\\| + \\|E\\|)");
    expect(md.match(/-->/g)).toHaveLength(2); // only the real start/end markers
  });

  it("appends once and replaces on re-run", () => {
    const first = upsertReview("notes", renderReview(aiReview, true));
    const second = upsertReview(first + "\nmore after", renderReview({ ...aiReview, summary: "Second run" }, false));
    expect(second.match(/ai-review:start/g)).toHaveLength(1);
    expect(second).toContain("Second run");
    expect(second).not.toContain("Correct, but watch");
    expect(second.startsWith("notes\n\n")).toBe(true);
    expect(second).toContain("more after");
  });
});

describe("reviewNote", () => {
  it("returns the AI review and drops invalid lines and existing tags", async () => {
    const llm = vi.fn(async () => ({
      ...aiReview,
      edge_cases: [...aiReview.edge_cases, { block: 1, line: 99, severity: "note" as const, message: "made up" }],
      suggested_tags: ["Binary Search", "Arrays"],
    }));
    const res = await reviewNote(problem, BINARY, { llm: llm as never });
    expect(res.ai).toBe(true);
    expect(res.review.edge_cases[1]).toMatchObject({ block: null, line: null });
    expect(res.review.suggested_tags).toEqual(["Binary Search"]);
  });

  it("falls back to the built-in analyzer when the LLM fails or isn't configured", async () => {
    const log = vi.fn();
    const failed = await reviewNote(problem, BINARY, { llm: vi.fn(async () => { throw new Error("boom"); }) as never, log });
    expect(failed.ai).toBe(false);
    expect(log).toHaveBeenCalled();
    expect((await reviewNote(problem, BINARY, { llm: null })).ai).toBe(false);
  });
});

describe("hand-edited review blocks", () => {
  const block = renderReview(aiReview, true);
  const lines = block.split("\n");
  const noStart = lines.slice(1).join("\n");
  const noEnd = lines.slice(0, -1).join("\n");

  it("strips a review whose start marker was deleted", () => {
    const notes = `my approach\n\n${noStart}`;
    expect(stripReview(notes)).toBe("my approach");
    expect(upsertReview(notes, block).match(/## 🤖 AI Review/g)).toHaveLength(1);
  });

  it("strips a review whose end marker was deleted, keeping text after the footer", () => {
    const notes = `my approach\n\n${noEnd}\n\nmore notes`;
    expect(stripReview(notes)).toBe("my approach\n\nmore notes");
    const out = upsertReview(notes, block);
    expect(out.match(/## 🤖 AI Review/g)).toHaveLength(1);
    expect(out).toContain("more notes");
  });

  it("does not treat a review-only note as code to analyse", () => {
    expect(heuristicReview(problem, noStart).summary).toMatch(/Add code/);
    expect(stripReview(noStart)).toBe("");
  });
});
