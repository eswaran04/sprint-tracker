"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DifficultyChip, Tag } from "@/components/sprint/chips";
import { createSprint } from "@/lib/api";
import { buildCalendar } from "@/lib/schedule";
import type { ProblemInput } from "@/lib/types";

export interface SprintPreviewProps {
  problems: ProblemInput[];
  initialTitle: string;
  initialStartDate?: string;
  initialSkipWeekends?: boolean;
  initialRestDays?: string[];
  /** Optional sprint themes (generator), shown in the preview. */
  themes?: Record<number, string>;
  /** Section numbering offset (the file wizard has a mapping step first). */
  step?: number;
  /** How many rows to show in the preview table. */
  previewRows?: number;
}

const fmt = (d: string) => format(parseISO(d), "EEE d MMM");

/** Preview table + "Name & schedule" + Create. Shared by file import and the goal generator. */
export function SprintPreview({
  problems,
  initialTitle,
  initialStartDate,
  initialSkipWeekends = false,
  initialRestDays = [],
  themes,
  step = 1,
  previewRows = 8,
}: SprintPreviewProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [startDate, setStartDate] = useState(initialStartDate ?? format(new Date(), "yyyy-MM-dd"));
  const [skipWeekends, setSkipWeekends] = useState(initialSkipWeekends);
  const [restDays, setRestDays] = useState(initialRestDays);
  const [creating, setCreating] = useState(false);

  const summary = useMemo(() => {
    const days = new Set(problems.map((p) => p.day_no));
    return {
      count: problems.length,
      days: days.size,
      maxDay: problems.reduce((m, p) => Math.max(m, p.day_no), 0),
      sprints: new Set(problems.map((p) => p.sprint_no)).size,
      companies: new Set(problems.flatMap((p) => p.companies)).size,
    };
  }, [problems]);

  const endDate = useMemo(() => {
    if (!startDate || !summary.maxDay) return null;
    return buildCalendar(summary.maxDay, { startDate, skipWeekends, restDays })?.at(-1) ?? null;
  }, [startDate, skipWeekends, restDays, summary.maxDay]);

  async function create() {
    if (!problems.length) return;
    setCreating(true);
    try {
      const s = await createSprint(
        { title: title.trim() || "My sprint", start_date: startDate || null, skip_weekends: skipWeekends, rest_days: restDays },
        problems,
      );
      await qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success(`Created sprint with ${problems.length} problems`);
      router.push(`/app/s/${s.id}`);
    } catch (e) {
      toast.error("Couldn't create the sprint", { description: (e as Error).message });
      setCreating(false);
    }
  }

  const shown = problems.slice(0, previewRows);

  return (
    <>
      {problems.length > 0 && (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-semibold">{step}. Preview</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {summary.count} problems · {summary.sprints} sprints · {summary.days} days · {summary.companies} companies
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Level</th>
                  <th className="px-3 py-2 font-medium">Topics</th>
                  <th className="px-3 py-2 font-medium">Companies</th>
                  <th className="px-3 py-2 text-right font-medium">Sprint</th>
                  <th className="px-3 py-2 text-right font-medium">Day</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p, i) => {
                  const theme = themes?.[p.sprint_no];
                  const newSprint = theme && (i === 0 || shown[i - 1].sprint_no !== p.sprint_no);
                  return (
                    <PreviewRow key={p.position} p={p} sprintHeader={newSprint ? `Sprint ${p.sprint_no} · ${theme}` : undefined} />
                  );
                })}
              </tbody>
            </table>
          </div>
          {problems.length > shown.length && (
            <p className="text-xs text-muted-foreground">Showing the first {shown.length} of {problems.length}.</p>
          )}
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="font-semibold">{step + 1}. Name &amp; schedule</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Sprint name</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="start">Start date (Day 1)</Label>
            <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:max-w-md">
          <span className="text-sm">Skip weekends</span>
          <Switch checked={skipWeekends} onCheckedChange={setSkipWeekends} />
        </label>
        {restDays.length > 0 && (
          <div className="grid gap-1.5">
            <span className="text-sm">Rest days</span>
            <div className="flex flex-wrap gap-1.5">
              {restDays.map((d) => (
                <span key={d} className="inline-flex h-7 items-center gap-1 rounded-md bg-muted pl-2 pr-1 text-xs">
                  {fmt(d)}
                  <button
                    type="button"
                    aria-label={`Remove rest day ${d}`}
                    className="rounded p-0.5 hover:bg-background"
                    onClick={() => setRestDays((r) => r.filter((x) => x !== d))}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {endDate && (
          <p className="text-sm text-muted-foreground">
            Finishes on <span className="font-medium text-foreground">{fmt(endDate)}</span>
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={create} disabled={creating || !problems.length} className="rounded-xl px-6">
          {creating && <Loader2 className="animate-spin" />}
          Create sprint with {summary.count} problems
        </Button>
      </div>
    </>
  );
}

function PreviewRow({ p, sprintHeader }: { p: ProblemInput; sprintHeader?: string }) {
  return (
    <>
      {sprintHeader && (
        <tr className="border-t bg-muted/20">
          <td colSpan={6} className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{sprintHeader}</td>
        </tr>
      )}
      <tr className="border-t">
        <td className="max-w-64 truncate px-3 py-2">
          {p.name}
          {!p.url && <span className="ml-2 text-xs text-core">no link</span>}
        </td>
        <td className="px-3 py-2"><DifficultyChip difficulty={p.difficulty} /></td>
        <td className="px-3 py-2"><span className="flex gap-1">{p.topics.slice(0, 2).map((t) => <Tag key={t}>{t}</Tag>)}</span></td>
        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{p.companies.length || "—"}</td>
        <td className="px-3 py-2 text-right tabular-nums">{p.sprint_no}</td>
        <td className="px-3 py-2 text-right tabular-nums">{p.day_no}</td>
      </tr>
    </>
  );
}
