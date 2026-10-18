"use client";

import { useSyncExternalStore } from "react";
import { AI_TOUR_STEPS } from "@/components/ai-tour/ai-tour-data";

const TOUR_SEEN_KEY = "aibc:ai-tour-completed";
const getMaxStep = () => Math.max(0, AI_TOUR_STEPS.length - 1);

interface TourState {
  isOpen: boolean;
  step: number;
  direction: number; // 1 for next, -1 for prev
}

let state: TourState = {
  isOpen: false,
  step: 0,
  direction: 1,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function hasSeenAiTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markAiTourSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // ignore
  }
}

export function openAiTour(step = 0): void {
  state = {
    isOpen: true,
    step: Math.max(0, Math.min(step, getMaxStep())),
    direction: 1,
  };
  emit();
}

export function closeAiTour(): void {
  state = {
    ...state,
    isOpen: false,
  };
  markAiTourSeen();
  emit();
}

export function nextAiTourStep(): void {
  if (state.step < getMaxStep()) {
    state = {
      ...state,
      step: state.step + 1,
      direction: 1,
    };
    emit();
  } else {
    closeAiTour();
  }
}

export function prevAiTourStep(): void {
  if (state.step > 0) {
    state = {
      ...state,
      step: state.step - 1,
      direction: -1,
    };
    emit();
  }
}

export function setAiTourStep(step: number): void {
  const target = Math.max(0, Math.min(step, getMaxStep()));
  if (target === state.step) return;
  state = {
    ...state,
    step: target,
    direction: target > state.step ? 1 : -1,
  };
  emit();
}

export function useAiTourState(): TourState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
