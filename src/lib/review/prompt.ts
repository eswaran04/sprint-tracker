import { extractBlocks, proseOf, statedComplexity, stripReview } from "./blocks";
import type { ReviewProblem } from "./schema";

export const REVIEW_SYSTEM = `You are a senior competitive-programming coach reviewing a student's notes for one problem.
The notes contain their approach and usually code. Reply with JSON only, matching the schema.

complexity:
- "time"/"space": the complexity of THEIR solution as written (analyse the code; fall back to the described approach).
- "optimal_time"/"optimal_space": the best known complexity for THIS problem (use the problem name to identify it).
- verdict: "optimal" if theirs matches the optimal, "suboptimal" if not, "unknown" if you cannot tell (no code/approach,
  or you don't recognise the problem).
- If the student stated a complexity that is wrong, say so in "explanation". Keep it to 1-3 sentences.
- Write complexities in plain Big-O with n/m/k, e.g. "O(n log n)", "O(1)", "O(n^2)", "O(V + E)".

edge_cases: concrete, subtle bugs or risks in THEIR code, most severe first. Examples: integer overflow
(e.g. (left + right) / 2 when the sum exceeds 2^31 - 1), off-by-one loop bounds, empty/single-element input,
null dereference, negative numbers, duplicates, recursion depth, mutating input while iterating.
- "block" and "line" refer to the numbered code listing you are given (block 1 = first listing). Use null when the
  point is not tied to a line. Never invent lines that don't exist.
- severity: "bug" = wrong output or crash on valid input, "risk" = fails on some edge inputs or limits, "note" = minor.
- Return [] when the code looks correct. Don't pad with generic advice.

suggested_tags: algorithmic patterns/concepts this problem uses that are NOT already in the existing topics list
(e.g. "Two Pointers", "Monotonic Stack", "Binary Search on Answer", "Prefix Sum"). Title Case, max 5. [] if none.

summary: one sentence overall verdict.`;

function numbered(lines: string[]) {
  const w = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(w, " ")} | ${l}`).join("\n");
}

export function reviewUser(problem: ReviewProblem, notes: string) {
  const clean = stripReview(notes);
  const blocks = extractBlocks(clean);
  const prose = proseOf(clean);
  const stated = statedComplexity(clean);

  const parts = [
    `Problem: ${problem.name}`,
    problem.url ? `URL: ${problem.url}` : null,
    problem.difficulty ? `Difficulty: ${problem.difficulty}` : null,
    `Existing topics: ${problem.topics.length ? problem.topics.join(", ") : "(none)"}`,
    `Student's stated complexity: time ${stated.time ?? "(not stated)"}, space ${stated.space ?? "(not stated)"}`,
    "",
    "Notes (prose):",
    prose ? prose.slice(0, 6000) : "(none)",
  ];
  if (blocks.length) {
    for (const b of blocks) parts.push("", `Code block ${b.index}${b.lang ? ` (${b.lang})` : ""}:`, numbered(b.lines));
  } else {
    parts.push("", "(No code blocks: review the described approach.)");
  }
  return parts.filter((p) => p !== null).join("\n");
}
