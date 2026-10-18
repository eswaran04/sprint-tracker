import type {
  Group, GroupActivityRow, GroupDigest, GroupMember, GroupPreview, GroupProgressRow, GroupReaction, MyGroup, MyNudge, Problem, ProblemInput, PublicProblem,
  PublicSheet, SavedFilter, Sprint,
} from "@/lib/types";
import type { AiFilters, FacetNames } from "@/lib/ai/nl-filters";
import type { GenerateRequest, GenerateResult } from "@/lib/generate/schema";
import { MAX_NOTES, type ReviewProblem, type ReviewResponse } from "@/lib/review/schema";
import { MAX_RECALL_NOTES, type RecallProblem, type RecallResponse, type VivaResponse } from "@/lib/recall/schema";
import type { ShareReportResponse } from "@/lib/share/schema";
import type { CoachPlan } from "@/lib/coach/plan";

export type { CoachPlan } from "@/lib/coach/plan";
export type { CoachStrategy } from "@/lib/coach/planner";

/** Calls a server operation (`src/lib/db/ops.ts`) as the signed-in user. Throws with the server's message. */
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/rpc/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(args),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export type ProblemPatch = Partial<Pick<Problem, "done_at" | "starred" | "notes" | "day_no" | "sprint_no">>;
export type SprintPatch = Partial<
  Pick<
    Sprint,
    "title" | "start_date" | "skip_weekends" | "rest_days" | "visibility" | "description" | "show_owner" | "owner_name" | "owner_avatar" | "published_at"
  >
>;
export type DayChange = { id: string; day_no: number; sprint_no: number };

export interface SprintSummary extends Sprint {
  total: number;
  done: number;
}

export const listSprints = () => rpc<SprintSummary[]>("listSprints");

export const getSprint = (id: string) => rpc<{ sprint: Sprint; problems: Problem[] }>("getSprint", { id });

export const createSprint = (
  input: { title: string; start_date: string | null; skip_weekends: boolean; rest_days?: string[] },
  rows: ProblemInput[],
) => rpc<Sprint>("createSprint", { input, rows });

/**
 * Builds (but does not save) a sprint plan from a natural-language goal (Gemini on Vertex AI, server-side).
 * The server falls back to a built-in planner when AI is off or fails (`ai: false`). When the goal leaves settings
 * out, the first call returns clarifying questions; send `goal` + `answers` (or `skip_questions`) to get the plan.
 */
export const generateSprint = (args: GenerateRequest) => postAi<GenerateResult>("/api/ai/generate", args);

export async function updateSprint(id: string, patch: SprintPatch) {
  await rpc("updateSprint", { id, patch });
}

export async function deleteSprint(id: string) {
  await rpc("deleteSprint", { id });
}

export async function updateProblem(id: string, patch: ProblemPatch) {
  await rpc("updateProblem", { id, patch });
}

export async function reschedule(changes: DayChange[]) {
  if (changes.length) await rpc("reschedule", { changes });
}

export const listSavedFilters = () => rpc<SavedFilter[]>("listSavedFilters");

export const createSavedFilter = (name: string, query: Record<string, unknown>) => rpc<SavedFilter>("createSavedFilter", { name, query });

export async function deleteSavedFilter(id: string) {
  await rpc("deleteSavedFilter", { id });
}

export const listPublicSheets = () => rpc<PublicSheet[]>("listPublicSheets");

/** Public catalogue for one sheet, or null if it doesn't exist / isn't public. */
export const getPublicSheet = (id: string) => rpc<{ sheet: PublicSheet; problems: PublicProblem[] } | null>("getPublicSheet", { id });

/** Copies a public sheet into the caller's account; returns the new sprint id. */
export const copyPublicSheet = (id: string) => rpc<string>("copyPublicSheet", { id });

/** Public sheets most similar to `id` (empty until it has been embedded). */
export const similarSheets = (id: string, k = 6) => rpc<PublicSheet[]>("similarSheets", { id, k });

/** Public sheets closest to your saved goal (empty without a goal). */
export const recommendedSheets = (k = 6) => rpc<PublicSheet[]>("recommendedSheets", { k });

export interface GoalState {
  goal: string | null;
  /** False when the server has AI turned off; the goal UI hides itself. */
  enabled: boolean;
}

export async function getGoal(): Promise<GoalState> {
  const res = await fetch("/api/me/goal", { credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as { data?: GoalState; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as GoalState;
}

/** Saves your study goal (embedded on the server). An empty string clears it. */
export async function saveGoal(goal: string): Promise<string | null> {
  const res = await fetch("/api/me/goal", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ goal }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { goal: string | null }; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data?.goal ?? null;
}

/** Your readiness report for a sprint, or null if you haven't generated one. */
export const getMyShareReport = (id: string) => rpc<ShareReportResponse | null>("getMyShareReport", { id });

/** Copies a shared sprint into your account (returns your existing copy if you already cloned it). */
export const cloneSharedSprint = (slug: string) => rpc<string>("cloneSharedSprint", { slug });

/** Builds (or refreshes) the shareable readiness report for one of your sprints. The slug survives regeneration. */
export async function generateShareReport(sprintId: string): Promise<ShareReportResponse> {
  return shareRequest<ShareReportResponse>("POST", sprintId);
}

/** Deletes the report: the share link, image and clone link stop working. */
export async function stopSharing(sprintId: string) {
  await shareRequest("DELETE", sprintId);
}

async function shareRequest<T>(method: "POST" | "DELETE", sprintId: string): Promise<T> {
  const res = await fetch("/api/share/report", {
    method,
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ sprintId }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export const listMyGroups = () => rpc<MyGroup[]>("listMyGroups");

/** Group + roster, or null when you're not a member (RLS hides it). */
export const getGroup = (id: string) => rpc<{ group: Group; members: GroupMember[] } | null>("getGroup", { id });

export const groupPreview = (code: string) => rpc<GroupPreview | null>("groupPreview", { code });

export const createGroup = (sprintId: string, name: string, me: { name: string; avatar: string | null }) =>
  rpc<string>("createGroup", { sprintId, name, me });

/** Joins via invite code; links `existingSprint` (a copy of the sheet) instead of copying when given. */
export const joinGroup = (code: string, me: { name: string; avatar: string | null }, existingSprint?: string) =>
  rpc<string>("joinGroup", { code, me, existingSprint: existingSprint ?? null });

export const groupProgress = (groupId: string) => rpc<GroupProgressRow[]>("groupProgress", { groupId });

/** What members completed in the last week: names and times only. */
export const groupActivity = (groupId: string) => rpc<GroupActivityRow[]>("groupActivity", { groupId });

export const groupReactions = (groupId: string, sinceDay: string) => rpc<GroupReaction[]>("groupReactions", { groupId, sinceDay });

/** Clap for a member's day, or take the clap back. */
export async function toggleReaction(groupId: string, targetUser: string, day: string) {
  await rpc("toggleReaction", { groupId, targetUser, day });
}

/** Nudge a teammate, optionally with a short message (≤ 140 chars, only they can read it). */
export async function sendNudge(groupId: string, targetUser: string, message?: string | null) {
  await rpc("sendNudge", { groupId, targetUser, message: message ?? null });
}

/** Weekly group digest: facts computed server-side, worded by Gemini (or a template when AI is off). */
export const groupDigest = (groupId: string, today: string) => postAi<GroupDigest | null>("/api/ai/digest", { groupId, today });

export const myNudges = () => rpc<MyNudge[]>("myNudges");

export async function markNudgesSeen() {
  await rpc("markNudgesSeen");
}

export async function leaveGroup(groupId: string) {
  await rpc("leaveGroup", { groupId });
}

export async function removeMember(groupId: string, userId: string) {
  await rpc("removeMember", { groupId, userId });
}

export async function deleteGroup(groupId: string) {
  await rpc("deleteGroup", { groupId });
}

/** Interprets a typed sentence as filters for the current sheet (Gemini on Vertex AI). Only facet names are sent. */
export const aiFilters = (text: string, facets: FacetNames) => postAi<AiFilters>("/api/ai/filters", { text, facets });

/**
 * AI review of a problem's notes (complexity, edge cases, missing tags) via Gemini on Vertex AI, server-side.
 * The server falls back to the built-in analyzer when AI is off or fails (`ai: false`). `signal` cancels the request.
 */
export async function analyzeNote(problem: ReviewProblem, notes: string, signal?: AbortSignal): Promise<ReviewResponse> {
  if (!notes.trim()) throw new Error("Write your approach or paste your code first.");
  if (notes.length > MAX_NOTES) throw new Error("This note is too long to analyze.");
  return postAi<ReviewResponse>("/api/ai/review", { problem, notes }, signal);
}

/** Daily Recall: one question built from your own notes on a problem solved `daysAgo` days ago. */
export const recallQuestion = (problem: RecallProblem, notes: string, daysAgo: number, signal?: AbortSignal) =>
  postAi<RecallResponse>("/api/ai/recall", { mode: "recall", problem, notes: notes.slice(0, MAX_RECALL_NOTES), daysAgo }, signal);

/** Theory viva: two rapid-fire interview questions on a DBMS/OOPS/OS/CN topic. */
export const vivaQuestions = (problem: RecallProblem, notes: string, signal?: AbortSignal) =>
  postAi<VivaResponse>("/api/ai/recall", { mode: "viva", problem, notes: notes.slice(0, MAX_RECALL_NOTES) }, signal);

/** POSTs JSON to an `/api/ai/*` route and unwraps `{ data }`. Throws with the server's message. */
async function postAi<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

/**
 * Asks the backlog coach for a proposed reschedule. Nothing is saved; apply `changes` with `reschedule` after approval.
 * The server loads the sprint itself and sends Gemini only summary statistics.
 */
export async function coachPlan(sprintId: string, today: string): Promise<CoachPlan> {
  const res = await fetch("/api/ai/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ sprintId, today }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: CoachPlan; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as CoachPlan;
}

/** Saves the theme accent on your account. */
export async function saveAccent(accent: string) {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ accent }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Request failed");
}
