import type { ReviewDeps } from "@/lib/review/review";
import type { DigestFacts, GroupDigest } from "@/lib/types";
import { DIGEST_SYSTEM, digestUser } from "./prompt";
import { DigestCopySchema } from "./schema";
import { templateDigest } from "./template";

export type DigestDeps = ReviewDeps;

const pack = (f: DigestFacts, copy: { headline: string; lines: string[] }, ai: boolean): GroupDigest => ({
  headline: copy.headline,
  lines: copy.lines,
  // Always from the facts, never the model: these become links and nudge buttons.
  pairUp: f.pairUp,
  weekSolves: f.weekSolves,
  ai,
});

/** Built-in wording, no model. */
export const fallbackDigest = (f: DigestFacts) => pack(f, templateDigest(f), false);

/** Gemini rewords the facts; any error (or AI off) falls back to the template with `ai: false`. Never throws. */
export async function generateDigest(f: DigestFacts, deps: DigestDeps): Promise<GroupDigest> {
  if (deps.llm) {
    try {
      const copy = await deps.llm({ system: DIGEST_SYSTEM, user: digestUser(f), schema: DigestCopySchema });
      return pack(f, copy, true);
    } catch (e) {
      deps.log?.("LLM digest failed, using template", e);
    }
  }
  return fallbackDigest(f);
}
