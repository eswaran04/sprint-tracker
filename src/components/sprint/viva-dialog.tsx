"use client";

import { Check, Eye, GraduationCap, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useVivaQuestions } from "@/hooks/use-recall";
import { formatSubject } from "@/lib/format";
import type { Problem } from "@/lib/types";

/**
 * Optional 2-question rapid-fire check when marking a theory topic (DBMS/OOPS/OS/CN) done. The topic is always
 * marked done once the check finishes or is skipped; any "Not sure" also stars it for the revisit list.
 * Closing the dialog cancels: the topic stays not done.
 */
export function VivaDialog({ problem, onClose, onComplete }: {
  problem: Problem | null;
  onClose: () => void;
  onComplete: (p: Problem, opts: { star: boolean }) => void;
}) {
  return (
    <Dialog open={Boolean(problem)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {problem && <VivaBody key={problem.id} problem={problem} onComplete={onComplete} />}
      </DialogContent>
    </Dialog>
  );
}

function VivaBody({ problem, onComplete }: { problem: Problem; onComplete: (p: Problem, opts: { star: boolean }) => void }) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [unsure, setUnsure] = useState(0);
  const q = useVivaQuestions(problem, started);
  const subject = formatSubject(problem.subject);

  const finish = (star: boolean) => onComplete(problem, { star: star && !problem.starred });
  const grade = (ok: boolean) => {
    const total = q.data?.viva.questions.length ?? 0;
    const misses = unsure + (ok ? 0 : 1);
    if (index + 1 >= total) return finish(misses > 0);
    setUnsure(misses);
    setIndex(index + 1);
    setRevealed(false);
  };

  if (!started) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GraduationCap className="size-5 text-primary" /> Quick viva?</DialogTitle>
          <DialogDescription>
            Before marking <span className="font-medium text-foreground">{problem.name}</span> done, prove it with 2 rapid-fire
            {" "}{subject} interview questions. Takes under a minute.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => finish(false)}>Skip &amp; mark done</Button>
          <Button onClick={() => setStarted(true)}>Start 2-question check</Button>
        </DialogFooter>
      </>
    );
  }

  if (q.isPending) {
    return (
      <div className="grid gap-3" aria-label="Loading questions">
        <DialogHeader>
          <DialogTitle>{subject} viva · {problem.name}</DialogTitle>
          <DialogDescription>Preparing your questions…</DialogDescription>
        </DialogHeader>
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{subject} viva · {problem.name}</DialogTitle>
          <DialogDescription>Couldn&apos;t load questions: {q.error?.message ?? "unknown error"}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => q.refetch()}>Retry</Button>
          <Button onClick={() => finish(false)}>Mark done</Button>
        </DialogFooter>
      </>
    );
  }

  const { questions } = q.data.viva;
  const current = questions[index];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{subject} viva · {problem.name}</DialogTitle>
        <DialogDescription>
          Question {index + 1} of {questions.length}. Answer out loud, then reveal.
          {!q.data.ai && " (AI off · offline questions)"}
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm font-medium">{current.question}</p>
      {revealed && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Model answer</span>
          <p className="mt-0.5">{current.answer}</p>
        </div>
      )}
      <DialogFooter>
        {revealed ? (
          <>
            <Button variant="outline" onClick={() => grade(false)}><HelpCircle /> Not sure</Button>
            <Button onClick={() => grade(true)}><Check /> Got it</Button>
          </>
        ) : (
          <Button onClick={() => setRevealed(true)}><Eye /> Reveal</Button>
        )}
      </DialogFooter>
    </>
  );
}
