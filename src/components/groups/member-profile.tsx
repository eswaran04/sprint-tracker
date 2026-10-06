"use client";

import { format, formatDistanceToNow, parseISO, subDays } from "date-fns";
import { ArrowLeft, CalendarDays, Crown, Flame, Medal, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyChip } from "@/components/sprint/chips";
import { useSessionUser } from "@/components/shell/session-user";
import { ActivityStrip, BreakdownBars, Panel, Tile } from "@/components/stats/stats-parts";
import { useGroupProgress } from "@/hooks/use-groups";
import { useSprint } from "@/hooks/use-sprint";
import { yearOptions } from "@/lib/calendar";
import { formatSubject } from "@/lib/format";
import { asMember, headToHead, recentSolves } from "@/lib/groups";
import { breakdown, heatmap, streaks, toLocalDate } from "@/lib/stats";
import type { Problem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";

function profileStats(problems: Problem[], today: string) {
  const doneAts = problems.flatMap((p) => (p.done_at ? [p.done_at] : []));
  const weekStart = format(subDays(parseISO(today), 6), "yyyy-MM-dd");
  return {
    done: doneAts.length,
    streak: streaks(doneAts, today),
    week: doneAts.filter((d) => toLocalDate(d) >= weekStart).length,
    doneAts,
  };
}

/** Solved problems with when they were solved; collapses past `limit`. */
function SolvedList({ problems, limit = 10 }: { problems: Problem[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? problems : problems.slice(0, limit);
  return (
    <>
      <ul className="grid">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-2 border-b border-border/50 py-2 text-sm last:border-b-0">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:text-primary hover:underline">{p.name}</a>
            ) : (
              <span className="truncate">{p.name}</span>
            )}
            <DifficultyChip difficulty={p.difficulty} className="shrink-0" />
            <span className="ml-auto shrink-0 text-xs text-muted-foreground" title={format(new Date(p.done_at!), "PPp")}>
              {formatDistanceToNow(new Date(p.done_at!), { addSuffix: true })}
            </span>
          </li>
        ))}
      </ul>
      {problems.length > limit && (
        <button onClick={() => setAll((v) => !v)} className="mt-2 text-xs text-primary hover:underline">
          {all ? "Show less" : `Show all ${problems.length}`}
        </button>
      )}
    </>
  );
}

function Versus({ label, mine, theirs, unit = "" }: { label: string; mine: number; theirs: number; unit?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
      <span className={cn("text-right tabular-nums", mine > theirs ? "font-semibold text-foreground" : "text-muted-foreground")}>{mine}{unit}</span>
      <span className="w-24 text-center text-xs text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", theirs > mine ? "font-semibold text-foreground" : "text-muted-foreground")}>{theirs}{unit}</span>
    </div>
  );
}

export function MemberProfile({ groupId, userId }: { groupId: string; userId: string }) {
  const me = useSessionUser()?.id;
  const g = useGroupProgress(groupId);
  const mySprintId = g.members.find((m) => m.user_id === me)?.sprint_id;
  const sprint = useSprint(mySprintId ?? "");
  const today = format(new Date(), "yyyy-MM-dd");
  const rank = g.board.findIndex((r) => r.member.user_id === userId);
  const member = g.board[rank]?.member;

  const s = useMemo(() => {
    const problems = sprint.data?.problems;
    if (!problems || !member) return null;
    const theirs = asMember(problems, g.index, userId);
    const them = profileStats(theirs, today);
    return {
      theirs,
      them,
      you: me && me !== userId ? { ...profileStats(problems, today), ...headToHead(problems, theirs) } : null,
      heat: heatmap(them.doneAts),
      years: yearOptions(them.doneAts.map(toLocalDate), toLocalDate(member.joined_at), today),
      recent: recentSolves(theirs),
      difficulty: breakdown(theirs, (p) => [p.difficulty ?? "Unrated"]),
      subjects: breakdown(theirs, (p) => [formatSubject(p.subject || "other")]),
      topics: breakdown(theirs, (p) => p.topics),
    };
  }, [sprint.data, member, g.index, userId, me, today]);

  if (g.isLoading || (mySprintId && sprint.isLoading)) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-8">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (g.notFound || !g.group) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="font-medium">This group isn&apos;t available</p>
        <p className="mt-1 text-sm text-muted-foreground">You may not be a member, or it was deleted. Ask for an invite link.</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/app">Back to your sprints</Link></Button>
      </div>
    );
  }
  if (!member || !s) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="font-medium">Member not found</p>
        <p className="mt-1 text-sm text-muted-foreground">They may have left the group.</p>
        <Button asChild variant="outline" className="mt-4"><Link href={`/app/groups/${groupId}`}>Back to {g.group.name}</Link></Button>
      </div>
    );
  }

  const total = s.theirs.length;
  const pct = total ? Math.round((s.them.done / total) * 100) : 0;
  const isMe = userId === me;
  const lastActive = s.recent[0]?.done_at;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 p-4 sm:p-8">
      <Link href={`/app/groups/${groupId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {g.group.name}
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-3xl border bg-gradient-to-br from-primary/15 via-card/60 to-card/30 p-6">
        <MemberAvatar member={member} className="size-16 text-2xl" />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {member.display_name}
            {isMe && <span className="text-sm font-normal text-muted-foreground">(you)</span>}
            {member.role === "owner" && <Crown className="size-4 text-core" aria-label="Owner" />}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> Joined {format(new Date(member.joined_at), "MMM d, yyyy")}</span>
            <span>{lastActive ? `Active ${formatDistanceToNow(new Date(lastActive), { addSuffix: true })}` : "Not started"}</span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={Target} label="Completed" value={`${pct}%`} sub={`${s.them.done} of ${total} problems`} />
        <Tile icon={Flame} label="Current streak" value={`${s.them.streak.current}d`} sub={`Longest: ${s.them.streak.longest} days`} />
        <Tile icon={Trophy} label="This week" value={String(s.them.week)} sub="solved in the last 7 days" />
        <Tile icon={Medal} label="Rank" value={`#${rank + 1}`} sub={`of ${g.board.length} in ${g.group.name}`} />
      </div>

      {s.them.done === 0 ? (
        <p className="rounded-2xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">{member.display_name} hasn&apos;t solved anything yet.</p>
      ) : (
        <>
          <ActivityStrip counts={s.heat} today={today} years={s.years} />

          {s.you && (
            <Panel title={`You vs ${member.display_name}`}>
              <div className="grid gap-2">
                <Versus label="Solved" mine={s.you.done} theirs={s.them.done} />
                <Versus label="Streak" mine={s.you.streak.current} theirs={s.them.streak.current} unit="d" />
                <Versus label="This week" mine={s.you.week} theirs={s.them.week} />
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Both solved <span className="font-medium text-foreground tabular-nums">{s.you.both}</span> · you&apos;re ahead on{" "}
                <span className="font-medium text-foreground tabular-nums">{s.you.meOnly}</span>
              </p>
              {s.you.theyOnly.length > 0 && (
                <section aria-label="They solved, you haven't" className="mt-5">
                  <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                    They solved, you haven&apos;t <span className="tabular-nums">({s.you.theyOnly.length})</span>
                  </h3>
                  <SolvedList problems={s.you.theyOnly} />
                </section>
              )}
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Recent solves" className="lg:row-span-2"><SolvedList problems={s.recent} /></Panel>
            <Panel title="By difficulty"><BreakdownBars rows={s.difficulty} /></Panel>
            {s.subjects.length > 1 && <Panel title="By subject"><BreakdownBars rows={s.subjects} /></Panel>}
            {s.topics.length > 0 && <Panel title="Top topics"><BreakdownBars rows={s.topics} /></Panel>}
          </div>
        </>
      )}
    </div>
  );
}
