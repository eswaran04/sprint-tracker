"use client";

import { CalendarSync, Check, FileSpreadsheet, Sparkles, Users } from "lucide-react";

const PILLARS = [
  {
    icon: FileSpreadsheet,
    badge: "Pillar 1",
    title: "1-Click Sheet Ingestion & Dynamic Calendaring",
    headline: "Transform static Excel cells into living, breathing sprints",
    description:
      "Drag and drop any .xlsx file — Striver, NeetCode 150, or your company's custom problem sheet. Sprintboard auto-detects columns, extracts embedded links, assigns real calendar dates, skips weekends, and keeps your daily targets crystal clear.",
    highlights: [
      "Auto-detects Name, URL, Difficulty, Topic, Company columns",
      "Real-world calendar sync with weekend rest day skipping",
      "Dynamic timeline view with drag-and-drop problem rescheduling",
    ],
  },
  {
    icon: Sparkles,
    badge: "Pillar 2 · Pro",
    title: "Gemini 2.5 Code Review & Complexity Auditor",
    headline: "Instant asymptotic time & space complexity analysis",
    description:
      "Never wonder if your solution is optimal. Sprintboard feeds your code and markdown approach to Google Gemini 2.5 Flash. It checks asymptotic Big-O bounds, catches sneaky edge cases (empty inputs, overflow, negative loops), and tags algorithmic patterns.",
    highlights: [
      "Rigorous asymptotic Time & Auxiliary Space complexity analysis",
      "Automated edge-case detection before real interviewers catch them",
      "Formatted markdown review block inserted directly into your notes",
    ],
  },
  {
    icon: CalendarSync,
    badge: "Pillar 3 · Pro",
    title: "Smart Reschedule Coach",
    headline: "Never let a busy week kill your momentum",
    description:
      "When work or life derails your sprint, don't restart from scratch. The Smart Reschedule Coach evaluates overdue tasks and study velocity, then mathematically redistributes problems across upcoming days with one click.",
    highlights: [
      "1-click backlog redistribution without emotional overwhelm",
      "Smooth schedule compression or slide modes",
      "Preserves completed problem history while rejuvenating future days",
    ],
  },
  {
    icon: Users,
    badge: "Pillar 4",
    title: "Study Pods, Oral Viva & Weekly Digest",
    headline: "Spaced-repetition active recall with peer accountability",
    description:
      "Prepare for real interview discussions. Daily Active Recall cards prompt oral viva questions on previous problems. Join study pods to share streaks, send friendly emoji nudges, and receive an automated weekly team digest.",
    highlights: [
      "Daily spaced-repetition oral mock interview questions",
      "Group activity logs with instant peer nudges",
      "Automated weekly team summary highlighting top contributors",
    ],
  },
];

export function SolutionShowcaseSection() {
  return (
    <section id="solution" className="relative border-t border-border/50 py-20 md:py-28 bg-card/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            How Sprintboard Solves It
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Engineered for completion, not just collection
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            We combined cognitive pacing algorithms with Google Gemini 2.5 reasoning to ensure every problem you solve compounds into interview mastery.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const isPro = pillar.badge.includes("Pro");
            return (
              <div
                key={pillar.title}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-md transition-all hover:border-primary/50 hover:shadow-2xl sm:p-8"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                        isPro
                          ? "border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border border-primary/30 bg-primary/10 text-primary"
                      }`}
                    >
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-primary">
                    {pillar.headline}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-border/40 pt-4">
                  <ul className="space-y-2">
                    {pillar.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-foreground/90">
                        <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-basic/20 text-basic">
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
