import type {
  Group, GroupActivityRow, GroupMember, GroupPreview, GroupProgressRow, GroupReaction, MyGroup, MyNudge, Problem, ProblemInput, PublicProblem,
  PublicSheet, SavedFilter, Sprint,
} from "@/lib/types";
import type { AiFilters, FacetNames } from "@/lib/ai/nl-filters";

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

export const createSprint = (input: { title: string; start_date: string | null; skip_weekends: boolean }, rows: ProblemInput[]) =>
  rpc<Sprint>("createSprint", { input, rows });

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

export async function sendNudge(groupId: string, targetUser: string) {
  await rpc("sendNudge", { groupId, targetUser });
}

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
export async function aiFilters(text: string, facets: FacetNames): Promise<AiFilters> {
  const res = await fetch("/api/ai/filters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ text, facets }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: AiFilters; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as AiFilters;
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
