"use client";

import { format, parseISO } from "date-fns";
import { BarChart3, CalendarClock, FastForward, Globe, Settings2, Share2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProgressRing } from "@/components/progress-ring";
import { GroupButton } from "@/components/groups/group-button";
import type { Sprint } from "@/lib/types";

export interface HeaderStats {
  total: number;
  done: number;
  today: { day: number; date: string | null; total: number; done: number; isWorkingDay: boolean } | null;
  overdue: number;
  shiftCount: number;
}

export function SprintHeader({ sprint, stats, onSettings, onShift, onJumpToday, children }: {
  sprint: Sprint; stats: HeaderStats; onSettings: () => void; onShift: () => Promise<unknown>; onJumpToday: () => void;
  /** Rendered between the title row and the Today banner (e.g. the Daily Recall warmup). */
  children?: React.ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="relative hidden sm:block">
          <ProgressRing value={stats.total ? stats.done / stats.total : 0} size={56} stroke={5} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{sprint.title}</h1>
            {sprint.visibility === "public" && (
              <Link
                href={`/app/sheets/${sprint.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/25"
              >
                <Globe className="size-3" /> Public{sprint.copy_count > 0 && ` · ${sprint.copy_count} cop${sprint.copy_count === 1 ? "y" : "ies"}`}
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {stats.done} of {stats.total} done
            {sprint.start_date && <> · started {format(parseISO(sprint.start_date), "MMM d, yyyy")}</>}
            {sprint.copied_from && (
              <> · <Link href={`/app/sheets/${sprint.copied_from}`} className="hover:text-foreground hover:underline">copied from a public sheet</Link></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {sprint.visibility === "public" && (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Copy share link"
              className="rounded-lg"
              onClick={async () => {
                await navigator.clipboard.writeText(`${location.origin}/app/sheets/${sprint.id}`);
                toast.success("Share link copied");
              }}
            >
              <Share2 />
            </Button>
          )}
          <GroupButton sprintId={sprint.id} sprintTitle={sprint.title} />
          <Button variant="outline" size="sm" asChild className="rounded-lg">
            <Link href={`/app/s/${sprint.id}/stats`}><BarChart3 /> <span className="max-sm:hidden">Stats</span></Link>
          </Button>
          <Button variant="outline" size="icon-sm" onClick={onSettings} aria-label="Sprint settings" className="rounded-lg">
            <Settings2 />
          </Button>
        </div>
      </div>

      {children}

      {!stats.today ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed bg-card/30 px-4 py-3 text-sm">
          <CalendarClock className="size-4 text-primary" />
          <span className="text-muted-foreground">Set a start date to see what&apos;s due today and track overdue work.</span>
          <Button size="sm" variant="secondary" onClick={onSettings} className="ml-auto rounded-lg">Set start date</Button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-primary/15 via-card/60 to-card/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <button onClick={onJumpToday} className="flex items-center gap-2 text-left hover:underline underline-offset-4">
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground uppercase">
                {stats.today.isWorkingDay ? "Today" : "Up next"}
              </span>
              <span className="font-medium">Day {stats.today.day}</span>
              {stats.today.date && <span className="text-muted-foreground">{format(parseISO(stats.today.date), "EEE, MMM d")}</span>}
            </button>
            <span className="text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">{stats.today.done}/{stats.today.total}</span> done
            </span>
            {stats.overdue > 0 ? (
              <span className="font-medium text-pro tabular-nums">{stats.overdue} overdue</span>
            ) : (
              <span className="text-basic">On track ✓</span>
            )}
            {stats.overdue > 0 && (
              <Button size="sm" onClick={() => setConfirm(true)} className="ml-auto rounded-lg">
                <FastForward /> Shift backlog
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shift the plan forward?</DialogTitle>
            <DialogDescription>
              Your earliest unfinished day moves to today, and every unfinished problem after it slides forward by the same
              number of days — {stats.shiftCount} problem{stats.shiftCount === 1 ? "" : "s"} will move. Completed problems stay where they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button onClick={async () => { setConfirm(false); await onShift(); }}>Shift plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
