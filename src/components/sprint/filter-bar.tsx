"use client";

import { ArrowDownUp, CalendarRange, Loader2, Rows3, Search, X } from "lucide-react";
import { useState } from "react";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatSubject } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEFAULT_FILTERS, isFiltering, STATUSES, type Facet, type Filters } from "@/lib/filters";
import { MAX_QUERY_LENGTH } from "@/lib/ai/nl-filters";
import { FacetSelect } from "./facet-select";
import { SavedFilters } from "./saved-filters";

const SORT_LABELS: Record<Filters["sort"], string> = {
  day: "Plan day", name: "Name", difficulty: "Difficulty", companies: "# Companies", done: "Completed date",
};
const STATUS_LABELS: Record<Filters["status"], string> = { all: "All", todo: "To do", done: "Done", starred: "Revisit" };

export interface FilterBarProps {
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  facets: { companies: Facet[]; topics: Facet[]; subjects: Facet[]; difficulties: Facet[] };
  statusCounts: Record<Filters["status"], number>;
  view: "timeline" | "table";
  setView: (v: "timeline" | "table") => void;
  resultCount: number;
  /** Enables the AI toggle in the search box: Enter sends the sentence here instead of setting `q`. */
  onAiQuery?: (text: string) => Promise<void> | void;
  aiPending?: boolean;
  /** Optional controlled AI mode (lets navigation open the AI search); uncontrolled when omitted. */
  aiMode?: boolean;
  onAiModeChange?: (on: boolean) => void;
}

export function FilterBar({
  filters, setFilters, facets, statusCounts, view, setView, resultCount, onAiQuery, aiPending = false,
  aiMode: aiModeProp, onAiModeChange,
}: FilterBarProps) {
  const active = isFiltering(filters);
  const [aiModeState, setAiModeState] = useState(false);
  const aiMode = aiModeProp ?? aiModeState;
  const setAiMode = (next: boolean | ((v: boolean) => boolean)) => {
    const v = typeof next === "function" ? next(aiMode) : next;
    setAiModeState(v);
    onAiModeChange?.(v);
  };
  const [aiText, setAiText] = useState("");
  const [aiSeen, markAiSeen] = useFeatureSeen("ai-search");
  const ai = aiMode && Boolean(onAiQuery);
  const submitAi = async () => {
    if (!onAiQuery || !aiText.trim() || aiPending) return;
    markAiSeen();
    await onAiQuery(aiText);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-sm">
          {ai ? (
            aiPending ? (
              <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-primary" aria-label="Interpreting" />
            ) : (
              <AiSparkle className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
            )
          ) : (
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
          {ai ? (
            <Input
              id="problem-search"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitAi();
                } else if (e.key === "Escape") {
                  setAiMode(false);
                }
              }}
              maxLength={MAX_QUERY_LENGTH}
              disabled={aiPending}
              autoFocus
              aria-label="Describe what you want to see"
              placeholder="Ask in plain words — e.g. Amazon sliding window I starred…"
              className="ai-border ai-glow h-8 rounded-lg pr-14 pl-8 focus-visible:border-transparent"
            />
          ) : (
            <Input
              id="problem-search"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              placeholder="Search problems, topics, companies…"
              className={cn("h-8 rounded-lg pl-8", onAiQuery ? "pr-14" : "pr-8")}
            />
          )}
          <span className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground", onAiQuery ? "right-8" : "right-2")}>
            {!ai && filters.q ? (
              <button onClick={() => setFilters({ q: "" })} className="flex hover:text-foreground" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            ) : !ai ? (
              <kbd className="pointer-events-none rounded border bg-muted px-1 font-mono text-[10px] max-sm:hidden">/</kbd>
            ) : null}
          </span>
          {onAiQuery && (
            <button
              type="button"
              onClick={() => setAiMode((v) => !v)}
              aria-pressed={ai}
              aria-label={ai ? "Switch to plain search" : "Filter with AI"}
              title={ai ? "Plain search" : "Filter with AI"}
              className={cn(
                "absolute top-1/2 right-1.5 flex size-5.5 -translate-y-1/2 items-center justify-center rounded-md transition-all",
                ai ? "bg-[color-mix(in_oklch,var(--ai-2),transparent_85%)]" : "hover:scale-110 hover:bg-muted",
              )}
            >
              <AiSparkle className="size-3.5" />
              {!aiSeen && !ai && <AiBadge label="AI" className="pointer-events-none absolute -top-2.5 -right-2 px-1 text-[8px]" />}
            </button>
          )}
        </div>
        <Tabs value={filters.status} onValueChange={(v) => setFilters({ status: v as Filters["status"] })}>
          <TabsList className="h-8">
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className="gap-1.5 px-2.5 text-xs">
                {STATUS_LABELS[s]}
                <span className="text-[10px] text-muted-foreground tabular-nums">{statusCounts[s]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "timeline" | "table")}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          <ToggleGroupItem value="timeline" aria-label="Timeline view" className="gap-1.5 px-2.5"><CalendarRange className="size-3.5" /><span className="max-sm:hidden">Timeline</span></ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="gap-1.5 px-2.5"><Rows3 className="size-3.5" /><span className="max-sm:hidden">Table</span></ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FacetSelect label="Company" facets={facets.companies} value={filters.companies} onChange={(companies) => setFilters({ companies })} />
        <FacetSelect label="Topic" facets={facets.topics} value={filters.topics} onChange={(topics) => setFilters({ topics })} />
        <FacetSelect label="Difficulty" facets={facets.difficulties} value={filters.difficulties} onChange={(difficulties) => setFilters({ difficulties })} searchable={false} />
        {facets.subjects.length > 1 && (
          <FacetSelect label="Subject" facets={facets.subjects} value={filters.subjects} onChange={(subjects) => setFilters({ subjects })} searchable={false} format={formatSubject} />
        )}
        <Select value={filters.sort} onValueChange={(sort) => setFilters({ sort: sort as Filters["sort"] })}>
          <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 rounded-lg">
            <ArrowDownUp className="size-3.5 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setFilters({ dir: filters.dir === "asc" ? "desc" : "asc" })} className="rounded-lg text-xs">
          {filters.dir === "asc" ? "Asc" : "Desc"}
        </Button>
        {active && (
          <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir })}>
            <X className="size-3.5" /> Clear
          </Button>
        )}
        <span className="ml-auto flex items-center gap-2">
          {active && <span className="text-xs text-muted-foreground tabular-nums">{resultCount} match{resultCount === 1 ? "" : "es"}</span>}
          <SavedFilters filters={filters} onApply={setFilters} />
        </span>
      </div>
    </div>
  );
}
