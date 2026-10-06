"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Bell, Check, ChevronRight, Crown, Flame, LogOut, Search, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyChip } from "@/components/sprint/chips";
import { FacetSelect } from "@/components/sprint/facet-select";
import { useSessionUser } from "@/components/shell/session-user";
import { useGroupActivity, useGroupProgress, useToggleReaction } from "@/hooks/use-groups";
import { useSprint } from "@/hooks/use-sprint";
import { deleteGroup, leaveGroup, removeMember, sendNudge } from "@/lib/api";
import { applyFilters, DEFAULT_FILTERS, facets as getFacets, isFiltering, type Filters } from "@/lib/filters";
import { problemKey, type LeaderboardRow } from "@/lib/groups";
import type { GroupMember, Problem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { CopyInvite } from "./group-button";
import { MemberAvatar, PeopleStack } from "./member-avatar";

function Leaderboard({ groupId, board, total, me, isOwner, nudged, onRemove, onNudge }: {
  groupId: string; board: LeaderboardRow[]; total: number; me?: string; isOwner: boolean; nudged: Set<string>;
  onRemove: (m: GroupMember) => void; onNudge: (m: GroupMember) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card/40">
      <h2 className="border-b px-5 py-3 text-sm font-semibold">Leaderboard</h2>
      <ol>
        {board.map((r, i) => {
          const pct = total ? (r.done / total) * 100 : 0;
          return (
            <li key={r.member.user_id} className={cn("group flex items-center gap-3 border-b px-5 py-3 last:border-b-0", r.member.user_id === me && "bg-primary/5")}>
              <span className={cn("w-5 text-center text-sm font-semibold tabular-nums", i === 0 && r.done > 0 ? "text-core" : "text-muted-foreground")}>{i + 1}</span>
              <Link href={`/app/groups/${groupId}/members/${r.member.user_id}`} className="shrink-0" tabIndex={-1} aria-hidden>
                <MemberAvatar member={r.member} className="size-8" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <Link href={`/app/groups/${groupId}/members/${r.member.user_id}`} className="truncate hover:text-primary hover:underline">
                    {r.member.display_name}
                  </Link>
                  {r.member.user_id === me && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  {r.member.role === "owner" && <Crown className="size-3.5 text-core" aria-label="Owner" />}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 max-w-56 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{r.done}/{total}</span>
                </div>
              </div>
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <p><span className="font-medium text-foreground tabular-nums">{r.doneToday}</span> today</p>
                <p>{r.lastActive ? `active ${formatDistanceToNow(new Date(r.lastActive), { addSuffix: true })}` : "not started"}</p>
              </div>
              <span className={cn("flex w-10 items-center justify-end gap-0.5 text-sm tabular-nums", r.streak ? "text-core" : "text-muted-foreground/50")} title="Current streak">
                <Flame className="size-3.5" /> {r.streak}
              </span>
              {r.member.user_id !== me && r.doneToday === 0 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  disabled={nudged.has(r.member.user_id)}
                  onClick={() => onNudge(r.member)}
                  aria-label={`${nudged.has(r.member.user_id) ? "Nudged" : "Nudge"} ${r.member.display_name}`}
                  title={nudged.has(r.member.user_id) ? "Nudge sent" : "Nudge to get going today"}
                >
                  {nudged.has(r.member.user_id) ? <Check /> : <Bell />}
                </Button>
              )}
              {isOwner && r.member.user_id !== me && (
                <Button variant="ghost" size="icon-xs" className="text-muted-foreground opacity-0 group-hover:opacity-100 max-md:opacity-100" onClick={() => onRemove(r.member)} aria-label={`Remove ${r.member.display_name}`}>
                  <UserMinus />
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Matrix({ problems, members, index, me }: {
  problems: Problem[]; members: GroupMember[]; index: Map<string, Map<string, string>>; me?: string;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = useMemo(() => applyFilters(problems, { ...filters, status: "all" }), [problems, filters]);
  const fx = useMemo(() => getFacets(problems), [problems]);
  const expandAll = isFiltering(filters);

  // Starting or clearing a filter resets hand toggles so filtered matches start expanded.
  const [prevExpandAll, setPrevExpandAll] = useState(expandAll);
  if (prevExpandAll !== expandAll) {
    setPrevExpandAll(expandAll);
    setOverrides(new Map());
  }

  const sprints = useMemo(() => {
    const m = new Map<number, Problem[]>();
    for (const p of filtered) m.set(p.sprint_no, [...(m.get(p.sprint_no) ?? []), p]);
    return [...m].sort(([a], [b]) => a - b);
  }, [filtered]);

  const isOpenFor = (n: number) => overrides.get(n) ?? (expandAll || n === problems[0]?.sprint_no);
  const toggle = (n: number) => setOverrides((m) => new Map(m).set(n, !isOpenFor(n)));

  const colTemplate = "minmax(0,1fr) 9rem";

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-semibold">Progress by problem</h2>
        <div className="relative min-w-44 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search problems…" className="h-8 pl-8" />
        </div>
        <FacetSelect label="Company" facets={fx.companies} value={filters.companies} onChange={(companies) => set({ companies })} />
        <FacetSelect label="Topic" facets={fx.topics} value={filters.topics} onChange={(topics) => set({ topics })} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card/30">
        <div>
          <div className="sticky top-0 z-10 grid items-center border-b bg-background/90 text-xs font-medium text-muted-foreground backdrop-blur" style={{ gridTemplateColumns: colTemplate }}>
            <span className="px-4 py-2">Problem</span>
            <span className="px-4 py-2 text-right">Completed by</span>
          </div>

          {sprints.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No problems match.</p>}
          {sprints.map(([sprint, ps]) => {
            const isOpen = isOpenFor(sprint);
            return (
              <div key={sprint} className="border-b last:border-b-0">
                <button onClick={() => toggle(sprint)} aria-expanded={isOpen} className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:text-primary">
                  <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                  Sprint {sprint}
                  <span className="text-xs font-normal text-muted-foreground">{ps.length} problems</span>
                </button>
                {isOpen && ps.map((p) => {
                  const done = index.get(problemKey(p));
                  return (
                    <div key={p.id} className="grid items-center border-t border-border/50 hover:bg-muted/30" style={{ gridTemplateColumns: colTemplate }}>
                      <span className="flex min-w-0 items-center gap-2 px-4 py-2">
                        <span className="w-9 shrink-0 text-[11px] text-muted-foreground tabular-nums">D{p.original_day_no}</span>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sm hover:text-primary hover:underline">{p.name}</a>
                        ) : (
                          <span className="truncate text-sm">{p.name}</span>
                        )}
                        <DifficultyChip difficulty={p.difficulty} className="shrink-0" />
                      </span>
                      <span className="flex justify-end px-3">
                        <PeopleStack
                          done={members.filter((m) => done?.has(m.user_id)).map((member) => ({ member, doneAt: done!.get(member.user_id)! }))}
                          pending={members.filter((m) => !done?.has(m.user_id))}
                          me={me}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function GroupView({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useSessionUser()?.id;
  const g = useGroupProgress(id);
  const activity = useGroupActivity(id, me);
  const clap = useToggleReaction(id, me);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  // Kept after close so the dialog's copy doesn't blank out mid-animation.
  const [confirming, setConfirming] = useState<{ kind: "delete" } | { kind: "leave" } | { kind: "remove"; member: GroupMember } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ask = (c: NonNullable<typeof confirming>) => { setConfirming(c); setConfirmOpen(true); };
  const mySprintId = g.members.find((m) => m.user_id === me)?.sprint_id;
  const sprint = useSprint(mySprintId ?? "");
  const isOwner = g.group?.owner_id === me;

  // You first, then leaderboard order.
  const columns = useMemo(
    () => [...g.board.map((r) => r.member)].sort((a, b) => Number(b.user_id === me) - Number(a.user_id === me)),
    [g.board, me],
  );

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["groups"] }),
    qc.invalidateQueries({ queryKey: ["group", id] }),
    qc.invalidateQueries({ queryKey: ["group-progress", id] }),
    qc.invalidateQueries({ queryKey: ["group-activity", id] }),
    qc.invalidateQueries({ queryKey: ["group-reactions", id] }),
  ]);
  const action = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onError: (e) => toast.error("Something went wrong", { description: e.message }),
  });

  if (g.isLoading || (mySprintId && sprint.isLoading)) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
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

  const total = sprint.data?.problems.length ?? 0;
  const backToSprint = () => router.push(mySprintId ? `/app/s/${mySprintId}` : "/app");
  const confirmCopy = !confirming ? null
    : confirming.kind === "remove" ? {
      icon: <UserMinus />,
      title: `Remove ${confirming.member.display_name}?`,
      description: "They'll lose access to this group. Their sprint and progress stay with them.",
      confirmLabel: "Remove",
      run: async () => {
        await removeMember(id, confirming.member.user_id);
        await refresh();
        toast.success(`${confirming.member.display_name} removed`);
      },
    } : confirming.kind === "delete" ? {
      icon: <Trash2 />,
      title: "Delete this group?",
      description: "Everyone keeps their own sprint and progress. This can't be undone.",
      confirmLabel: "Delete group",
      run: async () => {
        await deleteGroup(id);
        await refresh();
        toast.success("Group deleted");
        backToSprint();
      },
    } : {
      icon: <LogOut />,
      title: "Leave this group?",
      description: "Your sprint and progress stay with you. You'll need a new invite link to rejoin.",
      confirmLabel: "Leave",
      run: async () => {
        await leaveGroup(id);
        await refresh();
        toast.success("You left the group");
        backToSprint();
      },
    };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-8">
      {mySprintId && (
        <Link href={`/app/s/${mySprintId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> {sprint.data?.sprint.title ?? "Your sprint"}
        </Link>
      )}

      <header className="grid gap-4 rounded-3xl border bg-gradient-to-br from-primary/15 via-card/60 to-card/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{g.group.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{g.members.length} member{g.members.length === 1 ? "" : "s"} · {total} problems</p>
          </div>
          {isOwner ? (
            <Button variant="ghost" className="text-destructive" onClick={() => ask({ kind: "delete" })}>
              <Trash2 /> Delete group
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => ask({ kind: "leave" })}>
              <LogOut /> Leave
            </Button>
          )}
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Invite link</p>
          <CopyInvite code={g.group.invite_code} />
        </div>
      </header>

      <Leaderboard
        groupId={id}
        board={g.board}
        total={total}
        me={me}
        isOwner={isOwner}
        nudged={nudged}
        onNudge={(m) =>
          action.mutate(async () => {
            await sendNudge(id, m.user_id);
            setNudged((s) => new Set(s).add(m.user_id));
            toast.success(`Nudged ${m.display_name}`);
          })
        }
        onRemove={(member) => ask({ kind: "remove", member })}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.confirmLabel ?? ""}
        icon={confirmCopy?.icon}
        destructive
        pending={action.isPending}
        onConfirm={() => confirmCopy && action.mutate(confirmCopy.run, { onSuccess: () => setConfirmOpen(false) })}
      />

      <ActivityFeed
        items={activity.items}
        members={g.members}
        me={me}
        onClap={(item) => clap.mutate({ target: item.user_id, day: item.day })}
      />

      {sprint.data && <Matrix problems={sprint.data.problems} members={columns} index={g.index} me={me} />}
    </div>
  );
}
