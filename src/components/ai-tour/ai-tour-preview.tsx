"use client";

import { CheckCircle2, Sparkles, AlertCircle, ArrowRight, Users } from "lucide-react";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";

export function TourPreview({ type }: { type: "generator" | "search" | "reschedule" | "warmup" | "review" | "digest" }) {
  switch (type) {
    case "generator":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <AiSparkle className="size-3.5" /> Sprint Goal Prompt
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              6 weeks • 3/day
            </span>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-foreground/90 italic">
            &ldquo;Targeting Google L4 • Focus heavily on Dynamic Programming &amp; Graphs&rdquo;
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Gemini Roadmap Plan</span>
              <span className="text-emerald-500 font-semibold">48 problems curated</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between rounded bg-background/80 px-2 py-1 border border-border/60">
                <span className="truncate">Day 1: Array &amp; Sliding Window Warmup</span>
                <span className="text-[10px] font-mono text-emerald-500">Easy-Med</span>
              </div>
              <div className="flex items-center justify-between rounded bg-background/80 px-2 py-1 border border-border/60">
                <span className="truncate">Day 2: BFS/DFS Island Traversals</span>
                <span className="text-[10px] font-mono text-amber-500">Medium</span>
              </div>
              <div className="flex items-center justify-between rounded bg-background/80 px-2 py-1 border border-border/60">
                <span className="truncate">Day 3: Topological Sort &amp; Course Schedule</span>
                <span className="text-[10px] font-mono text-amber-500">Medium</span>
              </div>
            </div>
          </div>
        </div>
      );

    case "search":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-background px-2.5 py-2 shadow-xs">
            <Sparkles className="size-3.5 text-[var(--ai-2)]" />
            <span className="flex-1 text-foreground font-medium truncate">
              hard graph problems asked at Amazon not yet solved
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              AI Filter
            </span>
          </div>
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Filters automatically extracted:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Topic: Graphs
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Difficulty: Hard
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Company: Amazon
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Status: Unsolved
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span>Found 6 targeted problems matching all criteria</span>
          </div>
        </div>
      );

    case "reschedule":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-medium text-foreground">Schedule Recovery Simulation</span>
            <span className="text-[10px] text-amber-500 font-medium">4 Overdue Problems</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2">
              <span className="font-semibold text-destructive block mb-1">Before: Day 3 Jam</span>
              <span className="text-muted-foreground block">Day 3: 7 problems (overloaded!)</span>
              <span className="text-muted-foreground block">High risk of abandonment</span>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                After: AI Balanced
              </span>
              <span className="text-foreground block font-medium">+1 problem across Days 4–7</span>
              <span className="text-muted-foreground block">Sprint end date preserved ✨</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-muted/60 px-2.5 py-1.5 text-[11px]">
            <ArrowRight className="size-3 text-primary shrink-0" />
            <span className="text-foreground">
              Maintains difficulty curve and avoids study burnout.
            </span>
          </div>
        </div>
      );

    case "warmup":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <AiBadge label="Viva" /> Graph Algorithms Warmup
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Q1 of 2</span>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 font-medium text-foreground leading-snug">
            &ldquo;When does Dijkstra fail on directed graphs with negative edge weights?&rdquo;
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <strong>Correct:</strong> Dijkstra greedily finalizes vertex distances once visited.
                Negative edges can subsequently provide a shorter path, violating the greedy invariant.
              </div>
            </div>
          </div>
        </div>
      );

    case "review":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <AiSparkle className="size-3.5" /> Note &amp; Solution Critique
            </span>
            <span className="text-[10px] text-emerald-500 font-medium font-mono">
              O(N) Time • O(1) Space
            </span>
          </div>
          <div className="rounded bg-muted/60 p-2 font-mono text-[10px] text-muted-foreground leading-tight">
            left = 0, right = n - 1<br />
            while left &lt; right:<br />
            &nbsp;&nbsp;mid = (left + right) // 2<br />
            &nbsp;&nbsp;...
          </div>
          <div className="space-y-1 rounded-md border border-primary/20 bg-primary/5 p-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <AlertCircle className="size-3.5" />
              <span>Gemini Insight</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Your binary search logic is clean. Watch out for integer overflow with large indices—prefer
              <code className="text-foreground mx-1 px-1 bg-muted rounded font-mono text-[10px]">left + (right - left) // 2</code>.
            </p>
          </div>
        </div>
      );

    case "digest":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <AiSparkle className="size-3.5 text-[var(--ai-2)]" />
              <span>This Week in Algo Squad</span>
              <AiBadge label="AI Digest" />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              28 solves · 7d
            </span>
          </div>

          <div className="rounded-lg bg-muted/60 p-2 font-medium text-foreground/90 leading-snug">
            &ldquo;Elena cleared NeetCode 150 &amp; group hit a new velocity record! 🚀&rdquo;
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary mb-1">
                <Users className="size-3.5" />
                <span>Pair-up Opportunity</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Marcus solved <strong className="text-foreground">LRU Cache</strong> (Medium), which is due on your sprint today. Reach out to compare solutions!
              </p>
            </div>

            <div className="flex items-center justify-between rounded bg-background/80 px-2 py-1 border border-border/60 text-[11px]">
              <span className="text-muted-foreground">Your pace:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">On track (+4 streak days)</span>
            </div>
          </div>
        </div>
      );
  }
}
