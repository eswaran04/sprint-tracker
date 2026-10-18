import { z } from "zod";
import { clampStrategy, LIMITS, type CoachStrategy } from "@/lib/coach/planner";
import type { CoachSignals } from "@/lib/coach/signals";

/**
 * Pure helpers for the backlog coach. Gemini only chooses a strategy (a few clamped numbers and topic names from
 * the signals) and explains it; `planReschedule` builds the actual schedule. Safe to import on the client.
 */

export const coachRequestSchema = z
  .object({
    sprintId: z.uuid(),
    today: z.iso.date(),
  })
  .strict();
export type CoachRequest = z.infer<typeof coachRequestSchema>;

export const MAX_RATIONALE_ITEMS = 4;
export const MAX_RATIONALE_LENGTH = 140;

export interface CoachAdvice {
  strategy: CoachStrategy;
  rationale: string[];
}

/** Topics the model may name in `reviewBefore`: only heavy runs actually present in this plan. */
export const heavyTopics = (signals: CoachSignals) => [...new Set(signals.heavyRuns.map((r) => r.topic))];

/** JSON Schema for `responseJsonSchema`. Every field required (flash models skip optional ones). */
export function buildCoachResponseSchema(signals: CoachSignals) {
  const topics = heavyTopics(signals);
  const properties: Record<string, unknown> = {
    dailyCapacity: {
      type: "number",
      minimum: LIMITS.capacity.min,
      maximum: LIMITS.capacity.max,
      description: "Effort units per plan day. Basic≈1, Core≈1.5, Pro≈2.5 (see weights). Roughly pace.perActiveDay × average weight.",
    },
    maxProPerDay: {
      type: "integer",
      minimum: LIMITS.maxPro.min,
      maximum: LIMITS.maxPro.max,
      description: "Cap on Pro problems per day. 0 = no cap. Use 1 when the student runs late on Pro.",
    },
    // An empty enum is an invalid schema; with no heavy runs the model can only return [].
    reviewBefore: topics.length
      ? { type: "array", items: { type: "string", enum: topics }, description: "Heavy-run topics that should get an empty review day before them." }
      : { type: "array", items: { type: "string" }, maxItems: 0, description: "Always [] (no heavy runs ahead)." },
    frontLoadFlagged: {
      type: "boolean",
      description: "true to pull problems the student flagged as struggled/revisit slightly earlier.",
    },
    rationale: {
      type: "array",
      maxItems: MAX_RATIONALE_ITEMS,
      items: { type: "string", maxLength: MAX_RATIONALE_LENGTH },
      description: "2–4 short, encouraging bullet points explaining the plan in second person. No problem names.",
    },
  };
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false, propertyOrdering: Object.keys(properties) };
}

export const COACH_SYSTEM_PROMPT = `You are a study coach for a coding-interview prep plan. The student is behind schedule.
You receive summary statistics only and choose a rescheduling STRATEGY. A deterministic planner builds the schedule from it.

Fields:
- dailyCapacity: effort units per plan day (1–20). Effort weights per difficulty are in "weights" (Basic≈1, Core≈1.5, Pro≈2.5, heavier when the student runs late on that level). Aim for what the student actually does: pace.perActiveDay × average weight of remaining work. Don't plan more than they've shown they can do; slightly less is fine when they are far behind.
- maxProPerDay: 0 = no cap. Use 1 when Pro avgLagDays > 1 or many Pro problems are overdue, 2 when Pro is fine but dense.
- reviewBefore: topics of heavyRuns that deserve a review day first — prefer topics that also appear in flaggedTopics (struggle/revisit notes). Use [] when nothing stands out.
- frontLoadFlagged: true when flaggedUndone > 0 and those problems should be revisited early.
- rationale: 2–4 bullets, ≤140 chars each, second person, concrete numbers, no problem names.

Examples:
Signals: pace.perActiveDay 3, Pro avgLagDays 2.5, overdue Pro 6, heavyRuns [] ->
{"dailyCapacity":4,"maxProPerDay":1,"reviewBefore":[],"frontLoadFlagged":false,"rationale":["You finish about 3 problems on days you study, so each day is sized to that.","Pro problems run 2–3 days late for you; at most one per day keeps momentum."]}
Signals: pace.perActiveDay 5, Pro avgLagDays 0.2, heavyRuns [{"topic":"Dynamic Programming","days":4}], flaggedTopics [{"topic":"Dynamic Programming","struggle":3}] ->
{"dailyCapacity":7,"maxProPerDay":2,"reviewBefore":["Dynamic Programming"],"frontLoadFlagged":true,"rationale":["A 4-day Dynamic Programming stretch is coming and your notes say it was tough; a review day comes first.","Problems you flagged to revisit move up so they're fresh."]}
Signals: pace.perActiveDay 0 (no recent activity), plannedPerDay 4, overdue 12 ->
{"dailyCapacity":5,"maxProPerDay":1,"reviewBefore":[],"frontLoadFlagged":false,"rationale":["No recent activity, so the plan restarts gently at about 3–4 problems a day.","One Pro a day at most while you rebuild a streak."]}
Signals: pace.perActiveDay 8, heavyRuns [{"topic":"Graphs","days":2}], flaggedTopics [] ->
{"dailyCapacity":12,"maxProPerDay":0,"reviewBefore":[],"frontLoadFlagged":false,"rationale":["You're moving fast at about 8 a day, so the backlog is absorbed quickly without stretching the plan."]}

Return only the JSON object.`;

export function buildCoachPrompt(signals: CoachSignals) {
  return `Signals: ${JSON.stringify(signals)}`;
}

/**
 * The guarantee that the model can only produce a valid strategy: numbers are clamped, topics must be heavy-run
 * topics from the signals, and any invalid field falls back to `fallback` (the rule-based strategy).
 */
export function sanitizeCoachStrategy(raw: unknown, signals: CoachSignals, fallback: CoachStrategy): CoachAdvice {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const allowed = new Map(heavyTopics(signals).map((t) => [t.trim().toLowerCase(), t]));
  const known = (t: unknown) => (typeof t === "string" ? allowed.get(t.trim().toLowerCase()) : undefined);

  const reviewBefore = Array.isArray(obj.reviewBefore)
    ? [...new Set(obj.reviewBefore.map(known).filter((t): t is string => Boolean(t)))]
    : fallback.reviewBefore;

  const strategy = clampStrategy({
    dailyCapacity: num(obj.dailyCapacity) ?? fallback.dailyCapacity,
    maxProPerDay: num(obj.maxProPerDay) ?? fallback.maxProPerDay,
    reviewBefore,
    frontLoadFlagged: typeof obj.frontLoadFlagged === "boolean" ? obj.frontLoadFlagged : fallback.frontLoadFlagged,
  });

  const rationale = Array.isArray(obj.rationale)
    ? obj.rationale
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().replace(/\s+/g, " ").slice(0, MAX_RATIONALE_LENGTH))
        .slice(0, MAX_RATIONALE_ITEMS)
    : [];
  return { strategy, rationale };
}

/** Plain-language explanation for a strategy, used when the plan is rule-based (or the model gave no rationale). */
export function describeStrategy(s: CoachStrategy, signals: CoachSignals): string[] {
  const out: string[] = [];
  if (signals.pace.activeDays >= 3 && signals.pace.perActiveDay > 0) {
    out.push(`You finish about ${Math.round(signals.pace.perActiveDay * 10) / 10} problems on days you study; each day is sized to that.`);
  } else {
    out.push(`Not much recent activity, so each day is sized to about ${s.dailyCapacity} effort units.`);
  }
  if (s.maxProPerDay > 0) out.push(`At most ${s.maxProPerDay} Pro problem${s.maxProPerDay === 1 ? "" : "s"} per day, since Pro ones tend to run late.`);
  if (s.reviewBefore.length) out.push(`A review day comes before ${s.reviewBefore.join(", ")} to warm up first.`);
  if (s.frontLoadFlagged) out.push("Problems you flagged to revisit move up slightly so they stay fresh.");
  return out.slice(0, MAX_RATIONALE_ITEMS);
}
