import type { ReviewDeps } from "@/lib/review/review";
import { heuristicRecall, heuristicViva } from "./heuristics";
import { RECALL_SYSTEM, VIVA_SYSTEM, recallUser, vivaUser } from "./prompt";
import { RecallSchema, VivaSchema, type RecallProblem, type RecallResponse, type VivaResponse } from "./schema";

export type RecallDeps = ReviewDeps;

/** Daily Recall question from the user's notes. Never throws for LLM problems: falls back with `ai: false`. */
export async function generateRecall(problem: RecallProblem, notes: string, daysAgo: number, deps: RecallDeps): Promise<RecallResponse> {
  if (deps.llm) {
    try {
      const recall = await deps.llm({ system: RECALL_SYSTEM, user: recallUser(problem, notes, daysAgo), schema: RecallSchema });
      return { mode: "recall", recall, ai: true };
    } catch (e) {
      deps.log?.("LLM recall failed, using built-in question", e);
    }
  }
  return { mode: "recall", recall: heuristicRecall(problem, notes, daysAgo), ai: false };
}

/** Rapid-fire 2-question viva for a theory topic. Never throws for LLM problems: falls back with `ai: false`. */
export async function generateViva(problem: RecallProblem, notes: string, deps: RecallDeps): Promise<VivaResponse> {
  if (deps.llm) {
    try {
      const viva = await deps.llm({ system: VIVA_SYSTEM, user: vivaUser(problem, notes), schema: VivaSchema });
      return { mode: "viva", viva, ai: true };
    } catch (e) {
      deps.log?.("LLM viva failed, using built-in questions", e);
    }
  }
  return { mode: "viva", viva: heuristicViva(problem), ai: false };
}
