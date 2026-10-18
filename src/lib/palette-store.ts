import { useSyncExternalStore } from "react";
import type { Problem } from "@/lib/types";

export interface PaletteContext {
  problems: Problem[];
  onSelectProblem: (p: Problem) => void;
  /** `ai: true` actions are listed under the "AI" group with the gradient sparkle. */
  actions: { id: string; label: string; shortcut?: string; ai?: boolean; run: () => void }[];
  /** When set, ⌘K offers "Filter with AI" for sentence-like input. */
  aiFilter?: (text: string) => Promise<void>;
}

let state: PaletteContext | null = null;
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export const setPaletteContext = (ctx: PaletteContext | null) => ((state = ctx), emit());
export const usePaletteContext = () => useSyncExternalStore(subscribe, () => state, () => null);

export const setPaletteOpen = (v: boolean) => ((open = v), emit());
export const usePaletteOpen = () => useSyncExternalStore(subscribe, () => open, () => false);
