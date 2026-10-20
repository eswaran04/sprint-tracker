import { z } from "zod";
import { ReviewRequest, type ReviewProblem } from "@/lib/review/schema";

/**
 * Contracts for the Daily Recall warmup and the theory "viva" check. The browser posts the problem + the user's own
 * notes to `/api/ai/recall`; the model's output is validated here before it reaches the UI.
 */

/** Only the first part of the notes matters for a one-minute question; keeps prompts (and cost) small. */
export const MAX_RECALL_NOTES = 8_000;

const text = (max: number) => z.string().trim().min(1).max(max);

export const RecallSchema = z
  .object({
    /** "Two weeks ago you solved LRU Cache. In your notes you wrote about …" */
    intro: text(400),
    question: text(400),
    hint: text(300),
    answer: text(800),
  })
  .strict();
export type Recall = z.infer<typeof RecallSchema>;

export const VivaQuestionSchema = z.object({ question: text(300), answer: text(600) }).strict();
export const VivaSchema = z.object({ questions: z.array(VivaQuestionSchema).length(2) }).strict();
export type Viva = z.infer<typeof VivaSchema>;
export type VivaQuestion = z.infer<typeof VivaQuestionSchema>;

export type RecallResponse = { mode: "recall"; recall: Recall; ai: boolean };
export type VivaResponse = { mode: "viva"; viva: Viva; ai: boolean };

export type RecallProblem = ReviewProblem;

const problem = ReviewRequest.shape.problem;
const notes = z.string().max(MAX_RECALL_NOTES);

/** Request body of `POST /api/ai/recall`. */
export const RecallRequest = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("recall"), problem, notes, daysAgo: z.number().int().min(0).max(3650) }).strict(),
  z.object({ mode: z.literal("viva"), problem, notes }).strict(),
]);
export type RecallRequest = z.infer<typeof RecallRequest>;
