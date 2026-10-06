"use client";

import { format, parseISO } from "date-fns";
import { Info, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { monthWeeks, periodMonths, periodStats } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export function Tile({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" /> {label}</div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("rounded-2xl border bg-card/40 p-5", className)}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function BreakdownBars({ rows, limit = 8 }: { rows: { key: string; total: number; done: number }[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="grid gap-2.5">
      {shown.map((r) => {
        const pct = r.total ? (r.done / r.total) * 100 : 0;
        return (
          <Tooltip key={r.key}>
            <TooltipTrigger asChild>
              <div className="grid grid-cols-[minmax(0,8rem)_1fr_4.5rem] items-center gap-3 text-sm">
                <span className="truncate">{r.key}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">{r.done}/{r.total}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{r.key}: {Math.round(pct)}% done</TooltipContent>
          </Tooltip>
        );
      })}
      {rows.length > limit && (
        <button onClick={() => setAll((v) => !v)} className="justify-self-start text-xs text-primary hover:underline">
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

const LEVELS = ["bg-muted", "bg-primary/30", "bg-primary/55", "bg-primary/80", "bg-primary"];

export function ActivityStrip({ counts, today, years }: { counts: Map<string, number>; today: string; years: number[] }) {
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const months = periodMonths(year);
  const stats = periodStats(counts, `${year}-01-01`, `${year}-12-31`);
  const max = Math.max(1, ...counts.values());
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

  // On narrow screens, bring the current month into view (or January for past years).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = year === thisYear ? el.querySelector<HTMLElement>(`[data-month="${Number(today.slice(5, 7)) - 1}"]`) : null;
    el.scrollLeft = target ? target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2 : 0;
  }, [year, thisYear, today]);

  return (
    <section className="rounded-2xl border bg-card/40 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="flex items-center gap-1.5 text-base">
          <span className="text-xl font-semibold tabular-nums">{stats.total}</span>
          <span className="text-muted-foreground">solved in {year}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5 text-muted-foreground" aria-label="About this chart" />
            </TooltipTrigger>
            <TooltipContent>Problems marked done, by the day you completed them</TooltipContent>
          </Tooltip>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span>Total active days: <span className="font-medium text-foreground tabular-nums">{stats.activeDays}</span></span>
          <span>Max streak: <span className="font-medium text-foreground tabular-nums">{stats.maxStreak}</span></span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger size="sm" className="w-auto" aria-label="Year"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="flex w-max gap-2.5">
          {months.map(({ year, month }) => (
            <div key={`${year}-${month}`} data-month={month} className="flex flex-col items-center gap-1.5">
              <div className="flex gap-[3px]">
                {monthWeeks(year, month).map((week, w) => (
                  <div key={w} className="flex flex-col gap-[3px]">
                    {week.map((d, i) => {
                      if (!d) return <span key={i} className="size-[11px]" />;
                      const n = counts.get(d) ?? 0;
                      const label = format(parseISO(d), "EEE, MMM d, yyyy");
                      return (
                        <Tooltip key={d}>
                          <TooltipTrigger asChild>
                            <span data-date={d} className={cn("size-[11px] rounded-[2px]", LEVELS[level(n)])} />
                          </TooltipTrigger>
                          <TooltipContent>{d > today ? `Upcoming · ${label}` : `${n} solved · ${label}`}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{format(new Date(year, month, 1), "MMM")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        Less {LEVELS.map((l) => <span key={l} className={cn("size-[11px] rounded-[2px]", l)} />)} More
      </div>
    </section>
  );
}
