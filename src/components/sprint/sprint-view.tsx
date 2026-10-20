"use client";

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionUser } from "@/components/shell/session-user";
import { useAiFilters } from "@/hooks/use-ai-filters";
import { useCoach } from "@/hooks/use-coach";
import { useAiIntent, useFilters, useView } from "@/hooks/use-filters";
import { useGroupForSprint, useGroupProgress } from "@/hooks/use-groups";
import { problemKey } from "@/lib/groups";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useProblemMutations, useSprint } from "@/hooks/use-sprint";
import { applyFilters, DEFAULT_FILTERS, facets as getFacets, isFiltering, matches, STATUSES, type Filters } from "@/lib/filters";
import { setPaletteContext } from "@/lib/palette-store";
import { buildCalendar, currentPlanDay, makeSprintForDay, shiftBacklog, workingDay, type ScheduleConfig } from "@/lib/schedule";
import type { Problem } from "@/lib/types";
import { isVivaEnabled } from "@/hooks/use-recall";
import { isTheory, pickRecall } from "@/lib/recall/select";
import { DailyRecall } from "./daily-recall";
import { CoachDialog } from "./coach-dialog";
import { FilterBar } from "./filter-bar";
import { MoveDialog } from "./move-dialog";
import { NotesDrawer } from "./notes-drawer";
import { ProblemCard } from "./problem-card";
import { SettingsDialog } from "./settings-dialog";
import { ShortcutsHelp } from "./shortcuts-help";
import { SprintActionsProvider, type SprintActions } from "./sprint-context";
import { SprintHeader } from "./sprint-header";
import { TableView } from "./table-view";
import { TimelineView } from "./timeline-view";
import { VivaDialog } from "./viva-dialog";

const scrollToProblem = (id: string) =>
  setTimeout(() => document.querySelector(`[data-problem-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);

export function SprintView({ id }: { id: string }) {
  const { data, isLoading, error } = useSprint(id);
  const m = useProblemMutations(id);
  const [filters, setFilters] = useFilters();
  const [{ view }, setView] = useView();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState<Problem | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [aiSearch, setAiSearch] = useState(false);
  const [aiIntent, setAiIntent] = useAiIntent();
  const coach = useCoach(id);

  const problems = useMemo(() => data?.problems ?? [], [data]);
  const sprint = data?.sprint;

  const cfg: ScheduleConfig = useMemo(
    () => ({ startDate: sprint?.start_date ?? null, skipWeekends: sprint?.skip_weekends ?? false, restDays: sprint?.rest_days ?? [] }),
    [sprint],
  );
  const maxDay = useMemo(() => problems.reduce((m, p) => Math.max(m, p.day_no), 1), [problems]);
  const calendar = useMemo(() => buildCalendar(maxDay + 400, cfg), [maxDay, cfg]);
  const dateFor = useCallback((d: number) => calendar?.[d - 1] ?? null, [calendar]);
  const cur = useMemo(() => currentPlanDay(cfg, format(new Date(), "yyyy-MM-dd")), [cfg]);
  const sprintFor = useMemo(() => makeSprintForDay(problems), [problems]);
  const working = useMemo(() => workingDay(problems, cur?.day ?? null), [problems, cur]);

  const filtered = useMemo(() => applyFilters(problems, filters), [problems, filters]);
  const facets = useMemo(() => getFacets(problems), [problems]);
  const ai = useAiFilters(facets, filters, setFilters);
  const statusCounts = useMemo(() => {
    const base = problems.filter((p) => matches(p, { ...filters, status: "all" }));
    return Object.fromEntries(STATUSES.map((s) => [s, base.filter((p) => matches(p, { ...filters, status: s })).length])) as Record<Filters["status"], number>;
  }, [problems, filters]);

  const byId = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);
  const focused = focusedId ? byId.get(focusedId) : undefined;

  const headerStats = useMemo(() => {
    const todays = cur ? problems.filter((p) => p.day_no === cur.day) : [];
    return {
      total: problems.length,
      done: problems.filter((p) => p.done_at).length,
      today: cur ? { day: cur.day, date: dateFor(cur.day), total: todays.length, done: todays.filter((p) => p.done_at).length, isWorkingDay: cur.isWorkingDay } : null,
      overdue: cur ? problems.filter((p) => !p.done_at && p.day_no < cur.day).length : 0,
      shiftCount: cur ? shiftBacklog(problems, cur.day, sprintFor).length : 0,
    };
  }, [problems, cur, dateFor, sprintFor]);

  const focus = useCallback((p: Problem) => setFocusedId(p.id), []);

  // Study group: who else completed each problem.
  const me = useSessionUser()?.id;
  const linkedGroup = useGroupForSprint(id);
  const group = useGroupProgress(linkedGroup?.id);
  const peersFor = useCallback(
    (p: Problem) => {
      const done = group.index.get(problemKey(p));
      if (!done) return [];
      return group.members.filter((m) => m.user_id !== me && done.has(m.user_id)).map((member) => ({ member, doneAt: done.get(member.user_id)! }));
    },
    [group.index, group.members, me],
  );

  const moveToDay = useCallback(
    (p: Problem, day: number) => {
      if (p.day_no === day) return;
      m.reschedule([{ id: p.id, day_no: day, sprint_no: sprintFor(day) }]).then(
        () => toast.success(`Moved to Day ${day}`, { description: p.name }),
        () => {},
      );
    },
    [m, sprintFor],
  );

  const revealProblem = useCallback(
    (p: Problem) => {
      if (!matches(p, filters)) setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir });
      setFocusedId(p.id);
      scrollToProblem(p.id);
    },
    [filters, setFilters],
  );

  const jumpToday = useCallback(() => {
    if (!cur) return;
    const target = filtered.find((p) => p.day_no >= cur.day) ?? problems.find((p) => p.day_no >= cur.day);
    if (target) revealProblem(target);
  }, [cur, filtered, problems, revealProblem]);

  const { reset: resetCoach, generate: generateCoach } = coach;
  const openCoach = useCallback(() => {
    setCoachOpen(true);
    resetCoach();
    generateCoach();
  }, [resetCoach, generateCoach]);

  const openAiSearch = useCallback(() => {
    setAiSearch(true);
    setTimeout(() => {
      const el = document.getElementById("problem-search");
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el?.focus();
    }, 30);
  }, []);

  // Daily Recall warmup: 1-2 problems solved 7/14/30 days ago (or starred), quizzed from your own notes.
  const todayIso = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const recall = useMemo(() => pickRecall(problems, todayIso), [problems, todayIso]);
  const hasWarmup = Boolean(headerStats.today) && recall.length > 0;

  const openWarmup = useCallback(() => {
    const el = document.getElementById("daily-warmup");
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
    else toast.info("No warmup today", { description: "Problems you solved 7, 14 or 30 days ago (or starred) show up here." });
  }, []);

  /** AI Code & Intuition Reviewer lives in the notes drawer: open it on the focused or current working-day problem. */
  const openReview = useCallback(() => {
    const target = focused ?? problems.find((p) => p.day_no === working && !p.done_at) ?? problems.find((p) => !p.done_at) ?? problems[0];
    if (!target) return;
    revealProblem(target);
    setNotesId(target.id);
    toast.info("Write your approach or code, then click Analyze note", { description: target.name });
  }, [focused, problems, working, revealProblem]);

  // Deep links from the sidebar / ⌘K (`?ai=search|reschedule|warmup|review`): open the feature once, then drop the param.
  useEffect(() => {
    if (!aiIntent || !sprint) return;
    const t = setTimeout(() => {
      void setAiIntent(null);
      if (aiIntent === "search") openAiSearch();
      else if (aiIntent === "warmup") openWarmup();
      else if (aiIntent === "review") openReview();
      else if (cur) openCoach();
      else {
        toast.info("Set a start date to use smart reschedule");
        setSettingsOpen(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [aiIntent, sprint, cur, setAiIntent, openAiSearch, openCoach, openWarmup, openReview]);

  const shift = useCallback(async () => {
    if (!cur) return;
    const changes = shiftBacklog(problems, cur.day, sprintFor);
    await m.reschedule(changes);
    toast.success(`Shifted ${changes.length} problems`, { description: "Your plan now starts from today." });
  }, [cur, problems, sprintFor, m]);

  // Theory viva: marking a DBMS/OOPS/OS/CN topic done can first run a 2-question check. Un-marking stays immediate.
  const [vivaId, setVivaId] = useState<string | null>(null);
  const toggleDone = useCallback(
    (p: Problem) => {
      if (!p.done_at && isTheory(p) && isVivaEnabled(id)) setVivaId(p.id);
      else m.toggleDone(p);
    },
    [id, m],
  );
  const completeViva = useCallback(
    (p: Problem, { star }: { star: boolean }) => {
      setVivaId(null);
      const latest = byId.get(p.id) ?? p;
      if (!latest.done_at) m.toggleDone(latest);
      if (star && !latest.starred) m.toggleStar(latest);
    },
    [byId, m],
  );

  const actions: SprintActions = useMemo(
    () => ({
      toggleDone,
      toggleStar: m.toggleStar,
      openNotes: (p) => setNotesId(p.id),
      openMove: (p) => setMoveId(p.id),
      moveToDay,
      focus,
      focusedId,
      filters,
      dateFor,
      currentDay: cur?.day ?? null,
      peersFor,
    }),
    [toggleDone, m.toggleStar, moveToDay, focus, focusedId, filters, dateFor, cur, peersFor],
  );

  // Keyboard navigation over the visible list.
  const step = (dir: 1 | -1) => {
    if (!filtered.length) return;
    const i = filtered.findIndex((p) => p.id === focusedId);
    const next = filtered[Math.min(filtered.length - 1, Math.max(0, i === -1 ? 0 : i + dir))];
    setFocusedId(next.id);
    scrollToProblem(next.id);
  };
  useShortcuts({
    j: () => step(1),
    k: () => step(-1),
    ArrowDown: () => step(1),
    ArrowUp: () => step(-1),
    x: () => focused && toggleDone(focused),
    s: () => focused && m.toggleStar(focused),
    n: () => focused && setNotesId(focused.id),
    Enter: () => focused && setNotesId(focused.id),
    o: () => focused?.url && window.open(focused.url, "_blank", "noreferrer"),
    m: () => focused && setMoveId(focused.id),
    "/": () => document.getElementById("problem-search")?.focus(),
    t: () => setView({ view: view === "timeline" ? "table" : "timeline" }),
    "g t": jumpToday,
  });

  // Expose problems + actions to ⌘K.
  useEffect(() => {
    if (!sprint) return;
    setPaletteContext({
      problems,
      onSelectProblem: revealProblem,
      aiFilter: ai.run,
      actions: [
        { id: "ai-search", label: "Search in plain language", ai: true, run: openAiSearch },
        ...(cur ? [{ id: "ai-reschedule", label: "Smart reschedule backlog", ai: true, run: openCoach }] : []),
        ...(hasWarmup ? [{ id: "ai-warmup", label: "Start 5-minute daily warmup", ai: true, run: openWarmup }] : []),
        { id: "ai-review", label: "Review my code & intuition", ai: true, run: openReview },
        ...(cur ? [{ id: "today", label: "Go to today", shortcut: "g t", run: jumpToday }] : []),
        { id: "view", label: view === "timeline" ? "Switch to table view" : "Switch to timeline view", shortcut: "t", run: () => setView({ view: view === "timeline" ? "table" : "timeline" }) },
        { id: "revisit", label: "Show revisit list", run: () => setFilters({ status: "starred" }) },
        { id: "todo", label: "Show unfinished problems", run: () => setFilters({ status: "todo" }) },
        { id: "settings", label: "Sprint settings", run: () => setSettingsOpen(true) },
      ],
    });
    return () => setPaletteContext(null);
  }, [sprint, problems, revealProblem, jumpToday, cur, view, setView, setFilters, ai.run, openAiSearch, openCoach, hasWarmup, openWarmup, openReview]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.problem as Problem) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const day = e.over?.data.current?.day as number | undefined;
    const p = e.active.data.current?.problem as Problem | undefined;
    if (p && day) moveToDay(p, day);
  };

  if (error) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Couldn&apos;t load this sprint: {error.message}</div>;
  }
  if (isLoading || !sprint) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-14" />
        <Skeleton className="h-9" />
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}
      </div>
    );
  }

  return (
    <SprintActionsProvider value={actions}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-8">
        <SprintHeader
          sprint={sprint}
          stats={headerStats}
          onSettings={() => setSettingsOpen(true)}
          onShift={shift}
          onJumpToday={jumpToday}
          onCoach={cur ? openCoach : undefined}
        >
          {hasWarmup && (
            <DailyRecall
              sprintId={id}
              today={todayIso}
              candidates={recall}
              onStar={(p) => {
                const latest = byId.get(p.id) ?? p;
                if (!latest.starred) m.toggleStar(latest);
              }}
              onOpenNotes={(p) => setNotesId(p.id)}
            />
          )}
        </SprintHeader>
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/85 px-4 py-3 backdrop-blur max-md:top-13 sm:-mx-8 sm:px-8">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                facets={facets}
                statusCounts={statusCounts}
                view={view}
                setView={(v) => setView({ view: v })}
                resultCount={filtered.length}
                onAiQuery={ai.run}
                aiPending={ai.isPending}
                aiMode={aiSearch}
                onAiModeChange={setAiSearch}
              />
            </div>
            <ShortcutsHelp />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <p className="font-medium">No problems match these filters.</p>
            <button onClick={() => setFilters({ ...DEFAULT_FILTERS })} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>
          </div>
        ) : view === "table" ? (
          <TableView
            problems={filtered}
            onSort={(s) => setFilters(filters.sort === s ? { dir: filters.dir === "asc" ? "desc" : "asc" } : { sort: s, dir: "asc" })}
          />
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
            <TimelineView problems={filtered} expandAll={isFiltering(filters)} workingDay={working} />
            <DragOverlay dropAnimation={null}>
              {dragging && <div className="rotate-1 opacity-90 shadow-2xl"><ProblemCard problem={dragging} draggable={false} /></div>}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <NotesDrawer problem={notesId ? (byId.get(notesId) ?? null) : null} onClose={() => setNotesId(null)} onSave={m.saveNotes} />
      <MoveDialog
        problem={moveId ? (byId.get(moveId) ?? null) : null}
        onClose={() => setMoveId(null)}
        onMove={moveToDay}
        dateFor={dateFor}
        currentDay={cur?.day ?? null}
      />
      <CoachDialog
        open={coachOpen}
        onOpenChange={setCoachOpen}
        plan={coach.plan}
        isPending={coach.isPending}
        applying={coach.applying}
        problems={problems}
        dateFor={dateFor}
        onRegenerate={coach.generate}
        onApprove={async (plan) => {
          if (await coach.approve(plan)) setCoachOpen(false);
        }}
      />
      <SettingsDialog sprint={sprint} open={settingsOpen} onOpenChange={setSettingsOpen} onSave={m.updateSprint} />
      <VivaDialog problem={vivaId ? (byId.get(vivaId) ?? null) : null} onClose={() => setVivaId(null)} onComplete={completeViva} />
    </SprintActionsProvider>
  );
}
