import { z } from "zod";
import type { ProblemInput } from "@/lib/types";

/**
 * Contracts for the "describe your goal" generator. The LLM only ever fills `GoalSchema` (settings parsed from
 * the user's text) and `PlanSchema` (short catalogue IDs grouped into sprints/days). Problem names and URLs never
 * come from the model: the server maps IDs back to rows of `public_sheet_problems`.
 */

const isoDate = z.iso.date();

export const MAX_SPRINTS = 52;
export const MAX_DAYS = 400;
export const MAX_PER_DAY = 25;

export const GoalSchema = z
  .object({
    company: z.string().max(100).nullable(),
    weeks: z.number().int().min(1).max(52),
    hours_per_day: z.number().min(0.5).max(12),
    weak_topics: z.array(z.string().max(100)).max(20),
    focus_topics: z.array(z.string().max(100)).max(20),
    skip_weekends: z.boolean(),
    start_date: isoDate.nullable(),
    rest_days: z.array(isoDate).max(100),
    difficulty_mix: z
      .object({ basic: z.number().min(0).max(1), core: z.number().min(0).max(1), pro: z.number().min(0).max(1) })
      .strict(),
    title: z.string().min(1).max(200),
  })
  .strict();
export type Goal = z.infer<typeof GoalSchema>;
export type DifficultyMix = Goal["difficulty_mix"];

export const PlanSchema = z
  .object({
    sprints: z
      .array(
        z
          .object({
            theme: z.string().max(120),
            days: z.array(z.object({ ids: z.array(z.string().max(16)).max(MAX_PER_DAY) }).strict()).max(MAX_DAYS),
          })
          .strict(),
      )
      .max(MAX_SPRINTS),
    rationale: z.string().max(1000),
  })
  .strict();
export type Plan = z.infer<typeof PlanSchema>;

export const GenerateRequest = z
  .object({
    prompt: z.string().trim().min(3).max(1000),
    today: isoDate,
  })
  .strict();
export type GenerateRequest = z.infer<typeof GenerateRequest>;

export interface SprintTheme {
  sprint_no: number;
  theme: string;
}

export interface GenerateResponse {
  goal: Goal;
  title: string;
  start_date: string;
  skip_weekends: boolean;
  rest_days: string[];
  rows: ProblemInput[];
  sprints: SprintTheme[];
  rationale: string;
  warnings: string[];
  /** True when the AI planner produced the plan; false when the built-in planner did. */
  ai: boolean;
}
