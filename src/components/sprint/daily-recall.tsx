"use client";

import { Brain, Check, Eye, NotebookPen, Star, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRecallDismissed, useRecallQuestion } from "@/hooks/use-recall";
import type { RecallCandidate } from "@/lib/recall/select";
import type { Problem } from "@/lib/types";

/**
 * "Daily Recall (2 mins)": before today's new problems, re-test 1-2 problems solved 7/14/30 days ago (or starred)
 * with a question built from the user's own notes. "Fuzzy" stars the problem so it lands on the revisit list.
 */
export function DailyRecall({ sprintId, today, candidates, onStar, onOpenNotes }: {
  sprintId: string;
  /** yyyy-MM-dd */
  today: string;
  candidates: RecallCandidate[];
  /** Star a problem for revisiting (only called when it isn't starred yet). */
  onStar: (p: Problem) => void;
  onOpenNotes: (p: Problem) => void;
}) {
  const [dismissed, dismiss] = useRecallDismissed(sprintId, today);
  // Snapshot today's picks: starring or finishing problems mid-warmup must not reshuffle the questions.
  const [picks] = useState(candidates);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<("nailed" | "fuzzy")[]>([]);

  if (dismissed || picks.length === 0) return null;

  const done = index >= picks.length;
  const grade = (r: "nailed" | "fuzzy") => {
    const c = picks[index];
    if (r === "fuzzy" && !c.problem.starred) onStar(c.problem);
    setResults((xs) => [...xs, r]);
    setIndex((i) => i + 1);
  };

  return (
    <section aria-label="Daily Recall" className="rounded-2xl border border-primary/30 bg-card/60 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Brain className="size-4 text-primary" />
        <span className="font-medium">Daily Recall</span>
        <span className="text-muted-foreground">· 2 mins</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{Math.min(index + 1, picks.length)}/{picks.length}</span>
        <Button variant="ghost" size="xs" onClick={dismiss} className="text-muted-foreground">
          {done ? <><X /> Close</> : "Skip today"}
        </Button>
      </div>

      {done ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Warmup done:{" "}
          <span className="font-medium text-foreground">{results.filter((r) => r === "nailed").length}/{picks.length}</span> nailed.
          {results.includes("fuzzy") && " Fuzzy ones were starred for your revisit list."} Now go crush today&apos;s problems.
        </p>
      ) : (
        <RecallQuestion
          key={picks[index].problem.id}
          candidate={picks[index]}
          today={today}
          onGrade={grade}
          onOpenNotes={() => onOpenNotes(picks[index].problem)}
        />
      )}
    </section>
  );
}

function RecallQuestion({ candidate, today, onGrade, onOpenNotes }: {
  candidate: RecallCandidate; today: string; onGrade: (r: "nailed" | "fuzzy") => void; onOpenNotes: () => void;
}) {
  const q = useRecallQuestion(candidate, today);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);

  if (q.isPending) {
    return (
      <div className="mt-3 space-y-2" aria-label="Loading question">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Couldn&apos;t load a question for {candidate.problem.name}.
        <Button size="xs" variant="outline" onClick={() => q.refetch()}>Retry</Button>
        <Button size="xs" variant="ghost" onClick={() => onGrade("nailed")}>Skip</Button>
      </div>
    );
  }

  const { recall, ai } = q.data;
  return (
    <div className="mt-2 grid gap-2.5 text-sm">
      <p className="text-muted-foreground">
        {candidate.reason === "starred" && <Star className="mr-1 inline size-3.5 fill-current text-amber-500" aria-label="Starred" />}
        {recall.intro}
      </p>
      <p className="font-medium">{recall.question}</p>
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Answer in a sentence or two (optional)…"
        aria-label="Your answer"
        className="min-h-12"
      />
      {hint && !revealed && <p className="text-xs text-muted-foreground">Hint: {recall.hint}</p>}

      {revealed ? (
        <>
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Answer</span>
            <p className="mt-0.5">{recall.answer}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">How did you do?</span>
            <Button size="sm" onClick={() => onGrade("nailed")}><Check /> Nailed it</Button>
            <Button size="sm" variant="outline" onClick={() => onGrade("fuzzy")}><Star /> Fuzzy</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setRevealed(true)}><Eye /> Reveal answer</Button>
          {!hint && <Button size="sm" variant="ghost" onClick={() => setHint(true)}>Hint</Button>}
          <Button size="sm" variant="ghost" onClick={onOpenNotes}><NotebookPen /> Open my notes</Button>
          {!ai && <span className="ml-auto text-[11px] text-muted-foreground">AI off · offline question</span>}
        </div>
      )}
    </div>
  );
}
