"use client";

import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "I had 3 different Excel sheets (Striver, Blind 75, company tagged) that I kept abandoning. Sprintboard turned them into a 45-day calendar. The Gemini code review caught an O(N²) bug in my graph solution that would have failed my Google on-site.",
    name: "Aravind K.",
    role: "L4 Software Engineer",
    company: "Google",
    tag: "Offer Accepted",
  },
  {
    quote:
      "When I got sick during week 3, I thought my prep was ruined. The Smart Reschedule Coach redistributed my 6 overdue problems across the next two weeks without extending my test date. That feature alone was worth the Pro subscription.",
    name: "Sneha M.",
    role: "SDE-2",
    company: "Amazon",
    tag: "Offer Accepted",
  },
  {
    quote:
      "The Active Recall viva cards are a secret weapon. It forced me to verbally justify why I chose a monotonic stack or BFS instead of just memorizing LeetCode solutions. Passed all 4 Meta technical loops on the first try.",
    name: "David L.",
    role: "Production Engineer",
    company: "Meta",
    tag: "Offer Accepted",
  },
];

export function TestimonialsSection() {
  return (
    <section className="relative border-t border-border/50 py-20 md:py-28 bg-card/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            Engineer Stories
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            From spreadsheet anxiety to signed offers
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Hear from developers who switched from static spreadsheets to AI-augmented sprints.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-6 shadow-md backdrop-blur-md transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
            >
              <div>
                <div className="flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="mt-6 border-t border-border/40 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">{t.name}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t.role} at <span className="font-semibold text-foreground">{t.company}</span>
                  </p>
                </div>
                <span className="rounded-full bg-basic/15 px-2 py-0.5 text-[10px] font-semibold text-basic">
                  {t.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
