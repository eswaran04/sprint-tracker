"use client";

import { useState } from "react";
import { ArrowRight, Check, Crown, ShieldCheck, Zap } from "lucide-react";
import { GPayIcon } from "@/components/gpay-icon";

export function PricingGPaySection() {
  const [annual, setAnnual] = useState(true);

  const proPrice = annual ? "6.58" : "9.99";
  const proBilled = annual ? "$79 billed annually (Save 34%)" : "Billed monthly, cancel anytime";
  const teamPrice = annual ? "19.99" : "24.99";

  return (
    <section id="pricing" className="relative border-t border-border/50 py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            Plans & Subscriptions
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing (Google Pay Coming Soon)
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Start completely free or unlock unlimited Gemini 2.5 AI superpowers with seamless 1-click Google Pay checkout (coming soon).
          </p>

          {/* Billing Switcher */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-xs font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <button
              type="button"
              onClick={() => setAnnual(!annual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary/20 transition-colors focus-visible:outline-none"
              aria-label="Toggle annual billing"
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-primary transition-transform ${
                  annual ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
                Annual
              </span>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-zinc-950 uppercase">
                Save 34%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {/* Free Starter Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-md sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Free Starter</h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                  Forever Free
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Everything you need to track a single DSA sheet on a realistic calendar.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">$0</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">No credit card or payment required</p>

              <div className="mt-8 border-t border-border/40 pt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Included Features:</p>
                <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Upload any .xlsx prep sheet (1 active sprint)</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Calendar date mapping & weekend skip logic</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Topic, difficulty & target company filtering</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Markdown solution notes with syntax highlighting</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Browse and copy community public sheets</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <a
                href="/app"
                className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-xs font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-muted/50"
              >
                Get Started Free
              </a>
            </div>
          </div>

          {/* Pro Sprint Card (Highlighted) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-primary bg-card p-6 shadow-2xl sm:p-8">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-primary px-3.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider shadow-md">
              ⭐ Pro Tier · Google Pay (Coming Soon)
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-foreground">Sprintboard Pro</h3>
                  <Crown className="size-4 text-amber-500 fill-amber-500" />
                </div>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                  AI Supercharged
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                All Gemini 2.5 Flash reasoning tools, smart rescheduling, and unlimited sheets.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">${proPrice}</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-primary">{proBilled}</p>

              <div className="mt-8 border-t border-border/40 pt-6">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Everything in Free, plus:</p>
                <ul className="mt-3 space-y-2.5 text-xs text-foreground/90">
                  <li className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span><strong>Gemini 2.5 Code Review:</strong> Big-O Time/Space & edge-case detection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span><strong>Smart Reschedule Coach:</strong> 1-click backlog redistribution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span><strong>Goal-Driven Sprint Generator:</strong> Custom syllabus for Google, Meta, Amazon</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span><strong>Spaced-Repetition Active Recall:</strong> Daily oral interview viva cards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span><strong>Weekly AI Digest:</strong> Team stats, peer nudges, and shoutouts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span><strong>Unlimited Sprints:</strong> Private sheets & pgvector semantic search</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <a
                href="/app"
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-95"
              >
                <div className="flex size-5 items-center justify-center rounded bg-white p-0.5">
                  <GPayIcon className="size-full" />
                </div>
                <span>Subscribe with Google Pay (Coming Soon)</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="text-center text-[11px] text-muted-foreground">
                Coming soon · 1-click checkout · Free starter tier available now
              </p>
            </div>
          </div>

          {/* Campus & Team Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-md sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Campus & Team</h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                  Cohorts & Clubs
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                For university coding clubs, bootcamps, and engineering study groups.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">${teamPrice}</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Up to 10 member seats included</p>

              <div className="mt-8 border-t border-border/40 pt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Superpowers:</p>
                <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>All Pro AI features for every member in your pod</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Shared cohort syllabus with synchronised calendar days</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Group leaderboard with weekly automated AI digests</span>
                  </li>
                  <li className="flex items-start gap-2 text-foreground/90">
                    <Check className="size-4 shrink-0 text-basic" />
                    <span>Dedicated group coach settings & central Google Pay billing (Coming Soon)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <a
                href="/app"
                className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-xs font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-muted/50"
              >
                Create Team Pod (Coming Soon)
              </a>
            </div>
          </div>
        </div>

        {/* Google Pay Integration Feature Box */}
        <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-primary/5 to-transparent p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-card p-1.5 shadow-xs border border-border/80">
                  <GPayIcon className="size-full" />
                </div>
                <h4 className="text-lg font-bold text-foreground">
                  Frictionless Subscriptions Powered by Google Pay (Coming Soon)
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                We are integrating directly with Google Pay to give you frictionless 1-click checkout. Soon you will be able to use your existing Google Account, linked cards, or Google Wallet without typing 16-digit card numbers.
              </p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-basic">
                <ShieldCheck className="size-4" />
                <span>256-bit TLS Tokenized</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Zap className="size-4 text-amber-500 fill-amber-500" />
                <span>Instant Pro Activation</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span>🔄 Cancel anytime in 1 click</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
