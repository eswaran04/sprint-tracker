"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Target, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGoal, recommendedSheets, saveGoal } from "@/lib/api";
import { SheetCard } from "./sheet-card";

const MAX_GOAL = 300;

/**
 * "Recommended for your goal" above the Explore grid. Hidden entirely when the server has AI turned off.
 * Without a goal it shows only a one-line goal input; with one, the closest public sheets by embedding.
 */
export function RecommendedSheets() {
  const qc = useQueryClient();
  const { data: goalState } = useQuery({ queryKey: ["goal"], queryFn: getGoal, retry: false, staleTime: Infinity });
  const goal = goalState?.goal ?? null;
  const { data: sheets, isFetching } = useQuery({
    queryKey: ["recommended-sheets", goal],
    queryFn: () => recommendedSheets(3),
    enabled: Boolean(goal),
    retry: false,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const save = useMutation({
    mutationFn: (text: string) => saveGoal(text),
    onSuccess: (saved) => {
      qc.setQueryData(["goal"], { goal: saved, enabled: true });
      setEditing(false);
    },
    onError: (e) => toast.error("Couldn't save your goal", { description: e.message }),
  });

  if (!goalState?.enabled) return null;

  const showInput = !goal || editing;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text && text !== goal) save.mutate(text);
    else setEditing(false);
  };

  return (
    <section aria-labelledby="recommended-sheets" className="mb-6 grid gap-3 rounded-2xl border bg-card/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="recommended-sheets" className="flex items-center gap-1.5 text-sm font-semibold">
          <Target className="size-4 text-primary" /> {goal ? "Recommended for your goal" : "Get recommendations"}
        </h2>
        {goal && !editing && (
          <>
            <span className="min-w-0 truncate text-sm text-muted-foreground">“{goal}”</span>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Edit goal" onClick={() => { setDraft(goal); setEditing(true); }}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Clear goal" onClick={() => save.mutate("")} disabled={save.isPending}>
              <X className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      {showInput && (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_GOAL}
            placeholder="Your goal, e.g. FAANG SDE2 in 8 weeks, weak at DP"
            aria-label="Your study goal"
            className="h-8"
            autoFocus={editing}
          />
          <Button type="submit" size="sm" disabled={save.isPending || !draft.trim()}>
            {save.isPending && <Loader2 className="animate-spin" />} Save goal
          </Button>
          {editing && <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>}
        </form>
      )}

      {goal && !editing && sheets && sheets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((s) => <SheetCard key={s.id} sheet={s} />)}
        </div>
      )}
      {goal && !editing && !isFetching && sheets?.length === 0 && (
        <p className="text-sm text-muted-foreground">No matching sheets yet. Check back as more sheets are published.</p>
      )}
    </section>
  );
}
