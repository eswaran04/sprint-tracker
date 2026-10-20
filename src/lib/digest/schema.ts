import { z } from "zod";

/** Request body of `POST /api/ai/digest`. */
export const DigestRequest = z.object({ groupId: z.uuid(), today: z.iso.date() }).strict();
export type DigestRequest = z.infer<typeof DigestRequest>;

export const MAX_HEADLINE = 80;
export const MAX_LINE = 160;
export const MAX_LINES = 4;

/** What the model may write: wording only. Pair-ups and numbers come from the facts. */
export const DigestCopySchema = z
  .object({
    headline: z.string().trim().min(1).max(MAX_HEADLINE),
    lines: z.array(z.string().trim().min(1).max(MAX_LINE)).min(1).max(MAX_LINES),
  })
  .strict();
export type DigestCopy = z.infer<typeof DigestCopySchema>;
