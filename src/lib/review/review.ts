import type { ZodType } from "zod";
import { extractBlocks, stripReview } from "./blocks";
import { heuristicReview, newTags } from "./heuristics";
import { REVIEW_SYSTEM, reviewUser } from "./prompt";
import { ReviewSchema, type Review, type ReviewProblem, type ReviewResponse } from "./schema";

export interface ReviewDeps {
  /** Structured LLM call, or null when no LLM is configured. */
  llm: (<T>(opts: { system: string; user: string; schema: ZodType<T> }) => Promise<T>) | null;
  log?: (msg: string, e?: unknown) => void;
}

/** Drops line references that don't exist and tags the problem already has (models occasionally do both). */
function sanitize(review: Review, notes: string, topics: string[]): Review {
  const blocks = extractBlocks(stripReview(notes));
  const edge_cases = review.edge_cases.map((e) => {
    const block = blocks.length === 1 ? 1 : e.block;
    const b = block != null ? blocks[block - 1] : undefined;
    const valid = Boolean(b && e.line != null && e.line <= b.lines.length);
    return { ...e, block: valid ? block : null, line: valid ? e.line : null };
  });
  return { ...review, edge_cases, suggested_tags: newTags(review.suggested_tags, topics).slice(0, 5) };
}

/** AI review with a built-in fallback: never throws for LLM problems, it reports `ai: false` instead. */
export async function reviewNote(problem: ReviewProblem, notes: string, deps: ReviewDeps): Promise<ReviewResponse> {
  if (deps.llm) {
    try {
      const review = await deps.llm({ system: REVIEW_SYSTEM, user: reviewUser(problem, notes), schema: ReviewSchema });
      return { review: sanitize(review, notes, problem.topics), ai: true };
    } catch (e) {
      deps.log?.("LLM review failed, using built-in analyzer", e);
    }
  }
  return { review: heuristicReview(problem, notes), ai: false };
}
