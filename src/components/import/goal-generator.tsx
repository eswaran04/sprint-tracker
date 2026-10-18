"use client";

import { format } from "date-fns";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/sprint/chips";
import { generateSprint } from "@/lib/api";
import type { Answers, GenerateResponse, GenerateResult, Goal } from "@/lib/generate/schema";
import { ClarifyQuestions } from "./clarify-questions";
import { SprintPreview } from "./sprint-preview";

const MAX = 1000;

export const EXAMPLES = [
  "Google SDE-2 interview in 6 weeks, 2 hrs/day, weak at DP and graphs, skip weekends.",
  "Amazon new grad in 1 month, 1.5 hours a day, focus on arrays, strings and trees.",
  "Brush up on DSA over 8 weeks, 1 hour/day weekdays only, struggling with recursion.",
];

type Clarify = Extract<GenerateResult, { kind: "questions" }>;
/** Goal + answers from the clarification round, reused by "Regenerate" while the prompt is unchanged. */
type Followup = { prompt: string; goal: Goal; answers?: Answers; skip_questions?: boolean };

export function GoalGenerator() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [clarify, setClarify] = useState<Clarify | null>(null);
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [runId, setRunId] = useState(0);

  async function run(extra: Omit<Followup, "prompt"> | null) {
    const p = prompt.trim();
    if (p.length < 3 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateSprint({ prompt: p, today: format(new Date(), "yyyy-MM-dd"), ...extra });
      if (data.kind === "questions") {
        setClarify(data);
        setResult(null);
        setFollowup(null);
      } else {
        setResult(data);
        setClarify(null);
        setFollowup(extra ? { prompt: p, ...extra } : null);
        setRunId((n) => n + 1);
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error("Couldn't build a sprint", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const generate = () => run(null);
  /** Same prompt → keep the answers already given instead of asking again. */
  const regenerate = () => {
    if (followup && followup.prompt === prompt.trim()) {
      return run({ goal: followup.goal, answers: followup.answers, skip_questions: followup.skip_questions });
    }
    return run(null);
  };

  const goal = result?.goal;
  const themes = result ? Object.fromEntries(result.sprints.map((s) => [s.sprint_no, s.theme])) : undefined;
  const canSubmit = !loading && prompt.trim().length >= 3;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="font-semibold">1. Describe your goal</h2>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <Textarea
            aria-label="Describe your goal"
            value={prompt}
            maxLength={MAX}
            rows={3}
            placeholder={EXAMPLES[0]}
            onChange={(e) => {
              setPrompt(e.target.value);
              setClarify(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                generate();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setPrompt(ex);
                  setClarify(null);
                }}
                className="max-w-full truncate rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">{prompt.length}/{MAX}</span>
            <div className="flex gap-2">
              {result && (
                <Button type="button" variant="outline" onClick={() => regenerate()} disabled={!canSubmit}>
                  <RefreshCw /> Regenerate
                </Button>
              )}
              <Button type="submit" disabled={!canSubmit}>
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Generate sprint
              </Button>
            </div>
          </div>
        </form>
        {error && !loading && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {clarify && (
        <ClarifyQuestions
          key={clarify.questions.map((q) => q.field).join()}
          goal={clarify.goal}
          questions={clarify.questions}
          loading={loading}
          onSubmit={(answers) => run({ goal: clarify.goal, answers })}
          onSkip={() => run({ goal: clarify.goal, skip_questions: true })}
        />
      )}

      {loading && (
        <div className="grid gap-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">Picking problems from public sheets and planning your days…</p>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}

      {!loading && result && goal && (
        <>
          <section className="grid gap-3 rounded-2xl border bg-card/40 p-4" aria-label="Plan summary">
            <div className="flex flex-wrap items-center gap-1.5">
              {goal.company && <Tag active>{goal.company}</Tag>}
              <Tag>{goal.weeks} week{goal.weeks === 1 ? "" : "s"}</Tag>
              <Tag>{goal.hours_per_day} h/day</Tag>
              {goal.skip_weekends && <Tag>Weekdays only</Tag>}
              {goal.weak_topics.map((t) => <Tag key={`w:${t}`} className="bg-pro/10 text-pro">Weak: {t}</Tag>)}
              {goal.focus_topics.map((t) => <Tag key={`f:${t}`}>{t}</Tag>)}
              {!result.ai && <Tag className="ml-auto">Built-in planner</Tag>}
            </div>
            <p className="text-sm">{result.rationale}</p>
            {result.warnings.map((w) => (
              <p key={w} className="flex items-center gap-2 text-sm text-core"><AlertTriangle className="size-4 shrink-0" /> {w}</p>
            ))}
            <p className="text-xs text-muted-foreground">Every problem comes from a public sheet — names and links are never AI-written.</p>
          </section>

          <SprintPreview
            key={runId}
            problems={result.rows}
            initialTitle={result.title}
            initialStartDate={result.start_date}
            initialSkipWeekends={result.skip_weekends}
            initialRestDays={result.rest_days}
            themes={themes}
            step={2}
            previewRows={12}
          />
        </>
      )}
    </div>
  );
}
