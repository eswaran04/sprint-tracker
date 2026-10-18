"use client";

import { format, parseISO } from "date-fns";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { CoachPlan } from "@/lib/api";
import { isPlanStale, summarizePlan } from "@/lib/coach/diff";
import type { Problem } from "@/lib/types";
import { DifficultyChip } from "./chips";

const COLLAPSED_DAYS = 5;

function DayLabel({ day, date }: { day: number; date: string | null }) {
  return (
    <span className="font-medium">
      Day {day}
      {date && <span className="ml-1.5 font-normal text-muted-foreground">{format(parseISO(date), "EEE, MMM d")}</span>}
    </span>
  );
}

export function CoachDialog({
  open, onOpenChange, plan, isPending, applying, problems, dateFor, onRegenerate, onApprove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CoachPlan | null;
  isPending: boolean;
  applying: boolean;
  problems: Problem[];
  dateFor: (day: number) => string | null;
  onRegenerate: () => void;
  onApprove: (plan: CoachPlan) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const view = useMemo(() => {
    if (!plan) return null;
    const diff = summarizePlan(problems, plan.changes, plan.summary.reviewDays);
    const reviewSet = new Set(plan.summary.reviewDays);
    // One entry per destination day that gains a problem, plus review days.
    const next = new Map(plan.changes.map((c) => [c.id, c.day_no]));
    const days = [...new Set([...diff.byDay.map((d) => d.day), ...plan.summary.reviewDays])].sort((a, b) => a - b);
    const rows = days
      .map((day) => ({
        day,
        review: reviewSet.has(day),
        arrivals: (diff.byDay.find((d) => d.day === day)?.after ?? []).filter((p) => next.has(p.id) && next.get(p.id) !== p.day_no),
      }))
      .filter((r) => r.review || r.arrivals.length);
    return { rows, stale: isPlanStale(plan.summary.from, problems) };
  }, [plan, problems]);

  const loading = isPending && !plan;
  const rows = view?.rows ?? [];
  const shown = showAll ? rows : rows.slice(0, COLLAPSED_DAYS);
  const noop = plan != null && plan.changes.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Smart reschedule
          </DialogTitle>
          <DialogDescription>
            {loading ? "Looking at your pace and notes…" : plan ? plan.summary.label : "Couldn't build a plan."}
            {plan && !plan.aiUsed && (
              <Badge variant="secondary" className="ml-2 align-middle">Rule-based plan</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2" aria-label="Generating plan">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : plan && view ? (
          <div className="flex min-w-0 flex-col gap-3 text-sm">
            {plan.rationale.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {plan.rationale.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}

            {!noop && (
              <ScrollArea className="max-h-72 rounded-xl border">
                <ol className="divide-y">
                  {shown.map((r) => (
                    <li key={r.day} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <DayLabel day={r.day} date={dateFor(r.day)} />
                        {r.review && <Badge variant="outline">📖 Review day</Badge>}
                      </div>
                      {r.arrivals.length > 0 && (
                        <ul className="mt-1 space-y-1">
                          {r.arrivals.map((p) => (
                            <li key={p.id} className="flex min-w-0 items-center gap-2 text-xs">
                              <DifficultyChip difficulty={p.difficulty} />
                              <span className="min-w-0 flex-1 truncate">{p.name}</span>
                              <span className="flex shrink-0 items-center gap-1 text-muted-foreground tabular-nums">
                                Day {p.day_no} <ArrowRight className="size-3" /> Day {r.day}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            )}
            {rows.length > COLLAPSED_DAYS && (
              <button onClick={() => setShowAll((v) => !v)} className="self-start text-xs text-primary hover:underline">
                {showAll ? "Show less" : `Show all ${rows.length} days`}
              </button>
            )}

            {!noop && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Plain shift would move {plan.plainShift.moved} problem{plan.plainShift.moved === 1 ? "" : "s"} and end on Day{" "}
                {plan.plainShift.newEnd}; this plan ends on Day {plan.summary.newEnd}.
              </p>
            )}

            {view.stale && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Plan is out of date, regenerate.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={onRegenerate} disabled={isPending || applying}>
            <RefreshCw className={isPending ? "animate-spin" : undefined} /> Regenerate
          </Button>
          <Button
            onClick={() => plan && onApprove(plan)}
            disabled={!plan || isPending || applying || noop || Boolean(view?.stale)}
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
