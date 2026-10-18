"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import * as api from "@/lib/api";
import type { RecallProblem } from "@/lib/recall/schema";
import type { RecallCandidate } from "@/lib/recall/select";
import type { Problem } from "@/lib/types";

/** The fields the recall/viva routes need (never ids, progress or other problems). */
export const toRecallProblem = ({ name, url, difficulty, subject, topics }: Problem): RecallProblem => ({ name, url, difficulty, subject, topics });

function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode / quota: the preference just won't persist.
  }
}

const vivaKey = (sprintId: string) => `viva:${sprintId}`;
const dismissKey = (sprintId: string, day: string) => `recall:${sprintId}:${day}`;

/** "Viva check on theory topics" preference for a sprint (per device, on by default). */
export const isVivaEnabled = (sprintId: string) => readStorage(vivaKey(sprintId)) !== "off";
export const setVivaEnabled = (sprintId: string, on: boolean) => writeStorage(vivaKey(sprintId), on ? null : "off");

/** Whether today's warmup was skipped or finished on this device. */
export function useRecallDismissed(sprintId: string, day: string) {
  const key = dismissKey(sprintId, day);
  const [dismissed, setDismissed] = useState(() => readStorage(key) === "1");
  const dismiss = useCallback(() => {
    writeStorage(key, "1");
    setDismissed(true);
  }, [key]);
  return [dismissed, dismiss] as const;
}

/** The recall question for one candidate. Cached for the day: the question shouldn't change while you answer it. */
export function useRecallQuestion(c: RecallCandidate | undefined, day: string) {
  return useQuery({
    queryKey: ["recall", c?.problem.id, day],
    queryFn: ({ signal }) => api.recallQuestion(toRecallProblem(c!.problem), c!.problem.notes ?? "", c!.daysAgo, signal),
    enabled: Boolean(c),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** The two viva questions for a theory topic, fetched only while the check is running. */
export function useVivaQuestions(p: Problem | null, enabled: boolean) {
  return useQuery({
    queryKey: ["viva", p?.id],
    queryFn: ({ signal }) => api.vivaQuestions(toRecallProblem(p!), p!.notes ?? "", signal),
    enabled: Boolean(p) && enabled,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
