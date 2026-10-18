"use client";

import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { CompanyTags, DifficultyChip, SubjectTag } from "@/components/sprint/chips";
import { Button } from "@/components/ui/button";
import type { SharedProblem } from "@/lib/types";
import { cn } from "@/lib/utils";

const INITIAL_DAYS = 14;

/** Read-only roadmap: days on the original schedule with done ticks. No actions, notes or stars. */
export function SharedRoadmap({ problems }: { problems: SharedProblem[] }) {
  const [showAll, setShowAll] = useState(false);
  const days = useMemo(() => {
    const m = new Map<number, SharedProblem[]>();
    for (const p of problems) m.set(p.day_no, [...(m.get(p.day_no) ?? []), p]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [problems]);

  if (!days.length) return <p className="text-sm text-muted-foreground">This roadmap has no problems yet.</p>;
  const shown = showAll ? days : days.slice(0, INITIAL_DAYS);

  return (
    <div className="grid gap-3">
      {shown.map(([day, list]) => {
        const done = list.filter((p) => p.done).length;
        return (
          <section key={day} className="rounded-2xl border bg-card/50 p-4">
            <header className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Day {day}</span>
              <span className="text-xs text-muted-foreground">{done}/{list.length} done</span>
            </header>
            <ul className="grid gap-1.5">
              {list.map((p) => (
                <li key={p.position} className="flex min-w-0 items-center gap-2 text-sm">
                  <span
                    aria-label={p.done ? "Done" : "Not done"}
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      p.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {p.done && <Check className="size-3" />}
                  </span>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer noopener" className={cn("truncate hover:underline", p.done && "text-muted-foreground")}>
                      {p.name}
                    </a>
                  ) : (
                    <span className={cn("truncate", p.done && "text-muted-foreground")}>{p.name}</span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <SubjectTag subject={p.subject} />
                    <DifficultyChip difficulty={p.difficulty} />
                    <span className="hidden sm:flex"><CompanyTags companies={p.companies} max={2} /></span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {days.length > INITIAL_DAYS && !showAll && (
        <Button variant="outline" onClick={() => setShowAll(true)} className="justify-self-center">
          <ChevronDown /> Show all {days.length} days
        </Button>
      )}
    </div>
  );
}
