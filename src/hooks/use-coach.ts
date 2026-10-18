"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { coachPlan, type CoachPlan } from "@/lib/api";
import { isPlanStale } from "@/lib/coach/diff";
import { todayIso } from "@/lib/coach/signals";
import type { Problem, Sprint } from "@/lib/types";
import { sprintKey, useProblemMutations } from "./use-sprint";

export const STALE_PLAN_MESSAGE = "Plan is out of date, regenerate";

/**
 * Smart reschedule for one sprint: `generate()` asks the server for a proposal, `approve(plan)` applies it through
 * the regular optimistic `reschedule` mutation — but only if nothing it touches changed since it was generated.
 */
export function useCoach(sprintId: string) {
  const qc = useQueryClient();
  const { reschedule } = useProblemMutations(sprintId);
  const [applying, setApplying] = useState(false);

  const mutation = useMutation({
    mutationFn: () => coachPlan(sprintId, todayIso()),
    onError: (e) => toast.error("Couldn't build a plan", { description: e.message }),
  });

  const { mutate, reset } = mutation;
  const generate = useCallback(() => mutate(), [mutate]);

  /** Resolves true when applied; false when stale or failed (the dialog stays open). */
  const approve = useCallback(
    async (plan: CoachPlan): Promise<boolean> => {
      const cached = qc.getQueryData<{ sprint: Sprint; problems: Problem[] }>(sprintKey(sprintId));
      if (!cached || isPlanStale(plan.summary.from, cached.problems)) {
        toast.error(STALE_PLAN_MESSAGE);
        return false;
      }
      if (!plan.changes.length) return true;
      setApplying(true);
      try {
        await reschedule(plan.changes);
        toast.success(plan.summary.label, { description: "Your plan has been rescheduled." });
        return true;
      } catch {
        return false; // the mutation already rolled back and toasted
      } finally {
        setApplying(false);
      }
    },
    [qc, sprintId, reschedule],
  );

  return {
    plan: mutation.data ?? null,
    isPending: mutation.isPending,
    error: mutation.error,
    applying,
    generate,
    approve,
    reset,
  };
}
