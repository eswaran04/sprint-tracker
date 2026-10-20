"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Copy, ExternalLink, Layers, ListChecks, Loader2, Search, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyTags, DifficultyChip, SubjectTag, Tag } from "@/components/sprint/chips";
import { FacetSelect } from "@/components/sprint/facet-select";
import { useSprints } from "@/hooks/use-sprints";
import { copyPublicSheet, getPublicSheet } from "@/lib/api";
import { formatDuration } from "@/lib/duration";
import { applyFilters, DEFAULT_FILTERS, facets as getFacets, isFiltering, type Filters } from "@/lib/filters";
import type { Problem, PublicProblem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EditSheetButton } from "./edit-sheet-dialog";
import { DifficultyBar, MaangCoverage, OtherCompanies, OwnerLine } from "./sheet-meta";
import { SimilarSheets } from "./similar-sheets";

// Reuse the sprint filter/sort logic by giving catalogue rows empty progress.
const asProblem = (p: PublicProblem): Problem => ({
  ...p, original_day_no: p.day_no, original_sprint_no: p.sprint_no, source_id: null, done_at: null, starred: false, notes: "",
});

function UseSheetButton({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: mine } = useSprints();
  const own = mine?.find((s) => s.id === sheetId);
  const copy = mine?.find((s) => s.copied_from === sheetId);

  const mutation = useMutation({
    mutationFn: () => copyPublicSheet(sheetId),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Added to your sprints", { description: "Day 1 starts today — change it in Settings." });
      router.push(`/app/s/${id}`);
    },
    onError: (e) => toast.error("Couldn't copy this sheet", { description: e.message }),
  });

  if (own) return <Button asChild size="lg" className="rounded-xl"><Link href={`/app/s/${own.id}`}>Open your sprint</Link></Button>;
  if (copy) return <Button asChild size="lg" variant="secondary" className="rounded-xl"><Link href={`/app/s/${copy.id}`}>Open your copy</Link></Button>;
  return (
    <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Copy />} Use this sheet
    </Button>
  );
}

function CatalogueRow({ p, highlight }: { p: Problem; highlight: string[] }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card/50 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2.5">
        {p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer" className="truncate font-medium underline-offset-2 hover:text-primary hover:underline">
            {p.name}
          </a>
        ) : (
          <span className="truncate font-medium">{p.name}</span>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          <DifficultyChip difficulty={p.difficulty} />
          <SubjectTag subject={p.subject} />
          {p.topics.slice(0, 2).map((t) => <Tag key={t} className="max-sm:hidden">{t}</Tag>)}
          <span className="hidden min-w-0 lg:flex"><CompanyTags companies={p.companies} highlight={highlight} max={2} /></span>
        </div>
      </div>
      {p.url && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}
    </div>
  );
}

function Catalogue({ problems }: { problems: Problem[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = useMemo(() => applyFilters(problems, filters), [problems, filters]);
  const fx = useMemo(() => getFacets(problems), [problems]);
  const expandAll = isFiltering(filters);

  // Starting or clearing a filter resets hand toggles so filtered matches start expanded.
  const [prevExpandAll, setPrevExpandAll] = useState(expandAll);
  if (prevExpandAll !== expandAll) {
    setPrevExpandAll(expandAll);
    setOverrides(new Map());
  }

  const groups = useMemo(() => {
    const bySprint = new Map<number, Map<number, Problem[]>>();
    for (const p of filtered) {
      const days = bySprint.get(p.sprint_no) ?? new Map<number, Problem[]>();
      days.set(p.day_no, [...(days.get(p.day_no) ?? []), p]);
      bySprint.set(p.sprint_no, days);
    }
    return [...bySprint].sort(([a], [b]) => a - b).map(([sprint, days]) => ({
      sprint,
      days: [...days].sort(([a], [b]) => a - b),
      count: [...days.values()].reduce((n, d) => n + d.length, 0),
    }));
  }, [filtered]);

  const isOpenFor = (n: number) => overrides.get(n) ?? (expandAll || n === problems[0]?.sprint_no);
  const toggle = (n: number) => setOverrides((m) => new Map(m).set(n, !isOpenFor(n)));

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search problems…" className="h-8 pl-8" />
        </div>
        <FacetSelect label="Company" facets={fx.companies} value={filters.companies} onChange={(companies) => set({ companies })} />
        <FacetSelect label="Topic" facets={fx.topics} value={filters.topics} onChange={(topics) => set({ topics })} />
        <FacetSelect label="Difficulty" facets={fx.difficulties} value={filters.difficulties} onChange={(difficulties) => set({ difficulties })} searchable={false} />
        {expandAll && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)} className="text-muted-foreground">
            Clear · {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </Button>
        )}
      </div>

      {groups.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No problems match.</p>}
      {groups.map((g) => {
        const isOpen = isOpenFor(g.sprint);
        return (
          <div key={g.sprint} className="overflow-hidden rounded-2xl border bg-card/30">
            <button onClick={() => toggle(g.sprint)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
              <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
              <span className="font-semibold">Sprint {g.sprint}</span>
              <span className="text-xs text-muted-foreground">Day {g.days[0][0]}–{g.days.at(-1)![0]}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{g.count} problems</span>
            </button>
            {isOpen && (
              <div className="grid gap-3 border-t p-3">
                {g.days.map(([day, ps]) => (
                  <div key={day} className="grid gap-1.5">
                    <p className="px-1 text-sm font-semibold">Day {day}</p>
                    {ps.map((p) => <CatalogueRow key={p.id} p={p} highlight={filters.companies} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function PublicSheetView({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["public-sheet", id], queryFn: () => getPublicSheet(id) });
  const { data: mine } = useSprints();
  const isOwner = Boolean(mine?.some((s) => s.id === id));
  const problems = useMemo(() => (data?.problems ?? []).map(asProblem), [data]);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 rounded-2xl" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-2xl" />)}
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="font-medium">This sheet isn&apos;t available</p>
        <p className="mt-1 text-sm text-muted-foreground">{error ? error.message : "It may have been made private or deleted."}</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/app/explore">Browse public sheets</Link></Button>
      </div>
    );
  }

  const { sheet } = data;
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-8">
      <Link href="/app/explore" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Explore
      </Link>

      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card/60 to-card/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{sheet.title}</h1>
              {isOwner && <EditSheetButton sheet={sheet} />}
            </div>
            <OwnerLine sheet={sheet} className="mt-2" />
            {sheet.description && <p className="mt-3 max-w-2xl text-sm text-pretty text-muted-foreground">{sheet.description}</p>}
          </div>
          <UseSheetButton sheetId={sheet.id} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Timer, label: "Time to finish", value: formatDuration(sheet.day_count) },
            { icon: ListChecks, label: "Problems", value: String(sheet.problem_count) },
            { icon: Layers, label: "Sprints", value: String(sheet.sprint_count) },
            { icon: Copy, label: "Copies", value: String(sheet.copy_count) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" /> {label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-4 border-t pt-5 lg:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Companies</p>
            <MaangCoverage counts={sheet.company_counts} showCounts />
            <OtherCompanies counts={sheet.company_counts} max={8} />
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Difficulty</p>
            <DifficultyBar sheet={sheet} />
            {sheet.topics.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {sheet.topics.slice(0, 12).map((t) => <Tag key={t}>{t}</Tag>)}
                {sheet.topics.length > 12 && <span className="text-[11px] text-muted-foreground">+{sheet.topics.length - 12}</span>}
              </div>
            )}
          </div>
        </div>
      </header>

      <SimilarSheets sheetId={sheet.id} />

      <Catalogue problems={problems} />
    </div>
  );
}
