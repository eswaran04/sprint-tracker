import { z } from "zod";
import type { ShareReport } from "@/lib/types";

export const SCOUT_LINE_MAX = 90;

/** What the model must return: two punchy lines, nothing else. */
export const ScoutSchema = z.object({
  line1: z.string().trim().min(1).max(SCOUT_LINE_MAX),
  line2: z.string().trim().min(1).max(SCOUT_LINE_MAX),
});
export type ScoutLines = z.infer<typeof ScoutSchema>;

export const ShareReportRequest = z.object({ sprintId: z.uuid() }).strict();

/** Response of POST /api/share/report and `getMyShareReport` (the owner's view: no owner masking needed). */
export type ShareReportResponse = Omit<ShareReport, "owner_name" | "owner_avatar">;

export const SLUG_RE = /^[a-z0-9-]{3,64}$/;
export const isSlug = (s: string) => SLUG_RE.test(s);
