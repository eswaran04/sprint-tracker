"use client";

import { useState } from "react";
import { Bot, CalendarSync, Code2, Loader2, Sparkles, Wand2 } from "lucide-react";

export function InteractiveDemoSection() {
  const [activeTab, setActiveTab] = useState<"review" | "coach" | "generator" | "viva">("review");

  // Tab 1: AI Code Review demo state
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  // Tab 2: Coach state
  const [rescheduled, setRescheduled] = useState(false);

  // Tab 3: Generator prompt
  const [targetPrompt, setTargetPrompt] = useState("Google SDE-2 in 6 weeks (Focus on DP & Graphs)");

  // Tab 4: Viva card state
  const [revealed, setRevealed] = useState(false);

  const handleSimulateReview = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setReviewed(true);
    }, 800);
  };

  return (
    <section id="interactive-demo" className="relative border-t border-border/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            Interactive Experience
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Test the AI engine before you sign in
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Click through our four core AI tools below to experience how Sprintboard guides your daily preparation:
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="mt-12 flex flex-wrap justify-center gap-2 sm:gap-3">
          {[
            { id: "review", label: "Gemini Code Review", icon: Code2 },
            { id: "coach", label: "Smart Reschedule Coach", icon: CalendarSync },
            { id: "generator", label: "Goal-Driven Generator", icon: Wand2 },
            { id: "viva", label: "Active Recall Viva", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Showcase Card */}
        <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-2xl backdrop-blur-xl">
          {/* Tab 1: Code Review */}
          {activeTab === "review" && (
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg">
                    Problem: Subarray Sum Equals K
                  </h3>
                  <p className="text-xs text-muted-foreground">Language: Java · LeetCode 560 · Medium</p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateReview}
                  disabled={analyzing}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary via-chart-5 to-chart-2 px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  <span>{reviewed ? "Re-analyze with Gemini" : "Run Gemini 2.5 Review"}</span>
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {/* User Code snippet */}
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 font-mono text-xs">
                  <div className="mb-2 text-[11px] font-semibold text-muted-foreground uppercase">Your Notes & Code</div>
                  <pre className="text-foreground/90 overflow-x-auto whitespace-pre leading-relaxed">
{`public int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> map = new HashMap<>();
    map.put(0, 1);
    int sum = 0, count = 0;
    for (int num : nums) {
        sum += num;
        if (map.containsKey(sum - k))
            count += map.get(sum - k);
        map.put(sum, map.getOrDefault(sum, 0) + 1);
    }
    return count;
}`}
                  </pre>
                </div>

                {/* AI Review Result */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-primary uppercase">
                    <span>Gemini 2.5 Evaluation</span>
                    <span className="rounded-full bg-basic/20 px-2 py-0.5 text-basic">Validated ✓</span>
                  </div>

                  {reviewed ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-card/60 p-2.5 border border-border/40">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Time Complexity</span>
                          <p className="font-mono font-bold text-foreground">O(N) — Optimal</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Auxiliary Space</span>
                          <p className="font-mono font-bold text-foreground">O(N) via HashMap</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="font-semibold text-foreground">Edge Cases Evaluated:</span>
                        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                          <li>Negative numbers in array: <span className="text-basic font-medium">Handled properly</span></li>
                          <li>All elements equal to k: <span className="text-basic font-medium">Handled via frequency map</span></li>
                          <li>Base case (sum == k): <span className="text-basic font-medium">map.put(0, 1) preserves single-element match</span></li>
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
                        <span className="text-muted-foreground">Pattern Tags:</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">Prefix Sum</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">Hash Map</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                      <Bot className="size-8 text-primary/40 mb-2" />
                      <p className="font-medium text-foreground">Awaiting Gemini Review</p>
                      <p className="text-[11px] mt-1">Click the button above to test real-time Big-O and edge case analysis.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Smart Reschedule Coach */}
          {activeTab === "coach" && (
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg">
                    Scenario: Busy Week at College / Office
                  </h3>
                  <p className="text-xs text-muted-foreground">You missed 4 scheduled problems over Thursday and Friday.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduled(!rescheduled)}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
                >
                  <CalendarSync className="size-3.5" />
                  <span>{rescheduled ? "Reset to Overdue Backlog" : "Apply Smart Reschedule"}</span>
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <div className={`rounded-xl border p-4 transition-all ${rescheduled ? "border-basic/40 bg-basic/10" : "border-rose-500/40 bg-rose-500/10"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {rescheduled ? "✨ Rescheduled: Evenly Distributed Across Weekend & Next Week" : "⚠️ Problem: 4 Overdue Problems Blocking Your Streak"}
                    </span>
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${rescheduled ? "bg-basic text-white" : "bg-rose-500 text-white"}`}>
                      {rescheduled ? "Zero Stress" : "Backlog Stalled"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {rescheduled
                      ? "The coach automatically added +1 problem to your next 4 working days, preserving your target finish date while preventing burnout."
                      : "Without the coach, rigid spreadsheets force you to do all 4 overdue problems + 2 new ones today (6 total), triggering prep abandonment."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center text-xs">
                  <div className="rounded-xl border bg-card p-3">
                    <span className="text-muted-foreground">Saturday</span>
                    <p className="font-bold text-sm text-foreground mt-1">{rescheduled ? "2 Problems" : "6 Overdue!"}</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <span className="text-muted-foreground">Sunday</span>
                    <p className="font-bold text-sm text-foreground mt-1">{rescheduled ? "2 Problems" : "Rest Day"}</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <span className="text-muted-foreground">Monday</span>
                    <p className="font-bold text-sm text-foreground mt-1">{rescheduled ? "2 Problems" : "2 Problems"}</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <span className="text-muted-foreground">Tuesday</span>
                    <p className="font-bold text-sm text-foreground mt-1">{rescheduled ? "2 Problems" : "2 Problems"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Goal Generator */}
          {activeTab === "generator" && (
            <div className="p-6 sm:p-8 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground sm:text-lg">
                  Natural Language Sprint Generation
                </h3>
                <p className="text-xs text-muted-foreground">Describe your timeline, target role, and weak topics in plain English.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  "Google SDE-2 in 6 weeks (Focus on DP & Graphs)",
                  "Amazon New Grad in 4 weeks (Arrays & Trees)",
                  "Meta E4 in 8 weeks (Skip weekends, 2 hrs/day)",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setTargetPrompt(prompt)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      targetPrompt === prompt
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-primary/20 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Generated Plan for: {targetPrompt}</span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary text-[10px] font-semibold">100% Real Problem Links</span>
                </div>
                <div className="grid gap-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
                    <span className="font-medium">Week 1: Dynamic Programming Foundations & Memoization</span>
                    <span className="text-muted-foreground">12 Problems (Google Tagged)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
                    <span className="font-medium">Week 2: Graph Traversals, Topological Sort & Dijkstra</span>
                    <span className="text-muted-foreground">14 Problems (Google Tagged)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
                    <span className="font-medium">Week 3: Advanced Trees, Trie & Segment Trees</span>
                    <span className="text-muted-foreground">10 Problems (Google Tagged)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Active Recall Viva */}
          {activeTab === "viva" && (
            <div className="p-6 sm:p-8 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground sm:text-lg">
                  Spaced Repetition Oral Viva
                </h3>
                <p className="text-xs text-muted-foreground">
                  Simulating what real tech interviewers ask after you write code on the whiteboard.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/30 p-6 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                    Interviewer Challenge
                  </span>
                  <span className="text-muted-foreground">Problem solved 3 days ago</span>
                </div>

                <p className="text-sm font-semibold text-foreground">
                  &ldquo;In Daily Temperatures, why did you choose a Monotonic Decreasing Stack instead of a Min-Heap or brute force? What is the amortized cost per element?&rdquo;
                </p>

                {revealed ? (
                  <div className="rounded-lg border border-basic/30 bg-basic/10 p-4 text-xs space-y-2">
                    <span className="font-bold text-basic uppercase tracking-wider text-[10px]">Model Interviewer Answer:</span>
                    <p className="text-foreground/90 leading-relaxed">
                      &ldquo;A monotonic stack solves next greater element in O(N) total time because each element is pushed and popped at most once, giving an amortized O(1) per day. A min-heap would take O(N log N) time and additional pointer overhead.&rdquo;
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 py-3 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    Click to Reveal Model Interviewer Answer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
