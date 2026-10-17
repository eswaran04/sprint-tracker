"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccent, type AccentId } from "@/lib/accents";
import { saveAccent } from "@/lib/api";

const root = () => document.documentElement;

/** Set the accent on <html> and cache it for the no-flash init script. Unknown ids are ignored. */
export function applyAccent(id: unknown) {
  if (!isAccent(id)) return;
  root().setAttribute("data-accent", id);
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode) — the attribute still applies for this session.
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-accent"] });
  return () => observer.disconnect();
}

const read = (): AccentId => {
  const v = root().getAttribute("data-accent");
  return isAccent(v) ? v : DEFAULT_ACCENT;
};

export function useAccent({ syncToAccount = false } = {}) {
  const accent = useSyncExternalStore(subscribe, read, () => DEFAULT_ACCENT);

  const setAccent = useCallback(
    (id: AccentId) => {
      applyAccent(id);
      if (!syncToAccount) return;
      saveAccent(id).catch((e: Error) => toast.error("Couldn't save theme to your account", { description: e.message }));
    },
    [syncToAccount],
  );

  return [accent, setAccent] as const;
}
