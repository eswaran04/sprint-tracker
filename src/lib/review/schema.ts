import { z } from "zod";
import type { Problem } from "@/lib/types";

/**
 * Contracts for "Analyze note". The browser posts the problem it already has loaded plus the notes to
 * `/api/ai/review`, which runs the review on Vertex AI; both the request and the model's output are validated here.
 */

export const MAX_NOTES = 50_000;

const text = (max: number) => z.string().max(max);

export const ComplexitySchema = z
  .object({
    time: text(80),
    space: text(80),
    optimal_time: text(80),
    optimal_space: text(80),
    verdict: z.enum(["optimal", "suboptimal", "unknown"]),
    explanation: text(1000),
  })
  .strict();

export const EdgeCaseSchema = z
  .object({
    /** 1-based code block number (as labelled in the prompt), or null when not tied to code. */
    block: z.number().int().min(1).nullable(),
    /** 1-based line within that block. */
    line: z.number().int().min(1).nullable(),
    severity: z.enum(["bug", "risk", "note"]),
    message: text(600),
  })
  .strict();

export const ReviewSchema = z
  .object({
    summary: text(600),
    complexity: ComplexitySchema,
    edge_cases: z.array(EdgeCaseSchema).max(8),
    suggested_tags: z.array(text(60)).max(8),
  })
  .strict();
export type Review = z.infer<typeof ReviewSchema>;
export type EdgeCase = z.infer<typeof EdgeCaseSchema>;

export interface ReviewResponse {
  review: Review;
  /** false when the built-in analyzer produced the review (AI disabled on the server, or the model failed). */
  ai: boolean;
}

export type ReviewProblem = Pick<Problem, "name" | "url" | "difficulty" | "subject" | "topics">;

/** Request body of `POST /api/ai/review`. */
export const ReviewRequest = z
  .object({
    problem: z
      .object({
        name: text(1000),
        url: text(4000),
        difficulty: z.enum(["Basic", "Core", "Pro"]).nullable(),
        subject: text(200),
        topics: z.array(text(200)).max(500),
      })
      .strict(),
    notes: z
      .string()
      .max(MAX_NOTES)
      .refine((s) => s.trim().length > 0, "Notes are empty"),
  })
  .strict();
