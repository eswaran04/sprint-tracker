import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { reviewModel, vertexLlm } from "@/lib/ai/vertex";
import { reviewNote } from "./review";
import type { ReviewProblem } from "./schema";

const problem: ReviewProblem = {
  name: "Two Sum",
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "Basic",
  subject: "Algorithms",
  topics: ["Array", "Hash Table"],
};

const notes = `
### Approach
Use a hash map to look up complements in O(1) time.

\`\`\`javascript
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) return [map.get(diff), i];
    map.set(nums[i], i);
  }
}
\`\`\`
`;

it("reviews notes with Vertex AI", { timeout: 30_000 }, async () => {
  const llm = vertexLlm(reviewModel(), 25_000);
  expect(llm).not.toBeNull();
  if (!llm) return;

  const result = await reviewNote(problem, notes, { llm, log: console.log });
  console.log("Review result:", JSON.stringify(result, null, 2));
  expect(result.ai).toBe(true);
  expect(result.review.summary).toBeTruthy();
  expect(result.review.complexity.verdict).toBe("optimal");
});
