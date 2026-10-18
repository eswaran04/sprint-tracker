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

/** Goal settings the generator may ask the user about when the description leaves them out (priority order). */
export const CLARIFIABLE = ["weeks", "hours_per_day", "company", "weak_topics", "skip_weekends"] as const;
export const ClarifiableField = z.enum(CLARIFIABLE);
export type ClarifiableField = z.infer<typeof ClarifiableField>;

/** What the goal-parsing model call returns: the settings plus which of them were defaulted, not stated. */
export const GoalDraftSchema = z
  .object({
    goal: GoalSchema,
    unspecified: z.array(ClarifiableField).max(CLARIFIABLE.length),
  })
  .strict();
export type GoalDraft = z.infer<typeof GoalDraftSchema>;

/** The user's answers to clarifying questions. Topic/company values are re-matched against the catalogue. */
export const AnswersSchema = z
  .object({
    weeks: z.number().int().min(1).max(52).optional(),
    hours_per_day: z.number().min(0.5).max(12).optional(),
    company: z.string().trim().max(100).nullable().optional(),
    weak_topics: z.array(z.string().trim().max(100)).max(20).optional(),
    skip_weekends: z.boolean().optional(),
  })
  .strict();
export type Answers = z.infer<typeof AnswersSchema>;

/** A clarifying question. Prompts and options are written by the server from the catalogue, never by the model. */
export interface Question {
  field: ClarifiableField;
  prompt: string;
  kind: "number" | "single" | "multi" | "boolean";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default: number | string | string[] | boolean | null;
}

export const GenerateRequest = z
  .object({
    prompt: z.string().trim().min(3).max(1000),
    today: isoDate,
    /** Goal parsed in the first round, sent back with the answers so it isn't parsed again. */
    goal: GoalSchema.optional(),
    answers: AnswersSchema.optional(),
    /** Build the plan with defaults instead of asking questions. */
    skip_questions: z.boolean().optional(),
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

export interface QuestionsResponse {
  kind: "questions";
  /** The goal as understood so far; send it back with the answers. */
  goal: Goal;
  questions: Question[];
  ai: boolean;
}

export type GenerateResult = QuestionsResponse | ({ kind: "plan" } & GenerateResponse);
