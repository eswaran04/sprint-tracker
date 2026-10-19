"use client";

import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import { analyzeNote } from "@/lib/api";
import { stripReview } from "@/lib/review/blocks";
import { renderReview, upsertReview } from "@/lib/review/format";
import type { Problem } from "@/lib/types";
import { CompanyTags, DifficultyChip, Tag } from "./chips";
import { Markdown } from "./markdown";

const TEMPLATE = "## Approach\n\n\n## Complexity\n- Time: O()\n- Space: O()\n\n## Code\n```java\n\n```\n";

type Status = "idle" | "saving" | "saved";

function NotesEditor({ problem, onSave }: { problem: Problem; onSave: (notes: string) => Promise<unknown> }) {
  const [value, setValue] = useState(problem.notes);
  const [status, setStatus] = useState<Status>("idle");
  const last = useRef(problem.notes);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = async (v: string) => {
    if (v === last.current) return;
    setStatus("saving");
    try {
      await onSave(v);
      last.current = v;
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  };

  const latest = useRef(value);
  // Autosave 800ms after typing stops; flush on close/unmount.
  useEffect(() => {
    latest.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(value), 800);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => void flush(latest.current), []);

  const [tab, setTab] = useState(problem.notes ? "preview" : "write");
  const [analyzing, setAnalyzing] = useState(false);
  const inflight = useRef<AbortController>(undefined);
  // Drop a slow review if the drawer closes or switches problem (this editor is keyed by problem id).
  useEffect(() => () => inflight.current?.abort(), []);

  const [reviewSeen, markReviewSeen] = useFeatureSeen("code-review");
  const canAnalyze = stripReview(value).length > 0 && !analyzing;
  const analyze = async () => {
    if (!canAnalyze) return;
    markReviewSeen();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setAnalyzing(true);
    try {
      const { name, url, difficulty, subject, topics } = problem;
      const { review, ai } = await analyzeNote({ name, url, difficulty, subject, topics }, value, ctrl.signal);
      if (ctrl.signal.aborted) return;
      const block = renderReview(review, ai);
      // Apply to the latest text so edits made while waiting aren't lost.
      setValue((v) => upsertReview(v, block));
      setTab("preview");
      if (ai) toast.success("Review added to your notes");
      else toast.info("Built-in analysis added (AI unavailable)");
    } catch (e) {
      if (ctrl.signal.aborted || (e as Error).name === "AbortError") return;
      toast.error((e as Error).message || "Couldn't analyze the note");
    } finally {
      if (inflight.current === ctrl) {
        inflight.current = undefined;
        setAnalyzing(false);
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const t = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = t;
    const next = value.slice(0, s) + "  " + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        {!value && (
          <button onClick={() => setValue(TEMPLATE)} className="text-xs text-primary hover:underline">Use template</button>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          {status === "saving" && <><Loader2 className="size-3 animate-spin" /> Saving…</>}
          {status === "saved" && <><Check className="size-3 text-basic" /> Saved</>}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={analyze}
          disabled={!canAnalyze}
          title="AI code & intuition review: complexity, edge cases and missing pattern tags"
          className="ai-border ai-glow relative rounded-lg"
        >
          {analyzing ? <Loader2 className="animate-spin text-[var(--ai-2)]" /> : <AiSparkle className="size-3.5" />}
          <span className="ai-text font-semibold">{analyzing ? "Analyzing…" : "Analyze note"}</span>
          {!reviewSeen && !analyzing && <AiBadge className="pointer-events-none absolute -top-2 -right-2 shadow-sm" />}
        </Button>
      </div>
      <TabsContent value="write" className="min-h-0 flex-1">
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={"Approach, edge cases, complexity…\n\nMarkdown supported — use ``` for code blocks."}
          className="h-full min-h-[50vh] resize-none font-mono text-[13px] leading-relaxed"
        />
      </TabsContent>
      <TabsContent value="preview" className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-4">
        {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
      </TabsContent>
    </Tabs>
  );
}

export function NotesDrawer({ problem, onClose, onSave }: {
  problem: Problem | null; onClose: () => void; onSave: (p: Problem, notes: string) => Promise<unknown>;
}) {
  return (
    <Sheet open={Boolean(problem)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        {problem && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="pr-8 text-lg">{problem.name}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  <DifficultyChip difficulty={problem.difficulty} />
                  <Tag>Day {problem.day_no}</Tag>
                  {problem.topics.map((t) => <Tag key={t}>{t}</Tag>)}
                  {problem.url && (
                    <a href={problem.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Open problem <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </SheetDescription>
              {problem.companies.length > 0 && <CompanyTags companies={problem.companies} max={8} />}
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <NotesEditor key={problem.id} problem={problem} onSave={(n) => onSave(problem, n)} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
