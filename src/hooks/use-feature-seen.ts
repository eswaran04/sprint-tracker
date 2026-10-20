"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AiFeature =
  | "smart-reschedule"
  | "ai-search"
  | "sheet-generator"
  | "daily-warmup"
  | "code-review"
  | "readiness-report"
  | "group-digest";

const key = (f: AiFeature) => `aibc:feature-seen:${f}`;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
};
const read = (f: AiFeature) => {
  try {
    return localStorage.getItem(key(f)) === "1";
  } catch {
    return true; // storage blocked: don't nag
  }
};

export function markFeatureSeen(feature: AiFeature): void {
  if (read(feature)) return;
  try {
    localStorage.setItem(key(feature), "1");
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

/** Whether the user has tried an AI feature yet — drives the "New" badges. Server render assumes seen (no flash). */
export function useFeatureSeen(feature: AiFeature) {
  const seen = useSyncExternalStore(subscribe, () => read(feature), () => true);
  const markSeen = useCallback(() => markFeatureSeen(feature), [feature]);
  return [seen, markSeen] as const;
}
