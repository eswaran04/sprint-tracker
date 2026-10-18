"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/sprint/chips";
import type { Answers, Goal, Question } from "@/lib/generate/schema";
import { cn } from "@/lib/utils";

type Values = Record<string, Question["default"]>;

const NONE = "No specific company";

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        selected ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Converts form values into `Answers`, dropping out-of-range numbers (the field then keeps the parsed default). */
export function toAnswers(questions: Question[], values: Values): Answers {
  const out: Answers = {};
  for (const q of questions) {
    const v = values[q.field];
    switch (q.field) {
      case "weeks":
      case "hours_per_day": {
        const n = Number(v);
        if (Number.isFinite(n) && n >= (q.min ?? -Infinity) && n <= (q.max ?? Infinity)) out[q.field] = q.field === "weeks" ? Math.round(n) : n;
        break;
      }
      case "company":
        out.company = typeof v === "string" && v ? v : null;
        break;
      case "weak_topics":
        out.weak_topics = Array.isArray(v) ? v : [];
        break;
      case "skip_weekends":
        out.skip_weekends = Boolean(v);
        break;
    }
  }
  return out;
}

export function ClarifyQuestions({
  goal,
  questions,
  loading,
  onSubmit,
  onSkip,
}: {
  goal: Goal;
  questions: Question[];
  loading: boolean;
  onSubmit: (answers: Answers) => void;
  onSkip: () => void;
}) {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(questions.map((q) => [q.field, q.default])));
  const set = (field: string, v: Question["default"]) => setValues((s) => ({ ...s, [field]: v }));

  return (
    <section className="grid gap-4 rounded-2xl border bg-card/40 p-4" aria-label="A few quick questions">
      <div className="grid gap-1.5">
        <h2 className="font-semibold">A few quick questions</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">So far:</span>
          {goal.company && <Tag active>{goal.company}</Tag>}
          <Tag>{goal.weeks} week{goal.weeks === 1 ? "" : "s"}</Tag>
          <Tag>{goal.hours_per_day} h/day</Tag>
          {goal.skip_weekends && <Tag>Weekdays only</Tag>}
          {goal.weak_topics.map((t) => <Tag key={`w:${t}`} className="bg-pro/10 text-pro">Weak: {t}</Tag>)}
          {goal.focus_topics.map((t) => <Tag key={`f:${t}`}>{t}</Tag>)}
        </div>
      </div>

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(toAnswers(questions, values));
        }}
      >
        {questions.map((q) => {
          const id = `clarify-${q.field}`;
          const v = values[q.field];
          return (
            <fieldset key={q.field} className="grid gap-2">
              <legend id={`${id}-label`} className="mb-2 text-sm">{q.prompt}</legend>
              {q.kind === "number" && (
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    aria-labelledby={`${id}-label`}
                    type="number"
                    className="w-28"
                    min={q.min}
                    max={q.max}
                    step={q.step}
                    value={v === null || v === undefined ? "" : String(v)}
                    onChange={(e) => set(q.field, e.target.value === "" ? null : Number(e.target.value))}
                  />
                  {q.unit && <span className="text-sm text-muted-foreground">{q.unit}</span>}
                </div>
              )}
              {q.kind === "single" && (
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
                  {(q.options ?? []).map((o) => <Chip key={o} selected={v === o} onClick={() => set(q.field, o)}>{o}</Chip>)}
                  <Chip selected={v === null} onClick={() => set(q.field, null)}>{NONE}</Chip>
                </div>
              )}
              {q.kind === "multi" && (
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
                  {(q.options ?? []).map((o) => {
                    const list = Array.isArray(v) ? v : [];
                    const on = list.includes(o);
                    return (
                      <Chip key={o} selected={on} onClick={() => set(q.field, on ? list.filter((x) => x !== o) : [...list, o])}>
                        {o}
                      </Chip>
                    );
                  })}
                </div>
              )}
              {q.kind === "boolean" && (
                <div className="flex items-center gap-2">
                  <Switch id={id} aria-labelledby={`${id}-label`} checked={Boolean(v)} onCheckedChange={(c) => set(q.field, c)} />
                  <span className="text-sm text-muted-foreground">{v ? "Weekdays only" : "Study every day"}</span>
                </div>
              )}
            </fieldset>
          );
        })}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={loading}>
            Skip – use defaults
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Build my plan
          </Button>
        </div>
      </form>
    </section>
  );
}
