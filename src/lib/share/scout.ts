import type { ZodType } from "zod";
import type { SkillProfile } from "@/lib/readiness";
import type { CompanyReadiness, ScoutReport } from "@/lib/types";
import { SCOUT_LINE_MAX, ScoutSchema, type ScoutLines } from "./schema";

export interface ScoutDeps {
  /** Structured LLM call, or null when AI is off (template only). */
  llm: (<T>(opts: { system: string; user: string; schema: ZodType<T> }) => Promise<T>) | null;
  log?: (msg: string, e?: unknown) => void;
}

export const SCOUT_SYSTEM = `You are a blunt but encouraging tech-interview scout writing a 2-line report card for a candidate's DSA/CS prep.
Return JSON {"line1": string, "line2": string}. Each line is at most ${SCOUT_LINE_MAX} characters, no emojis, no hashtags, no quotes.
line1: what they are battle-tested in (their strongest areas). line2: where they are vulnerable (their weakest areas), framed as the next target.
Use the exact area names given. Tone example:
line1: "Battle-tested in Trees & Sliding Window."
line2: "Vulnerable in Backtracking and OS Concurrency — that's the next boss fight."
Only use the data provided; never invent areas, companies or numbers.`;

/** Aggregates only: no problem names, notes or URLs ever reach the model. */
export function scoutUser(profile: SkillProfile, readiness: CompanyReadiness[], pct: number): string {
  const skills = profile.skills.slice(0, 12).map((s) => `${s.key}: ${s.score}% (${s.total} problems)`);
  const companies = readiness.map((c) => `${c.company}: ${c.score}%${c.confidence === "low" ? " (small sample)" : ""}`);
  return [
    `Overall completion: ${pct}%`,
    `Strongest areas: ${profile.strengths.join(", ") || "none yet"}`,
    `Weakest areas: ${profile.weaknesses.join(", ") || "none"}`,
    `Area scores (weighted by difficulty):\n${skills.join("\n") || "not enough data"}`,
    `Company readiness:\n${companies.join("\n") || "not enough data"}`,
  ].join("\n\n");
}

const clip = (s: string) => (s.length <= SCOUT_LINE_MAX ? s : `${s.slice(0, SCOUT_LINE_MAX - 1).trimEnd()}…`);
const and = (xs: string[], sep: string) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")}${sep}${xs.at(-1)}`);

/** Deterministic copy used when AI is off or fails. */
export function templateScout(profile: SkillProfile, pct: number): ScoutLines {
  const { strengths, weaknesses } = profile;
  const line1 = strengths.length
    ? `Battle-tested in ${and(strengths, " & ")}.`
    : pct > 0
      ? `Just getting started — ${pct}% of the sprint cleared and climbing.`
      : "Just getting started — day one of the grind.";
  const line2 = weaknesses.length
    ? `Vulnerable in ${and(weaknesses, " and ")} — that's the next boss fight.`
    : strengths.length
      ? "No weak spots on the board yet. Keep the streak alive."
      : "Every topic is still up for grabs.";
  return { line1: clip(line1), line2: clip(line2) };
}

/** AI scout report with a template fallback: never throws for LLM problems, it reports `ai: false` instead. */
export async function scoutReport(profile: SkillProfile, readiness: CompanyReadiness[], pct: number, deps: ScoutDeps): Promise<ScoutReport> {
  const base = { strengths: profile.strengths, weaknesses: profile.weaknesses };
  if (deps.llm && profile.skills.length) {
    try {
      const out = await deps.llm({ system: SCOUT_SYSTEM, user: scoutUser(profile, readiness, pct), schema: ScoutSchema });
      return { ...base, line1: clip(out.line1), line2: clip(out.line2), ai: true };
    } catch (e) {
      deps.log?.("LLM scout failed, using template", e);
    }
  }
  return { ...base, ...templateScout(profile, pct), ai: false };
}
