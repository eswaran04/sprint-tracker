"use client";

import { AlertTriangle, Users, XCircle, ZapOff } from "lucide-react";

const PAIN_POINTS = [
  {
    icon: XCircle,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    tag: "Problem #1",
    title: "The Spreadsheet Graveyard",
    headline: "450 static rows of intimidation",
    description:
      "You bookmark Striver SDE sheet or download Love Babbar 450 in Excel. But raw spreadsheets lack real calendar dates, reminders, or pacing. Within 4 days, staring at static cells feels like tedious data entry, and the tab gets buried forever.",
    stat: "87% of DSA sheets are abandoned by Day 4",
  },
  {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    tag: "Problem #2",
    title: "The 'Accepted' Mirage",
    headline: "Passing test cases ≠ Passing the interview",
    description:
      "Getting a green checkmark on LeetCode gives false confidence. Candidates frequently write solutions with subtle O(N²) time bottlenecks, excessive auxiliary memory, or overlooked integer overflow edge cases that real MAANG interviewers immediately flag.",
    stat: "73% of candidate rejections stem from weak Big-O clarity",
  },
  {
    icon: ZapOff,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    tag: "Problem #3",
    title: "The Backlog Spiral",
    headline: "One missed weekend breaks the entire plan",
    description:
      "Life happens: college exams, overtime at work, or falling sick. When you miss 2 days on a rigid schedule, your spreadsheet becomes hopelessly outdated. Guilt compounds, the backlog piles up, and you end up giving up entirely.",
    stat: "Missing 3 consecutive days triggers a 92% drop-out rate",
  },
  {
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    tag: "Problem #4",
    title: "The Isolated Solo Grind",
    headline: "Grinding alone leads to fast burnout",
    description:
      "Preparing in isolation without study partners or peer accountability leads to fatigue. Without friendly competition, streak tracking, or someone to call out your algorithmic trade-offs, motivation drains within a couple of weeks.",
    stat: "Solo candidates quit 4x faster than study-group peers",
  },
];

export function PainPointsSection() {
  return (
    <section id="pain-points" className="relative border-t border-border/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive uppercase tracking-wider">
            The Reality of DSA Prep
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Why 87% of engineers abandon their DSA spreadsheets
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Spreadsheets were built for accounting, not cognitive learning or behavioral consistency. Here is why the old way consistently fails ambitious developers:
          </p>
        </div>

        {/* 4 Pain Point Cards Grid */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PAIN_POINTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`group relative flex flex-col justify-between rounded-2xl border ${item.border} bg-card/60 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:bg-card/90`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${item.bg} ${item.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {item.headline}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-border/40 pt-3">
                  <span className="text-[11px] font-semibold text-foreground/90">
                    ⚠️ {item.stat}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
