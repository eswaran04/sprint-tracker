"use client";

import { Suspense } from "react";
import { Bot, CheckCircle2, ChevronRight, Crown, Flame, Sparkles, Star } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { GPayIcon } from "@/components/gpay-icon";

export function PitchHero({ error }: { error?: string | string[] }) {
  const errorText = Array.isArray(error) ? error[0] : error;
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Eyebrow Pill */}
        <div className="mx-auto flex max-w-fit items-center gap-2 rounded-full border border-primary/30 bg-card/70 px-3.5 py-1 text-xs text-muted-foreground shadow-xs backdrop-blur-md">
          <span className="flex size-2 rounded-full bg-basic animate-pulse" />
          <span className="font-medium text-foreground">AI 2.5 Flash Engine</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="flex items-center gap-1.5 text-primary">
            <div className="flex size-3.5 items-center justify-center">
              <GPayIcon className="size-full" />
            </div>
            <span>Google Pay Pro (Coming Soon)</span>
          </span>
        </div>

        {/* Hero Title */}
        <div className="mx-auto mt-6 max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
            Turn forgotten DSA sheets into{" "}
            <span className="bg-gradient-to-r from-primary via-chart-5 to-chart-2 bg-clip-text text-transparent">
              sprints you actually finish
            </span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-xl leading-relaxed">
            Stop abandoning 400-row Excel spreadsheets. Upload your sheet, get calendar-synced daily pacing,
            Gemini 2.5 code review with Big-O analysis, and smart backlog rescheduling when life gets in the way.
          </p>
        </div>

        {/* CTA Bar */}
        <div className="mx-auto mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <Suspense fallback={<div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />}>
              <GoogleSignIn />
            </Suspense>
            {errorText && <p className="text-xs text-destructive">Sign in did not complete. Please retry.</p>}
          </div>

          <a
            href="#pricing"
            className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-5 py-2.5 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card/90"
          >
            <Crown className="size-4 text-amber-500 fill-amber-500" />
            <span>See Pro Plans & Pricing</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Free starter tier available · Google Pay Pro checkout coming soon · No credit card needed for free
        </p>

        {/* Hero Visual Mockup */}
        <div className="relative mx-auto mt-14 max-w-5xl">
          {/* Ambient Glow */}
          <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/30 via-chart-5/20 to-chart-2/30 blur-2xl opacity-50" />

          {/* Browser / App Window Frame */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-2xl backdrop-blur-xl">
            {/* Window title bar */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-rose-500/80" />
                  <span className="size-2.5 rounded-full bg-amber-500/80" />
                  <span className="size-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">sprintboard.app/app/s/google-sde2-sprint</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-medium text-basic text-[11px]">
                  <Flame className="size-3.5 fill-basic" /> 7-Day Streak
                </span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  ⭐ PRO ACTIVE
                </span>
              </div>
            </div>

            {/* Mock Dashboard Body */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* Sprint Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground sm:text-lg">Google SDE-2 Interview Sprint</h2>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Day 4 of 42</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Striver SDE Sheet + Company Tags · 14 of 180 solved (7.8%)</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden text-right text-xs sm:block">
                    <span className="block font-medium text-foreground">Today: 3 Problems</span>
                    <span className="text-basic">On Track ✓</span>
                  </div>
                  <button type="button" className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    Smart Reschedule
                  </button>
                </div>
              </div>

              {/* Problem Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 p-3 transition-colors hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <span className="flex size-5 items-center justify-center rounded-md bg-basic text-primary-foreground">
                      <CheckCircle2 className="size-3.5 stroke-[2.5]" />
                    </span>
                    <div>
                      <span className="text-sm font-medium text-foreground line-through text-muted-foreground">
                        Binary Tree Maximum Path Sum
                      </span>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-rose-500">Hard</span>
                        <span className="text-muted-foreground">Trees, Dynamic Programming</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">Google</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary sm:flex">
                      <Sparkles className="size-3" /> Gemini Reviewed
                    </span>
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-card p-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="size-5 rounded-md border-2 border-primary/60" />
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        LRU Cache Implementation
                      </span>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-amber-500">Medium</span>
                        <span className="text-muted-foreground">Hash Table, Doubly Linked List</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">Amazon, Google</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      In Progress
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3 opacity-80">
                  <div className="flex items-center gap-3">
                    <span className="size-5 rounded-md border border-border" />
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        Word Break II (DP with Backtracking)
                      </span>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-rose-500">Hard</span>
                        <span className="text-muted-foreground">Dynamic Programming, Trie</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">Meta</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Up Next</span>
                </div>
              </div>

              {/* Floating Pro Callout Pill */}
              <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-chart-5/5 to-transparent p-3 text-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <span className="font-medium text-foreground">Gemini 2.5 Code Review:</span>
                  <span className="text-muted-foreground">O(N) Time · O(H) Space · Edge case & negative node handling validated.</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                  <div className="flex size-3.5 items-center justify-center">
                    <GPayIcon className="size-full" />
                  </div>
                  <span>Google Pay Pro (Coming Soon)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 border-t border-border/50 pt-8 sm:grid-cols-4 text-center">
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">14,200+</div>
            <div className="mt-1 text-xs text-muted-foreground">Problems Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">3.2x</div>
            <div className="mt-1 text-xs text-muted-foreground">Faster Sheet Completion</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">98.4%</div>
            <div className="mt-1 text-xs text-muted-foreground">Pass Rate in Pro Cohort</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">&lt; 200ms</div>
            <div className="mt-1 text-xs text-muted-foreground">Google Vertex AI Latency</div>
          </div>
        </div>
      </div>
    </section>
  );
}
